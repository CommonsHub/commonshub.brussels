/**
 * The chain config: env overrides win, settings.json is the default, and the
 * staging cap reads as a number or not at all.
 */

const ENV_KEYS = [
  "TOKEN_CHAIN_ID",
  "TOKEN_RPC_URL",
  "CELO_RPC_URL",
  "TOKEN_EXPLORER_URL",
  "TOKEN_ADDRESS",
  "TOKEN_DECIMALS",
  "TOKEN_SYMBOL",
  "TOKEN_CHAIN_NAME",
  "MAX_TOKEN_CONTRIBUTION",
];

function freshChain() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/modules/payments/chain") as typeof import("@/modules/payments/chain");
}

describe("the chain config", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("defaults to what settings.json says: CHT on Celo", () => {
    const chain = freshChain();
    expect(chain.CHAIN_ID).toBe(42220);
    expect(chain.TOKEN_ADDRESS.toLowerCase()).toBe("0x65dd32834927de9e57e72a3e2130a19f81c6371d");
    expect(chain.TOKEN_DECIMALS).toBe(6);
    expect(chain.TOKEN_SYMBOL).toBe("CHT");
    expect(chain.chain.id).toBe(42220);
  });

  it("lets the environment point it somewhere else entirely", () => {
    process.env.TOKEN_CHAIN_ID = "44787"; // Alfajores
    process.env.TOKEN_RPC_URL = "https://alfajores.example.org";
    process.env.TOKEN_ADDRESS = "0x1111111111111111111111111111111111111111";
    process.env.TOKEN_SYMBOL = "tCHT";

    const chain = freshChain();
    expect(chain.CHAIN_ID).toBe(44787);
    expect(chain.chain.id).toBe(44787);
    expect(chain.RPC_URL).toBe("https://alfajores.example.org");
    expect(chain.TOKEN_ADDRESS).toBe("0x1111111111111111111111111111111111111111");
    expect(chain.TOKEN_SYMBOL).toBe("tCHT");
  });

  it("has no cap unless one is set, and ignores nonsense", () => {
    expect(freshChain().maxTokenContribution()).toBeNull();

    process.env.MAX_TOKEN_CONTRIBUTION = "2";
    expect(freshChain().maxTokenContribution()).toBe(2);

    process.env.MAX_TOKEN_CONTRIBUTION = "0";
    expect(freshChain().maxTokenContribution()).toBeNull();

    process.env.MAX_TOKEN_CONTRIBUTION = "plenty";
    expect(freshChain().maxTokenContribution()).toBeNull();
  });
});
