/**
 * A Safe per proposal, counterfactually.
 *
 * Each proposal collects into its own Safe whose address is derived from the
 * proposal id, so we can print the address — and people can pay into it —
 * before anything is deployed. The contract only gets created when money has
 * to move out, which is the first time it is worth paying for.
 *
 * The Safe's owner is one server-held signer with a threshold of one (a second
 * owner can be added for 1-of-2). That keeps gas in one place: the signer EOA
 * pays for the deployment and for each transfer out, and no per-proposal
 * address ever needs topping up.
 */

import {
  concatHex,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  keccak256,
  padHex,
  parseAbi,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

/** Safe 1.4.1, deployed on Celo at the canonical addresses. */
export const SAFE_PROXY_FACTORY = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67" as Address;
export const SAFE_SINGLETON = "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762" as Address; // SafeL2
export const SAFE_FALLBACK_HANDLER = "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99" as Address;

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

const factoryAbi = parseAbi([
  "function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address proxy)",
  "function proxyCreationCode() view returns (bytes)",
]);

const safeAbi = parseAbi([
  "function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)",
  "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) returns (bool success)",
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
]);

export const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.CELO_RPC_URL),
});

// ── who signs ──────────────────────────────────────────────────────────────

export function safesConfigured(): boolean {
  const key = process.env.PROPOSAL_SIGNER_KEY;
  return !!key && /^(0x)?[0-9a-f]{64}$/i.test(key);
}

/** The one key that signs for every proposal Safe, and pays the gas. */
export function signerAccount(): PrivateKeyAccount {
  const key = process.env.PROPOSAL_SIGNER_KEY;
  if (!key || !/^(0x)?[0-9a-f]{64}$/i.test(key)) {
    throw new Error(
      "PROPOSAL_SIGNER_KEY is not set (64 hex characters). It owns every proposal Safe and pays the gas.",
    );
  }
  return privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as Hex);
}

/**
 * Owners of a proposal's Safe. The server signer first, so it can execute on
 * its own; SAFE_SECOND_OWNER makes it 1-of-2, which adds a human who can move
 * funds if the server ever cannot.
 */
export function safeOwners(): Address[] {
  const owners: Address[] = [signerAccount().address];
  const second = process.env.SAFE_SECOND_OWNER;
  if (second && /^0x[a-fA-F0-9]{40}$/.test(second) && second.toLowerCase() !== owners[0].toLowerCase()) {
    owners.push(second as Address);
  }
  return owners;
}

export const SAFE_THRESHOLD = 1;

// ── the address, before anything exists ────────────────────────────────────

/** Same proposal, same salt, same address — for good. */
export function saltNonce(proposalId: string): bigint {
  return BigInt(keccak256(toBytes(`commonshub:proposal:${proposalId}`)));
}

export function setupCalldata(): Hex {
  return encodeFunctionData({
    abi: safeAbi,
    functionName: "setup",
    args: [
      safeOwners(),
      BigInt(SAFE_THRESHOLD),
      ZERO,
      "0x",
      SAFE_FALLBACK_HANDLER,
      ZERO,
      BigInt(0),
      ZERO,
    ],
  });
}

let creationCode: Promise<Hex> | null = null;
function proxyCreationCode(): Promise<Hex> {
  creationCode ??= publicClient.readContract({
    address: SAFE_PROXY_FACTORY,
    abi: factoryAbi,
    functionName: "proxyCreationCode",
  }) as Promise<Hex>;
  return creationCode;
}

/**
 * Work out the address the factory will give this proposal.
 *
 * We compute it (CREATE2 over the proxy creation code) and then ask the chain
 * to simulate the deployment and tell us what it would create. People send
 * money to this address, so a mistake here is unrecoverable — the two have to
 * agree before we hand it out.
 */
export async function predictSafeAddress(proposalId: string): Promise<Address> {
  const initializer = setupCalldata();
  const salt = keccak256(
    concatHex([keccak256(initializer), padHex(`0x${saltNonce(proposalId).toString(16)}`, { size: 32 })]),
  );
  const initCodeHash = keccak256(
    concatHex([await proxyCreationCode(), padHex(SAFE_SINGLETON, { size: 32 })]),
  );

  const { getContractAddress } = await import("viem");
  const computed = getContractAddress({
    bytecodeHash: initCodeHash,
    from: SAFE_PROXY_FACTORY,
    opcode: "CREATE2",
    salt,
  });

  const simulated = await simulateDeployment(proposalId).catch(() => null);
  if (simulated && simulated.toLowerCase() !== computed.toLowerCase()) {
    throw new Error(
      `Refusing to use a Safe address we cannot agree on (computed ${computed}, chain says ${simulated}).`,
    );
  }

  return computed;
}

/** What the factory would create, according to the chain. Costs nothing. */
async function simulateDeployment(proposalId: string): Promise<Address> {
  const { result } = await publicClient.simulateContract({
    address: SAFE_PROXY_FACTORY,
    abi: factoryAbi,
    functionName: "createProxyWithNonce",
    args: [SAFE_SINGLETON, setupCalldata(), saltNonce(proposalId)],
    account: signerAccount().address,
  });
  return result as Address;
}

export async function isDeployed(address: Address): Promise<boolean> {
  const code = await publicClient.getCode({ address });
  return !!code && code !== "0x";
}

// ── deploying, and moving money ────────────────────────────────────────────

function walletClient() {
  return createWalletClient({
    account: signerAccount(),
    chain: celo,
    transport: http(process.env.CELO_RPC_URL),
  });
}

/** Deploy the Safe if it is not there yet. Only worth doing when funds move. */
export async function ensureDeployed(proposalId: string): Promise<Address> {
  const address = await predictSafeAddress(proposalId);
  if (await isDeployed(address)) return address;

  const hash = await walletClient().writeContract({
    address: SAFE_PROXY_FACTORY,
    abi: factoryAbi,
    functionName: "createProxyWithNonce",
    args: [SAFE_SINGLETON, setupCalldata(), saltNonce(proposalId)],
  });
  await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });

  if (!(await isDeployed(address))) {
    throw new Error("The Safe did not come up at the address we predicted.");
  }
  return address;
}

/**
 * A signature that says "the owner sending this transaction approves it".
 * With a threshold of one and the sender as owner, no message has to be signed
 * at all — Safe accepts `v = 1` and reads the owner out of `r`.
 */
function preValidatedSignature(owner: Address): Hex {
  return concatHex([padHex(owner, { size: 32 }), padHex("0x0", { size: 32 }), "0x01"]);
}

/** Send a call out of a proposal's Safe. Gas comes from the signer EOA. */
export async function execFromSafe(input: {
  proposalId: string;
  to: Address;
  data: Hex;
  value?: bigint;
}): Promise<Hex> {
  const safe = await ensureDeployed(input.proposalId);
  const owner = signerAccount().address;

  const hash = await walletClient().writeContract({
    address: safe,
    abi: safeAbi,
    functionName: "execTransaction",
    args: [
      input.to,
      input.value ?? BigInt(0),
      input.data,
      0, // CALL
      BigInt(0),
      BigInt(0),
      BigInt(0),
      ZERO,
      ZERO,
      preValidatedSignature(owner),
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  return hash;
}

/** What the signer EOA holds for gas — the only address that needs topping up. */
export async function signerGasBalance(): Promise<bigint> {
  return publicClient.getBalance({ address: signerAccount().address });
}
