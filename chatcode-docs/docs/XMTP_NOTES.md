# XMTP Notes

Primary docs: https://docs.xmtp.org/chat-apps/sdks/browser (Browser SDK), https://docs.xmtp.org/upgrade-to-v3 (V3 migration).
`llms-full.txt` from docs.xmtp.org can be fetched as additional context. Test with https://xmtp.chat.

## Facts (from docs at time of writing — re-verify against installed version)
- Use `@xmtp/browser-sdk` (XMTP V3). Legacy V2 SDKs are obsolete; ignore any V2 examples (`findOrCreateDm(address)` style, `contacts.consentList`, key bundles).
- Signer shape (EOA):
  ```ts
  const signer: Signer = {
    type: "EOA",
    getIdentifier: () => ({ identifier: "0x…", identifierKind: IdentifierKind.Ethereum }),
    signMessage: async (message: string): Promise<Uint8Array> => /* sign, return bytes */,
  };
  ```
- `Client.create(signer, options)` checks the identity ledger for an inbox, registers if needed, and creates a new installation **if no local DB exists**. It reuses the local DB otherwise.
- In the Browser SDK, `dbEncryptionKey` is **not** used for encryption (browser limitation). Don't rely on it.
- Conversations API: `client.conversations.list/listDms/listGroups({ consentStates })`, `streamAllMessages({...})`, `syncAll(["allowed"])`. Docs have shown both `newGroup` and `createGroup` across versions → names drift. DMs: look for `createDmWithIdentifier` (address-based) / `createDm` (inboxId-based).
- Consent states: allowed / unknown / denied. Unknown = new inbound senders; surface as "Requests".
- Custom content types: implement `ContentCodec`, register in `codecs: []` on client creation; provide `fallback()` so other apps show readable text.
- Installation limit per inbox exists (10 at last check). Clearing site data creates a new installation.
- Local history is per installation; a new browser won't necessarily have old messages.

## Things the agent MUST verify in the installed package (then record below)
- [ ] Exact signature/return of `Client.canMessage` (static vs instance; arguments; Map keys)
- [ ] `createDmWithIdentifier` argument shape and error thrown for unregistered identity
- [ ] `fetchInboxIdByIdentifier` (or equivalent) name/arguments
- [ ] `streamAllMessages` options (`onValue`/`onError`/`consentStates`) vs async-iterator style; how to end the stream
- [ ] `message` fields: `id`, `conversationId`, `senderInboxId`, `sentAtNs` (bigint?), `contentType`, `content`
- [ ] How to get a DM's peer inbox id (`peerInboxId()` method vs property)
- [ ] Whether a signature is requested again on reload when a local installation exists (FR-3)
- [ ] How to set consent (accept/block) for a conversation/inbox
- [ ] Whether `client.close()` exists and what it does

## Bundler notes (Next.js)
- The SDK uses WASM + a web worker. Import it only in client components; if needed use `dynamic(() => import(...), { ssr: false })`.
- If the build fails to resolve WASM/worker assets: try `config.experiments = { ...config.experiments, asyncWebAssembly: true }` in `next.config.ts` (webpack), and check the SDK README/issues for current Next.js guidance. If Turbopack is problematic, run dev with `next dev --webpack` and note it here.

## Verified API (this repo) — agent fills in
```
@xmtp/browser-sdk: <exact version>
@xmtp/content-type-primitives: <exact version>
(record confirmed method names/signatures and deviations from REFERENCE_IMPLEMENTATION.md here)
```
