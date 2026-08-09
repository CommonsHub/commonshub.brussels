import {
  encodeMultiFilterParam,
  parseMultiFilterParam,
  toggleMultiFilterValue,
  valueMatchesMultiFilter,
  accountFilterSlug,
} from "@/lib/finance-transaction-filters";

describe("finance transaction multi filters", () => {
  it("parses comma-separated URL params into trimmed unique values", () => {
    expect(parseMultiFilterParam(null)).toEqual([]);
    expect(parseMultiFilterParam("commonshub, stripe,,commonshub ")).toEqual([
      "commonshub",
      "stripe",
    ]);
  });

  it("encodes multi filter values for stable URLs", () => {
    expect(encodeMultiFilterParam(["stripe", "commonshub"])).toBe(
      "stripe,commonshub"
    );
    expect(encodeMultiFilterParam([])).toBeNull();
  });

  it("toggles individual values without losing other selected values", () => {
    expect(toggleMultiFilterValue(["commonshub"], "stripe")).toEqual([
      "commonshub",
      "stripe",
    ]);
    expect(toggleMultiFilterValue(["commonshub", "stripe"], "commonshub")).toEqual([
      "stripe",
    ]);
  });

  it("matches all rows when no values are selected and otherwise uses OR semantics", () => {
    expect(valueMatchesMultiFilter("stripe", [])).toBe(true);
    expect(valueMatchesMultiFilter("stripe", ["stripe", "checking"])).toBe(true);
    expect(valueMatchesMultiFilter("savings", ["stripe", "checking"])).toBe(false);
  });

  it("uses configured account slugs instead of provider-native account ids", () => {
    expect(
      accountFilterSlug({
        accountSlug: "acct_1Nn0FaFAhaWeDyow",
        accountId: "stripe:acct_1Nn0FaFAhaWeDyow",
      })
    ).toBe("stripe");
    expect(
      accountFilterSlug({
        accountSlug: "0xd578e7cd845e1ecd979b04784e77068d5ebd8716",
        accountId: "ethereum:100:address:0xD578e7cd845e1ecD979b04784e77068D5eBd8716",
      })
    ).toBe("checking");
    expect(accountFilterSlug({ accountSlug: "fridge" })).toBe("fridge");
  });
});
