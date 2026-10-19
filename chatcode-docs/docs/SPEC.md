# ChatCode — Product Spec

## 1. Summary
A lightweight web app where two wallet owners chat over XMTP (gasless, end-to-end encrypted) and attach **chat codes** (e.g. `ORDER-1042`) to conversations. Within a chat code, users can exchange normal messages and structured **feedback** (1–5 score, category, comment). The UI organizes the thread by chat code. There is **no app database**; contacts/aliases live in the browser.

## 2. Goals
- Gasless, seamless messaging (no per-message wallet prompt or gas).
- Zero centralized storage: XMTP network + browser storage only.
- Chat-code-based organization of messages and feedback.
- Sub-second real-time updates via XMTP streams.
- Small, readable codebase.

## 3. Non-goals (v1)
- Public/aggregated reputation across many users (would need a shared store or on-chain attestations).
- Group chats (DMs only), attachments, reactions, push notifications.
- Mobile apps, server-side anything, user accounts outside wallets.
- Message search, editing, deletion.

## 4. Users & primary scenarios
- **Provider/Seller** shares a link with a chat code after a job/order; client opens it, chats, and leaves feedback under that code.
- **Peer reviewer** exchanges notes with a counterparty about a specific reference ID.

## 5. Functional requirements

### Wallet & XMTP init
- **FR-1** Connect via EVM wallets (injected e.g. MetaMask, and Coinbase Wallet).
- **FR-2** After connecting, user clicks "Enable messaging" → one signature request initializes the XMTP client. No automatic signing on page load.
- **FR-3** On reload with an existing local XMTP installation, no new signature should be required (verify; document result in `XMTP_NOTES.md`).
- **FR-4** Changing/disconnecting the wallet tears down the client and streams and resets UI state.
- **FR-5** Show clear states: disconnected, ready-to-enable, initializing, ready, error (with message + retry).

### Contacts / address book
- **FR-6** Add a contact by `0x` address or ENS name; assign an alias (defaults to input).
- **FR-7** Contacts persist in `localStorage` (key `chatcode:contacts:v1`), keyed by lowercase address; edit alias; delete.
- **FR-8** On add, check whether the address can receive XMTP messages; if not, still save but show an "Invite" hint with a copyable invite link.
- **FR-9** Contacts sync across tabs (via `storage` event).
- **FR-10** Export/import contacts as JSON (validated on import).
- **FR-11** Display precedence: alias → ENS name → shortened address (`0x1234…abcd`).

### Chat codes
- **FR-12** A chat code is normalized (trim, uppercase, spaces→`-`) and must match `^[A-Z0-9-]{3,32}$`.
- **FR-13** Within a selected contact's thread, a chat-code switcher lists all codes seen in that thread (with message count and average feedback score) plus a `GENERAL` default, and lets the user create a new code.
- **FR-14** The message panel shows only items whose `chatCode` equals the active code.
- **FR-15** Deep link `/?peer=<0xaddress>&code=<CODE>` pre-fills an "Add contact?" prompt and sets the active code. It must never auto-add a contact or auto-send anything.

### Messaging & feedback
- **FR-16** Send a text message tagged with the active chat code.
- **FR-17** Send a feedback item: `score` 1–5, `category`, `text` (comment optional), tagged with the active chat code.
- **FR-18** Incoming messages appear in real time via XMTP stream; history loads on startup via sync + list.
- **FR-19** Messages dedupe by message ID; ordering uses the network timestamp, not the sender-supplied `clientTs`.
- **FR-20** Feedback renders distinctly (stars + category). Per code, show the latest feedback from each side as the "effective" review.
- **FR-21** Messages from non-contacts (unknown consent) are shown in a separate "Requests" area with Accept / Block, not mixed into contact threads.
- **FR-22** Invalid/unknown payloads from other XMTP apps are ignored in the chat-code UI without crashing.

### Resilience
- **FR-23** Stream errors trigger reconnect with exponential backoff, followed by a re-sync.
- **FR-24** Sending shows pending / failed states, with retry on failure.

## 6. Non-functional requirements
- TypeScript strict, no `any` outside the SDK adapter.
- No database dependency in `package.json`; no server routes needed.
- Works in current Chrome, Firefox, Safari (note any SDK limitation found).
- Payload limits: text ≤ 4000 chars, feedback comment ≤ 2000 chars (enforced on send and receive).
- Bundle: XMTP client code loaded client-side only (no SSR import).

## 7. UX outline
Three-pane layout: **Contacts** (left) · **Thread** (center: chat-code switcher on top, messages, composer with "★ Feedback" toggle) · optional **Requests** drawer. Top bar: wallet status, "Enable messaging" CTA, disconnect.

## 8. Edge cases to handle
- Recipient not on XMTP (FR-8, send-time error message).
- ENS name that doesn't resolve / invalid address.
- Wallet rejects signature.
- User switches accounts mid-session.
- localStorage unavailable/quota exceeded (show non-blocking warning; app keeps working in memory).
- Corrupt `localStorage` JSON (fall back to empty book, don't crash).
- Same message arriving from both history and stream (dedupe).
- Very long chat code or text.

## 9. Acceptance criteria
- **AC-1** Fresh browser, connect wallet → one signature → ready. Reload → ready without a new signature (or documented deviation).
- **AC-2** Send 10 messages: zero wallet prompts, zero gas.
- **AC-3** Two browsers/wallets: A sends under `ORDER-1` and `ORDER-2`; B sees them in the correct code tabs within ~1s without refreshing.
- **AC-4** Feedback sent under `ORDER-1` shows stars/category in both clients and updates the code's average in the switcher.
- **AC-5** Alias set for a contact is shown in lists/messages, persists after reload, and is not visible to the other party.
- **AC-6** Adding an address that has never used XMTP shows the invite hint and does not crash; sending to it shows a readable error.
- **AC-7** ENS name resolves to an address when adding a contact.
- **AC-8** Deep link prefills code/peer but requires confirmation.
- **AC-9** Disconnecting the wallet stops the stream and clears in-memory chat state.
- **AC-10** `npm run build` passes; no DB/ORM packages present.
