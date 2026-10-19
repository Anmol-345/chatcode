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
@xmtp/browser-sdk: 7.1.0
@xmtp/content-type-primitives: 3.0.1
wagmi: 2.19.5  viem: 2.57.7  @tanstack/react-query: 5.104.4  vitest: 5.0.5

Installed @xmtp/wasm-bindings (transitive, resolves @xmtp/node-bindings for ContentTypeId/EncodedContent).

Confirmed method names/signatures (from node_modules/@xmtp/browser-sdk/dist/index.d.ts):

- Signer = { type: "EOA"; getIdentifier: () => Identifier | Promise<Identifier>; signMessage: (message: string) => Uint8Array | Promise<Uint8Array> } | { type: "SCW"; getIdentifier; signMessage; getChainId: () => bigint; getBlockNumber?: () => bigint }
- Identifier = { identifier: string; identifierKind: IdentifierKind }  (IdentifierKind: Ethereum=0, Passkey=1)
- Client.create(signer: Signer, options?: Omit<ClientOptions,"codecs"> & { codecs?: ContentCodec[] }): Promise<Client>
- Client.close(): void  (shutdown; reference uses clientRef.current?.close() ✓)
- Client.canMessage(identifiers: Identifier[]): Promise<Map<string, boolean>>   (instance)
- static Client.canMessage(identifiers: Identifier[], backend?: Backend): Promise<Map<string, boolean>>   (non-deprecated)
- static Client.canMessage(identifiers, env?: XmtpEnv): Promise<Map<string, boolean>>   (DEPRECATED — reference's "production" string overload still type-checks but is deprecated)
- client.fetchInboxIdByIdentifier(identifier: Identifier): Promise<string | undefined>   (INSTANCE method — reference uses client.fetchInboxIdByIdentifier(id(to)) ✓)
- client.conversations.createDmWithIdentifier(identifier: Identifier, options?: CreateDmOptions): Promise<Dm>   (CreateDmOptions = { messageDisappearingSettings? } only)
- client.conversations.createDm(inboxId: string, options?: CreateDmOptions): Promise<Dm>
- client.conversations.listDms(options?: Omit<ListConversationsOptions,"conversationType">): Promise<Dm[]>
- client.conversations.syncAll(consentStates?: ConsentState[]): Promise<void>
- client.conversations.getConversationById(id): Promise<Group | Dm | undefined>
- client.conversations.getDmByInboxId(inboxId): Promise<Dm | undefined>
- client.conversations.fetchDmByIdentifier(identifier): Promise<Dm | undefined>
- client.conversations.streamAllMessages(options?: StreamOptions<DecodedMessage, DecodedMessage> & { conversationType?; consentStates?: ConsentState[] }): Promise<AsyncStreamProxy<DecodedMessage>>
      AsyncStreamProxy: { next(), return(), end(): Promise, isDone: boolean } + [Symbol.asyncIterator]
      StreamOptions: onValue, onError, onFail, onEnd, onRestart, onRetry, retryAttempts (default 6), retryDelay (default 10000), disableSync
      End the stream via stream.end() — reference's `void stream?.end()` ✓ compatible (NOT the older callback/StreamCloser style on the public API)
- Dm.peerInboxId(): Promise<string>   (METHOD, async — reference awaits (convo as Dm).peerInboxId() ✓)
- DecodedMessage fields: id: string; conversationId: string; senderInboxId: string; sentAtNs: bigint; sentAt: Date; contentType: ContentTypeId; content: unknown; deliveryStatus; expiresAtNs?: bigint; fallback?; kind; numReplies: bigint; reactions
- client.conversations.list / listGroups / listDms return Conversation[] (safe-wrapped); worker-level WorkerConversations.stream* use StreamCloser callback style (internal, not the public API)
- client.preferences.setConsentStates(records: Consent[]): Promise<void>; getConsentState(entityType: ConsentEntityType, entity): Promise<ConsentState>
- conversation.updateConsentState(state: ConsentState): Promise<void>
- ConsentState enum: Unknown=0, Allowed=1, Denied=2; ConsentEntityType: GroupId=0, InboxId=1
- ContentCodec = { contentType: ContentTypeId; encode(content): EncodedContent; decode(content): ContentType; fallback(content): string | undefined; shouldPush: (content) => boolean }   (reference ChatCodeCodec matches ✓)
- ClientOptions.env: XmtpEnv = "local"|"dev"|"production"|"testnet-staging"|"testnet-dev"|"testnet"|"mainnet"; appVersion?: string; dbEncryptionKey?: Uint8Array (browser: not used for encryption)

Signature/reload (FR-3): Client.create(signer, options) checks the identity ledger/local DB; reuses local DB when present → no new signature on reload when a local installation exists (per SDK docs fact; type-level: create takes a signer, so a signer is required to construct, but registration reuse is handled client-side by the SDK).

Deviations from REFERENCE_IMPLEMENTATION.md (adapt inside lib/xmtp.ts; all noted):
1. Client.canMessage with a bare "production" env string is the DEPRECATED static overload. Prefer instance client.canMessage(identifiers) or static Client.canMessage(identifiers, backend) with createBackend(). canReach() in lib/xmtp.ts should use the instance method when a client exists, or static with Backend for pre-client reach checks.
2. streamAllMessages public API is async-iterator/options style (AsyncStreamProxy, stream.end()), NOT callback/StreamCloser. Reference usage (onValue/onError + stream.end()) is compatible; no code change needed, just confirm options-based call.
3. fetchInboxIdByIdentifier, createDmWithIdentifier, peerInboxId(), close(), canMessage, setConsentStates/updateConsentState all confirmed present — reference calls type-check against 7.1.0 with no signature changes.

Next step: throwaway client-component page importing Client from @xmtp/browser-sdk must build (WASM/worker bundling). See Bundler notes.
```
