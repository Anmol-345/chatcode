# ChatCode — Agent Instructions

Gasless wallet-to-wallet chat app with feedback/reviews organized by "chat codes".
Built on XMTP. **No backend database. No gas per message.**

Read these before writing any code (in this order):
1. `docs/SPEC.md` — what to build, requirements, acceptance criteria
2. `docs/ARCHITECTURE.md` — data model, payload contracts, module boundaries
3. `docs/XMTP_NOTES.md` — SDK facts, version caveats, what to verify
4. `docs/TASKS.md` — phased build plan; work through it in order
5. `docs/REFERENCE_IMPLEMENTATION.md` — starting-point code (a sketch, NOT guaranteed to compile)

## Hard constraints (never violate)
1. **No database of any kind.** No Postgres, MongoDB, Prisma, Supabase, Firebase, Redis, SQLite-on-server, etc.
2. **No per-message gas / on-chain transactions.** Wallet is used only for a one-time signature to register the XMTP client (and read-only ENS lookups).
3. **State lives in:** XMTP network + the SDK's local store (managed by the SDK), `localStorage` (contacts/aliases only), and React state.
4. **Do not store messages in `localStorage`.** Contacts and small UI prefs only.
5. **Server code:** none required. Do not add API routes unless a task explicitly says so. No secrets on the server; the app is fully static-deployable.
6. **Never trust remote data.** Every incoming payload is validated (`isAppPayload`) before it touches state or UI. Render as plain text; never use `dangerouslySetInnerHTML`.

## Stack
- Next.js (App Router) + TypeScript (`strict: true`) + Tailwind CSS
- `@xmtp/browser-sdk` (+ `@xmtp/content-type-primitives`)
- `wagmi` v2 + `viem` + `@tanstack/react-query` (wallet connection, ENS)
- No other runtime dependencies without a stated reason in the PR/commit message

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Typecheck: `npx tsc --noEmit`
- Lint: `npm run lint`
- Build: `npm run build`

After **each task** in `docs/TASKS.md`, run typecheck + lint + build. Do not move on while any fail.

## Conventions
- Every file that touches wagmi, XMTP, `window`, or `localStorage` starts with `"use client"`.
- Import path alias: `@/` → project root.
- Directory layout is defined in `docs/ARCHITECTURE.md` §Project structure. Don't invent new top-level folders.
- **All XMTP SDK calls that are version-sensitive live in `lib/xmtp.ts`** (the adapter). Hooks/components must not call the SDK directly except through the `Client` instance passed in via context, and only for stable, documented calls.
- Hooks return plain data + callbacks. Components stay presentational where possible.
- Use named exports for components/hooks except `app/` route files.
- Use `async/await`; always handle errors and surface them in the UI (no silent `catch {}` except for localStorage parse fallbacks).
- Chat codes are always passed through `normalizeCode()` before send/compare; validated with `isValidCode()`.
- Accessibility basics: labelled inputs, buttons are `<button>`, visible focus.

## SDK rules (important)
- **Do not guess XMTP APIs.** The SDK changes between versions. Before using a method:
  1. Check the installed package's TypeScript types in `node_modules/@xmtp/browser-sdk`.
  2. Cross-check https://docs.xmtp.org/chat-apps/sdks/browser
  3. If a method in the reference code doesn't exist, adapt it inside `lib/xmtp.ts` and note the change in `docs/XMTP_NOTES.md` under "Verified API (this repo)".
- Pin `@xmtp/*` packages to **exact versions** (no `^`/`~`) in `package.json` and record them in `docs/XMTP_NOTES.md`.

## Workflow
- Work one phase of `docs/TASKS.md` at a time; tick checkboxes as you finish; commit after each phase with a clear message.
- If a requirement is ambiguous or conflicts with a hard constraint, stop and ask rather than choosing silently.
- Keep changes minimal and scoped to the current task. No drive-by refactors.
- Don't add tests frameworks/CI unless a task asks; do add the small pure-function unit tests listed in TASKS Phase 8 (use Vitest).

## Definition of done (whole project)
All acceptance criteria in `docs/SPEC.md` §Acceptance criteria pass in the two-wallet manual test in `docs/TASKS.md` Phase 9, `npm run build` succeeds, and a repo-wide search finds no database/ORM dependencies.
