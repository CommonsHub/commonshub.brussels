/**
 * Addresses for the mails the site sends.
 *
 * Every form on the site mails hello@commonshub.brussels from the hub's own
 * address — the domain is what Resend is allowed to send for. That leaves the
 * inbox full of identical senders, so the person who filled the form is put in
 * the display name instead: "Xavier via commonshub.brussels", with a Reply-To
 * that carries their name as well as their address.
 *
 * The name comes from a public form, so it is treated as hostile: newlines and
 * quotes are stripped before it reaches a header.
 */

import settings from "@/settings/settings.json"

/** The site itself, as it should read in a From line. */
export const SITE_DOMAIN = settings.email.from.split("@")[1] ?? "commonshub.brussels"

const SITE_NAME = "Commons Hub Brussels"

/**
 * A display name safe to put in a header: no CRLF (header injection), no
 * quotes or backslashes (they would end the quoted string), no runaway length.
 */
function displayName(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/["\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64)
}

/** Likewise for the address half: an address never contains these. */
function bareAddress(raw: string): string {
  return raw.replace(/[\r\n<>,;]/g, "").trim()
}

/**
 * `"Jane Doe" <jane@example.com>`, or just the address when there is no name.
 */
export function formatAddress(name: string | null | undefined, email: string): string {
  const label = displayName(name)
  const address = bareAddress(email)
  return label ? `"${label}" <${address}>` : address
}

/**
 * The From line for a form submission: the sender's name, then the site, over
 * the hub's own address. Falls back to the hub's own name when the form did
 * not ask for one.
 */
export function fromSubmitter(
  name: string | null | undefined,
  address: string = settings.email.from,
): string {
  const label = displayName(name)
  return label
    ? `"${label} via ${SITE_DOMAIN}" <${bareAddress(address)}>`
    : `${SITE_NAME} <${bareAddress(address)}>`
}

/** The From line for mail the hub sends in its own voice. */
export function fromSite(address: string = settings.email.from): string {
  return `${SITE_NAME} <${bareAddress(address)}>`
}
