# ChatCode

Gasless, end-to-end encrypted wallet-to-wallet chat with **chat codes** — a lightweight way to organize
messages and structured feedback (1–5★, category, comment) inside a conversation.

- **No database.** No server, no API routes, no accounts. Fully static-deployable.
- **No gas.** The wallet signs exactly once to register the XMTP client; sending is free.
- **Private by default.** Contacts and aliases live only in your browser (`localStorage`) and are never transmitted.

---

## Setup

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (also type-checks) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npx tsc --noEmit` | Type-check only |

### Environment

All optional — the app works without any environment variables.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_RPC_URL` | Mainnet JSON-RPC endpoint used for **read-only** ENS lookups. Any public endpoint works; use a domain-restricted key if you supply your own. |

ENS resolution is the only chain interaction, and it is a read — it never signs and never sends a transaction.

### Wallet support

MetaMask (injected) and Coinbase Wallet. Click **Connect**, then **Enable messaging** — this triggers the
single signature that registers your XMTP inbox. You are never prompted again when sending.

---

## How it works

### Chat codes

A chat code is a **field inside the message payload**, not a separate conversation. There is exactly one DM
per peer; the UI groups messages by `payload.chatCode`.

- Codes are normalized: trimmed, uppercased, and internal whitespace collapsed to `-`
  (`"  order  1042  "` → `ORDER-1042`).
- A code must match `^[A-Z0-9-]{3,32}$`.
- The switcher lists every code seen in the current thread, with a message count and the average feedback
  score, plus a default `GENERAL` tab.
- Type a new code into the switcher input and press <kbd>Enter</kbd> to create and switch to it.

Chat codes are **labels, not access control** — any participant can send any code.

### Feedback

Send a 1–5★ score with a category (`service`, `communication`, `delivery`, `quality`, `other`) and an optional
comment. Within a code, the latest feedback from each side is shown as the "effective" review. The average
score appears on the code tab.

### Invite links

If you add an address that has never used XMTP, the contact is still saved and an **Invite** hint appears with
a copyable link:

```
/?peer=0xabc…def&code=ORDER-1042
```

Opening that link pre-fills an **"Add contact?"** confirmation prompt and sets the active code. It never
auto-adds a contact and never auto-sends anything — you must confirm.

### Requests (unknown consent)

Messages from wallets you have not allowed yet appear in the **Requests** drawer instead of your contact
threads. You can **Accept**, **Accept & add** (also saves them as a contact), or **Block**.

---

## Architecture

```
Browser A ── one signature ──▶ XMTP Client ◀── one signature ── Browser B
   │                              │                                  │
   ├─ localStorage: contacts     ├─ XMTP network (E2E encrypted)     ├─ localStorage: contacts
   │  and aliases (private)      │                                  │  and aliases (private)
   └─ React state: chat items    └─ SDK local store (OPFS)           └─ React state: chat items
```

```
app/
  layout.tsx        imports globals.css, wraps children in <Providers>
  providers.tsx     "use client": WagmiProvider, QueryClientProvider, XmtpProvider
  page.tsx          3-pane shell, composition only
  globals.css
components/
  ConnectBar.tsx        wallet status, Enable messaging, disconnect
  ContactManager.tsx    add/edit/delete/import/export contacts, invite hint
  ChatCodeSwitcher.tsx  tabs for codes in thread + create new
  MessagePanel.tsx      list + composer + feedback toggle
  FeedbackForm.tsx      score/category/comment
  RequestsDrawer.tsx    unknown-consent senders (accept/block)
  DeepLinkPrompt.tsx    FR-15 "Add contact?" confirmation
hooks/
  useXmtp.tsx     context: client, status, error, init()
  useContacts.ts  localStorage address book
  useChat.ts      history load + live stream + send + selectors
lib/
  types.ts        all shared interfaces
  codec.ts        content type, codec, validators, normalizeCode
  xmtp.ts         SDK adapter — the ONLY place for version-sensitive XMTP calls
  wagmi.ts        wagmi config
  ens.ts          resolveAddress / reverse lookup
  invite.ts       build/parse deep links
  storage.ts      safe localStorage helpers (try/catch, in-memory fallback)
```

All version-sensitive XMTP SDK calls live in `lib/xmtp.ts`. `docs/XMTP_NOTES.md` records the exact SDK
versions in use and any deviations from the reference snippets.

---

## Privacy & security

- Messages are validated with `isAppPayload` before they touch state or the UI, and are rendered as plain
  React text nodes (never `dangerouslySetInnerHTML`).
- Length limits are enforced **on send and on receive**: message text ≤ 4000 characters, feedback comment
  ≤ 2000 characters.
- Aliases never leave the browser.
- The Browser SDK does not use `dbEncryptionKey` for local encryption, so do not claim at-rest encryption of
  local history. Local history is stored in the browser's OPFS-backed SDK store.

---

## Known limitations

- **Local history is per installation.** Clearing site data creates a new installation with an empty history.
- **No message search, editing, or deletion.** No group chats, attachments, or reactions in v1.
- **ENS lookups are read-only and mainnet-only.** An ENS name that does not resolve, or an invalid address, is
  rejected with a readable error.
- **The wallet is used only for one signature** and read-only ENS calls — never for on-chain transactions.
- **A browser signature rejection** surfaces as "Signature rejected" with a retry button.
- **Switching accounts mid-session** tears down the XMTP client and resets in-memory chat state.
- **`localStorage` may be unavailable** (private mode, quota exceeded). The app shows a non-blocking warning
  and keeps working with an in-memory store for the session; contacts will not persist across reloads.
- **Corrupt `localStorage` JSON** falls back to an empty address book instead of crashing.
- **The "effective review"** is the latest feedback per sender per code, ordered by network timestamp.
- **Shared public chat codes** are not access control; both sides can see and use any code.

---

## Acceptance criteria

The full acceptance checklist lives in `docs/SPEC.md` §9, and the manual two-wallet test procedure is in
`docs/TASKS.md` (Phase 9). Run it with two browsers (or one normal + one private window) and two different
wallets.
