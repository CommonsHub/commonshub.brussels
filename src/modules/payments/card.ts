/**
 * Moving tokens straight from someone's account, on the website.
 *
 * Everyone's tokens live in a Citizen Wallet card — a Safe derived from their
 * Discord id — and the community signer is authorised on the CardManager to
 * operate those cards. That is exactly how the Discord bot's /send works; this
 * is the same mechanism without the round-trip through Discord: the person is
 * signed in here with that Discord account, so the site asks the bundler to
 * move their tokens, signed by the same community key the bot uses.
 *
 * Gas goes through the Citizen Wallet paymaster, so neither the person nor
 * this server pays it.
 */

import { Wallet, keccak256, toUtf8Bytes, parseUnits } from "ethers";
import {
  BundlerService,
  CommunityConfig,
  callOnCardCallData,
  getAccountAddress,
  getCardAddress,
  tokenTransferCallData,
  tokenTransferEventTopic,
} from "@citizenwallet/sdk";
import { CHAIN_ID, EXPLORER_URL, TOKEN_ADDRESS, TOKEN_DECIMALS, TOKEN_SYMBOL } from "./chain";
import { balanceOf } from "./tokens";

/** Same defaults as the bot: the CHT CardManager deployed by Citizen Wallet. */
const ACCOUNT_FACTORY = "0x940Cbb155161dc0C4aade27a4826a16Ed8ca0cb2";
const CARD_MANAGER = process.env.CARD_MANAGER_ADDRESS || "0xBA861e2DABd8316cf11Ae7CdA101d110CF581f28";
const INSTANCE_ID = process.env.CARD_MANAGER_INSTANCE_ID || "cw-discord-1";
const ENTRYPOINT = "0x7079253c0358eF9Fd87E16488299Ef6e06F403B6";
const PAYMASTER = "0xe5Eb4fB0F3312649Eb7b62fba66C9E26579D7208";

/**
 * The key the CardManager trusts — the same one the Discord bot signs with.
 * Without it, paying on the site is off and the bot instructions come back.
 */
export function cardPaymentsConfigured(): boolean {
  const key = process.env.CARD_SIGNER_KEY;
  return !!key && /^(0x)?[0-9a-f]{64}$/i.test(key);
}

function signerKey(): string {
  const key = process.env.CARD_SIGNER_KEY;
  if (!key || !/^(0x)?[0-9a-f]{64}$/i.test(key)) {
    throw new Error("CARD_SIGNER_KEY is not set — it must be the key the CardManager trusts.");
  }
  return key.startsWith("0x") ? key : `0x${key}`;
}

/** The same community shape the bot builds per guild, from our chain config. */
function communityConfig(): CommunityConfig {
  return new CommunityConfig({
    community: {
      name: "Commons Hub Brussels",
      description: "Commons Hub community token",
      alias: "commonshub",
      primary_token: { address: TOKEN_ADDRESS, chain_id: CHAIN_ID },
      primary_account_factory: { address: ACCOUNT_FACTORY, chain_id: CHAIN_ID },
      primary_card_manager: { address: CARD_MANAGER, chain_id: CHAIN_ID },
    },
    tokens: {
      [`${CHAIN_ID}:${TOKEN_ADDRESS}`]: {
        standard: "erc20",
        name: TOKEN_SYMBOL,
        address: TOKEN_ADDRESS,
        symbol: TOKEN_SYMBOL,
        decimals: TOKEN_DECIMALS,
        chain_id: CHAIN_ID,
      },
    },
    accounts: {
      [`${CHAIN_ID}:${ACCOUNT_FACTORY}`]: {
        chain_id: CHAIN_ID,
        entrypoint_address: ENTRYPOINT,
        paymaster_address: PAYMASTER,
        account_factory_address: ACCOUNT_FACTORY,
        paymaster_type: "cw-safe",
      },
    },
    cards: {
      [`${CHAIN_ID}:${CARD_MANAGER}`]: {
        chain_id: CHAIN_ID,
        instance_id: INSTANCE_ID,
        address: CARD_MANAGER,
        type: "safe",
      },
    },
    chains: {
      [String(CHAIN_ID)]: {
        id: CHAIN_ID,
        node: {
          url: `https://${CHAIN_ID}.engine.citizenwallet.xyz`,
          ws_url: `wss://${CHAIN_ID}.engine.citizenwallet.xyz`,
        },
      },
    },
  } as never);
}

export type CardTransferResult =
  | { ok: true; txHash: string; from: string; explorerUrl: string }
  | { ok: false; error: string };

/**
 * Send tokens from a Discord user's card to anywhere — here, a proposal Safe.
 * The person has proven they own the Discord account by signing in with it;
 * the community signer does the on-chain part, exactly as the bot would.
 */
export async function sendFromDiscordUser(input: {
  discordId: string;
  to: string;
  amount: number;
  description?: string;
}): Promise<CardTransferResult> {
  if (!cardPaymentsConfigured()) {
    return { ok: false, error: "Paying on the site is not switched on here yet." };
  }

  try {
    const community = communityConfig();
    const senderHashedId = keccak256(toUtf8Bytes(input.discordId)) as `0x${string}`;

    const from = await getCardAddress(community, senderHashedId);
    if (!from) return { ok: false, error: "We could not find your token account." };

    const held = await balanceOf(from as `0x${string}`);
    if (held < input.amount) {
      return {
        ok: false,
        error: `You hold ${held} ${TOKEN_SYMBOL} — not enough for ${input.amount}.`,
      };
    }

    const signer = new Wallet(signerKey());
    const signerAccountAddress = await getAccountAddress(community, signer.address as `0x${string}`);
    if (!signerAccountAddress) {
      return { ok: false, error: "The community signer has no account on this network." };
    }

    const amountWei = parseUnits(input.amount.toFixed(TOKEN_DECIMALS), TOKEN_DECIMALS);
    const transferCalldata = tokenTransferCallData(input.to, amountWei);
    const calldata = callOnCardCallData(
      community,
      senderHashedId,
      TOKEN_ADDRESS,
      BigInt(0),
      transferCalldata,
    );

    const bundler = new BundlerService(community);
    const txHash = await bundler.call(
      signer as never,
      community.primarySafeCardConfig.address,
      signerAccountAddress,
      calldata,
      BigInt(0),
      {
        topic: tokenTransferEventTopic,
        from,
        to: input.to,
        value: amountWei.toString(),
      },
      input.description ? { description: input.description } : undefined,
    );

    return {
      ok: true,
      txHash,
      from,
      explorerUrl: `${EXPLORER_URL}/tx/${txHash}`,
    };
  } catch (error) {
    console.error("[card] transfer failed:", error);
    return {
      ok: false,
      error: "The transfer did not go through. Nothing was taken — try again in a moment.",
    };
  }
}
