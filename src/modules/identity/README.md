# Identity module

Sign in with an email address or a Discord account, then act on the site without
ever holding a key you could lose — and without the site holding a key it could
leak to a browser.

It is a standalone module: everything it owns lives under `src/modules/identity`
and `src/app/api/identity`. Nothing outside it needs to know how signing works.

## The two keys

| | Account key | Session key |
|---|---|---|
| Created | on the server, at first sign-in | in the browser, when a session starts |
| Stored | encrypted at rest (AES-256-GCM) | `sessionStorage`, in that tab only |
| Leaves its machine | never | never |
| Used for | signing what you say and do | proving a request comes from your browser |

Neither key crosses the wire. A private key never leaves the device that
generated it, which is the property we actually want — the server can act for
you, but only when a browser that signed in asks it to.

## The flow

```
browser                                  server
   │  generate session key (stays here)
   │
   │  POST /api/identity/login/email  { email, sessionPubkey }
   │ ─────────────────────────────────────────►  remember the pending link
   │                                             email a one-time link
   │  click the link
   │  GET /api/identity/verify?token=…
   │ ─────────────────────────────────────────►  create the account if new,
   │                                             bind session ↔ account,
   │ ◄─────────────────────────────────────────  set the session cookie
   │
   │  POST /api/identity/sign { template, envelope }
   │      envelope = event signed by the session key,
   │      committing to a hash of `template`
   │ ─────────────────────────────────────────►  verify the envelope,
   │                                             sign `template` with the
   │ ◄─────────────────────────────────────────  account key, return it
```

Discord works the same way, with the existing Discord sign-in standing in for
the emailed link: `POST /api/identity/login/discord` binds the browser's session
key to the account and brings the person's Discord roles across, which is how
stewards get their badge.

## Why an envelope rather than just the cookie

The cookie says *this browser has a session*. The envelope says *this browser
still holds the key that opened it, and this is exactly the content it asked to
sign*. The envelope commits to a hash of the content, so a captured request
cannot be replayed with something else inside it, and it expires after five
minutes.

## Configuration

| Variable | Meaning |
|---|---|
| `IDENTITY_ENCRYPTION_KEY` | 64 hex chars. Encrypts account keys at rest. Generated into `IDENTITY_DIR/encryption.key` if unset, with a warning. |
| `IDENTITY_DIR` | Where accounts, sessions and the key file live. Defaults to `.data/identity`. |
| `RESEND_API_KEY` | Sends the sign-in link. Without it, links are logged instead of sent. |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord sign-in, already used by the rest of the site. |

## Related work

Modelled on [OpenBunker](https://github.com/OpenCollective/openbunker), which
does custodial key management behind a social login and speaks NIP-46 to remote
signers. This module keeps the same custody model and the same "sign on behalf"
API surface, but stays in-process: signing is a function call rather than a
round trip to a bunker over a relay. If the hub later runs a bunker, `signOnBehalf`
is the one function that has to change.

## What this module deliberately does not do

- It does not put the account key in the browser, ever — not even briefly.
- It does not let one browser sign for a session another browser opened.
- It does not expose keys through any API. `publicProfile()` is the whole of
  what a client can learn about an account.
