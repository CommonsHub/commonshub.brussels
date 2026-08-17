/**
 * Deploy the tCHT test token to Celo Sepolia.
 *
 *   PROPOSAL_SIGNER_KEY=<hex> node scripts/deploy-test-token.mjs
 *
 * The signer needs a little test CELO from https://faucet.celo.org
 * (pick Celo Sepolia). Prints the address and the env block that points a
 * deployment at the testnet.
 */
import solc from "solc";
import { readFileSync } from "fs";
import { createPublicClient, createWalletClient, defineChain, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.TESTNET_RPC_URL || "https://forno.celo-sepolia.celo-testnet.org";
const chain = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const key = process.env.PROPOSAL_SIGNER_KEY;
if (!key || !/^(0x)?[0-9a-f]{64}$/i.test(key)) {
  console.error("Set PROPOSAL_SIGNER_KEY (the staging signer works).");
  process.exit(1);
}
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);

console.log("compiling TestToken.sol…");
const source = readFileSync(new URL("../contracts/TestToken.sol", import.meta.url), "utf8");
const output = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: "Solidity",
      sources: { "TestToken.sol": { content: source } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      },
    }),
  ),
);
const errors = (output.errors ?? []).filter((e) => e.severity === "error");
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage);
  process.exit(1);
}
const contract = output.contracts["TestToken.sol"].TestToken;

const publicClient = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

const balance = await publicClient.getBalance({ address: account.address });
console.log(`deployer ${account.address} holds ${formatUnits(balance, 18)} CELO on Celo Sepolia`);
if (balance === 0n) {
  console.error("No gas. Get test CELO at https://faucet.celo.org (network: Celo Sepolia).");
  process.exit(1);
}

console.log("deploying…");
const hash = await wallet.deployContract({
  abi: contract.abi,
  bytecode: `0x${contract.evm.bytecode.object}`,
});
const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
const address = receipt.contractAddress;
console.log(`\n✓ tCHT deployed at ${address}`);
console.log(`  tx: https://celo-sepolia.blockscout.com/tx/${hash}`);
console.log(`  1,000,000 tCHT minted to the deployer; mint(address,uint256) is open to anyone.`);
console.log(`\nTo point a deployment at the testnet, set:`);
console.log(`  TOKEN_CHAIN_ID=11142220`);
console.log(`  TOKEN_CHAIN_NAME="Celo Sepolia"`);
console.log(`  TOKEN_RPC_URL=${RPC}`);
console.log(`  TOKEN_EXPLORER_URL=https://celo-sepolia.blockscout.com`);
console.log(`  TOKEN_ADDRESS=${address}`);
console.log(`  TOKEN_SYMBOL=tCHT`);
console.log(`  TOKEN_DECIMALS=6`);
