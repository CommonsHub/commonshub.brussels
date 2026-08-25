import { describe, expect, test } from "@jest/globals"
import { formatAddress, fromSite, fromSubmitter, SITE_DOMAIN } from "@/lib/email-address"

describe("email addresses", () => {
  test("a form submission is sent as the person, via the site", () => {
    expect(fromSubmitter("Xavier")).toBe(
      `"Xavier via ${SITE_DOMAIN}" <hello@commonshub.brussels>`,
    )
  })

  test("falls back to the hub's own name when the form has no name", () => {
    expect(fromSubmitter("")).toBe("Commons Hub Brussels <hello@commonshub.brussels>")
    expect(fromSubmitter(undefined)).toBe(fromSite())
  })

  test("a reply reaches the person, by name and address", () => {
    expect(formatAddress("Jane Doe", "jane@example.com")).toBe(
      '"Jane Doe" <jane@example.com>',
    )
  })

  test("an address with no name stays a bare address", () => {
    expect(formatAddress("", "jane@example.com")).toBe("jane@example.com")
  })

  test("a name cannot smuggle extra headers in", () => {
    const injected = "Jane\r\nBcc: everyone@example.com"
    expect(formatAddress(injected, "jane@example.com")).toBe(
      '"Jane Bcc: everyone@example.com" <jane@example.com>',
    )
    expect(fromSubmitter(injected)).not.toMatch(/[\r\n]/)
  })

  test("a name cannot close the quoted string", () => {
    expect(formatAddress('Jane" <evil@example.com>, "x', "jane@example.com")).toBe(
      '"Jane <evil@example.com>, x" <jane@example.com>',
    )
  })

  test("a very long name is trimmed rather than sent whole", () => {
    const from = fromSubmitter("A".repeat(200))
    expect(from).toBe(`"${"A".repeat(64)} via ${SITE_DOMAIN}" <hello@commonshub.brussels>`)
  })
})
