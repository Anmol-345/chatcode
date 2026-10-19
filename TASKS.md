# Build Plan

Work in order. After each phase: `npx tsc --noEmit && npm run lint && npm run build`, tick the boxes, commit.
Read `AGENTS.md` first. Don't skip Phase 0 verification.

## Phase 0 — Scaffold & SDK verification
- [ ] `create-next-app` (App Router, TypeScript, Tailwind, ESLint, `@/*` alias, no `src/`).
- [ ] Install: `@xmtp/browser-sdk @xmtp/content-type-primitives wagmi viem @tanstack/react-query` and dev: `vitest`. **Pin `@xmtp/*` to exact versions.**
- [ ] Make a throwaway page that imports `Client` from `@xmtp/browser-sdk` in a client component and builds successfully (resolves WASM/worker issues — see XMTP_NOTES bundler notes).
- [ ] Walk the "MUST verify" checklist in `docs/XMTP_NOTES.md` against installed types; fill "Verified API (this repo)".
- **Done when:** build passes, checklist filled, versions recorded.

## Phase 1 — Types, codec, storage helpers
- [x] `lib/types.ts`, `lib/codec.ts` per ARCHITECTURE §3 (see deviations below).
- [x] `lib/storage.ts`: `readJSON(key, fallback)`, `writeJSON(key, value)` with try/catch, return success boolean.
- [x] Vitest tests: `normalizeCode`, `isValidCode`, `isAppPayload` (valid/invalid/oversize/wrong kind).
- **Done when:** tests pass.

## Phase 2 — Wallet + XMTP client
- [x] `lib/wagmi.ts` (injected + Coinbase Wallet, mainnet transport for ENS, `ssr: true`).
- [x] `app/providers.tsx`, wire in `app/layout.tsx`.
- [x] `hooks/useXmtp.tsx` per ARCHITECTURE §5 (explicit `init()`, teardown on account change).
- [x] `components/ConnectBar.tsx`: connect buttons, address, Enable messaging, status/error, disconnect.
- **Done when (AC-1, FR-1..5):** connect → single signature → "ready"; reload behavior verified and documented in XMTP_NOTES; switching account resets.

## Phase 3 — Contacts
- [ ] `hooks/useContacts.ts` (hydrate after mount, upsert/remove/label, cross-tab sync, export/import with validation).
- [ ] `lib/ens.ts` (`resolveAddress`, optional reverse lookup).
- [ ] `components/ContactManager.tsx` (add by 0x/ENS + alias, edit alias, delete, reachability check + invite hint, export/import).
- [ ] `lib/invite.ts`: `buildInviteLink(address, code?)`, `parseInviteParams(search)`.
- **Done when (AC-5, AC-6, AC-7, FR-6..11):** contacts persist across reload; ENS resolves; unreachable address handled.

## Phase 4 — XMTP adapter & sending
- [ ] `lib/xmtp.ts`: `canReach`, `getInboxId`, `sendPayload`, `peerInboxOf`, consent helpers (using verified API).
- [ ] `hooks/useChat.ts` send functions (`sendText`, `sendFeedback`) with optimistic `pending` → confirmed/`failed` + retry.
- **Done when:** a message sent from wallet A can be seen in `xmtp.chat` for wallet B (or via Phase 5).

## Phase 5 — History, streaming, ingest
- [ ] `useChat`: `syncAll` → list DMs → load messages → open stream → `ingest` with validation + dedupe + peer resolution.
- [ ] Reconnect with exponential backoff + resync; cleanup on unmount/client change.
- [ ] Pure selectors `codesFor`, `effectiveFeedback` + Vitest tests.
- **Done when (AC-3, FR-18, 19, 22, 23):** two browsers exchange messages under different codes in real time.

## Phase 6 — Chat code UI
- [ ] `ChatCodeSwitcher` (codes from thread + `GENERAL` + create new, count + avg score).
- [ ] `MessagePanel` (filter by active code; distinct feedback rendering; pending/failed states).
- [ ] `FeedbackForm`.
- [ ] `app/page.tsx` composition; deep-link prompt (FR-15) with explicit confirm.
- **Done when (AC-3, AC-4, AC-8, FR-12..17, 20):** per-code organization works end-to-end.

## Phase 7 — Requests (unknown consent)
- [ ] `RequestsDrawer`: list unknown-consent senders; Accept (→ allowed, optionally add contact) / Block.
- **Done when (FR-21):** a message from an unknown wallet doesn't pollute contact threads and can be accepted/blocked.

## Phase 8 — Hardening
- [ ] localStorage failure banner + in-memory fallback; corrupt JSON fallback.
- [ ] Length limits enforced on send & receive; disable send on invalid code.
- [ ] Empty/loading/error states everywhere; keyboard + label a11y pass.
- [ ] `grep -rEi "prisma|mongo|postgres|supabase|firebase|sqlite|drizzle|redis" package.json app lib hooks components` returns nothing.
- [ ] Update `README.md` (setup, run, how chat codes & invite links work, limitations).

## Phase 9 — Manual two-wallet acceptance test
Use two browsers (or one normal + one private window) with two different wallets.
1. A & B connect and enable messaging (note signature counts). Reload both.
2. A adds B (alias "Bob"); B adds A (alias "Alice"). Confirm aliases are private.
3. A sends 10 messages under `ORDER-1`, 3 under `ORDER-2`. Confirm no wallet prompts; B sees correct tabs live.
4. B sends feedback 4★ "delivery" under `ORDER-1`; A sees stars and average update. B sends again 5★; effective review updates.
5. A adds a never-used-XMTP address: invite hint shown; send blocked with message.
6. A adds `somename.eth`: resolves.
7. Open `/?peer=<B>&code=ORDER-9` in a fresh A session: prompt requires confirmation.
8. A disconnects: stream stops, state cleared. Kill network briefly: stream reconnects and resyncs.
9. Verify every AC in SPEC §9; list any deviations in README "Known limitations".
