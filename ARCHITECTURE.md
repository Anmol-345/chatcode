# ChatCode — Architecture

## 1. Data flow (no database)

```
┌──────────────── Browser A ────────────────┐        ┌──────────────── Browser B ────────────────┐
│ wagmi/viem ─ one signature ─▶ XMTP Client │        │ XMTP Client ◀─ one signature ─ wagmi/viem │
│ localStorage: contacts/aliases (private)  │        │ localStorage: contacts/aliases (private)  │
│ SDK local store (OPFS): decrypted history │ E2E    │ SDK local store (OPFS): decrypted history │
│ React state: ChatItem index by chat code  │◀──────▶│ React state: ChatItem index by chat code  │
└───────────────────────────────────────────┘ XMTP   └───────────────────────────────────────────┘
                                              nodes
                                        (relay encrypted only)
```

- Messages: sender → XMTP network (encrypted) → recipient stream. No app server.
- Aliases: browser-local only; never transmitted.
- Chat code: a **field in the payload**, not a separate conversation. One DM per peer; UI groups by `payload.chatCode`.
- Identity: XMTP `inboxId` per user; wallet address is mapped to an `inboxId` (cached on the contact).
- ENS: read-only mainnet lookup via viem; always store the resolved `0x` address.

## 2. Project structure

```
app/
  layout.tsx              # imports globals.css, wraps children in <Providers>
  providers.tsx           # "use client": WagmiProvider, QueryClientProvider, XmtpProvider
  page.tsx                # 3-pane shell, composition only
  globals.css
components/
  ConnectBar.tsx          # wallet status, Enable messaging, disconnect
  ContactManager.tsx      # add/edit/delete/import/export contacts, invite hint
  ChatCodeSwitcher.tsx    # tabs for codes in thread + create new
  MessagePanel.tsx        # list + composer
  FeedbackForm.tsx        # score/category/comment
  RequestsDrawer.tsx      # unknown-consent senders (accept/block)
hooks/
  useXmtp.tsx             # context: client, status, error, init()
  useContacts.ts          # localStorage address book
  useChat.ts              # history load + live stream + send + selectors
lib/
  types.ts                # all shared interfaces (below)
  codec.ts                # content type, codec, validators, normalizeCode
  xmtp.ts                 # SDK adapter — ONLY place for version-sensitive calls
  wagmi.ts                # wagmi config
  ens.ts                  # resolveAddress / reverse lookup
  invite.ts               # build/parse deep links
  storage.ts              # safe localStorage helpers (try/catch, versioning)
docs/ …
```

## 3. Data model & contracts (source of truth)

```ts
// lib/types.ts
export type Address = `0x${string}`;
export type ChatCode = string; // normalized, /^[A-Z0-9-]{3,32}$/

export interface Contact {
  address: Address;        // lowercase; also the map key
  alias: string;
  ensName?: string;
  inboxId?: string;        // cached after first XMTP lookup
  reachable?: boolean;     // last known XMTP reachability
  createdAt: number;       // ms
  updatedAt: number;       // ms
}
export interface ContactBook {
  version: 1;
  contacts: Record<string, Contact>;
}

export type FeedbackCategory = "service" | "communication" | "delivery" | "quality" | "other";

interface PayloadBase { v: 1; chatCode: ChatCode; clientTs: number } // clientTs is informational only
export interface TextPayload extends PayloadBase { kind: "message"; text: string }
export interface FeedbackPayload extends PayloadBase {
  kind: "feedback";
  score: 1 | 2 | 3 | 4 | 5;
  category: FeedbackCategory;
  text: string;
}
export type AppPayload = TextPayload | FeedbackPayload;

export interface ChatItem {
  id: string;              // XMTP message id (dedupe key)
  peerInboxId: string;
  mine: boolean;
  sentAt: number;          // ms, from network timestamp (sentAtNs / 1e6)
  status?: "pending" | "failed";
  payload: AppPayload;
}
```

```ts
// lib/codec.ts
import { ContentTypeId, type ContentCodec, type EncodedContent } from "@xmtp/content-type-primitives";
import type { AppPayload } from "./types";

export const ContentTypeChatCode = new ContentTypeId({
  authorityId: "chatcode.app", typeId: "envelope", versionMajor: 1, versionMinor: 0,
});

export const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "-");
export const isValidCode = (s: string) => /^[A-Z0-9-]{3,32}$/.test(s);

export function isAppPayload(x: any): x is AppPayload {
  if (!x || x.v !== 1 || !isValidCode(x.chatCode) || typeof x.clientTs !== "number") return false;
  if (x.kind === "message") return typeof x.text === "string" && x.text.length > 0 && x.text.length <= 4000;
  if (x.kind === "feedback")
    return [1, 2, 3, 4, 5].includes(x.score) &&
      ["service", "communication", "delivery", "quality", "other"].includes(x.category) &&
      typeof x.text === "string" && x.text.length <= 2000;
  return false;
}

export class ChatCodeCodec implements ContentCodec<AppPayload> {
  get contentType() { return ContentTypeChatCode; }
  encode(c: AppPayload): EncodedContent {
    return { type: ContentTypeChatCode, parameters: {}, content: new TextEncoder().encode(JSON.stringify(c)) };
  }
  decode(e: EncodedContent): AppPayload {
    const parsed = JSON.parse(new TextDecoder().decode(e.content));
    if (!isAppPayload(parsed)) throw new Error("Invalid ChatCode payload");
    return parsed;
  }
  fallback(c: AppPayload) {
    return c.kind === "feedback"
      ? `[${c.chatCode}] Feedback ${c.score}/5 (${c.category}): ${c.text}`
      : `[${c.chatCode}] ${c.text}`;
  }
  shouldPush() { return true; }
}
```

The codec must be registered in `Client.create({ codecs: [new ChatCodeCodec()] })`.

## 4. Storage

| Key | Content | Notes |
|---|---|---|
| `chatcode:contacts:v1` | `ContactBook` JSON | validate on read; fall back to empty; try/catch on write |
| `chatcode:ui:v1` (optional) | last selected peer/code | small, non-critical |

SDK-managed local storage (OPFS) holds decrypted history and keys; the app never touches it directly. **No message content in `localStorage`.**

## 5. Module responsibilities

- **`useXmtp`** (context): owns the single `Client`. `init()` builds the signer from wagmi's wallet client and calls `Client.create`. Tears down (`client.close()`) on wallet change/disconnect. Exposes `{ client, status, error, init }`.
- **`useContacts`**: CRUD + import/export + `label(address)`; hydrates after mount (avoid SSR mismatch); listens to `storage` events.
- **`useChat(client)`**: on ready → `syncAll` → load history from all visible DMs → open `streamAllMessages` → `ingest()` each message (validate, resolve peer inbox, dedupe by id, map to `ChatItem`). Exposes `forPeer(inboxId)`, `sendText`, `sendFeedback`, `requests`, and handles reconnect/backoff. Cleans up stream on unmount/client change.
- **`lib/xmtp.ts`**: `canReach`, `sendPayload` (find-or-create DM then send with `ContentTypeChatCode`), `getInboxId`, `peerInboxOf`, consent helpers. The only place with version-sensitive SDK calls.
- **`codesFor(items)`** (pure): returns `[code, {count, ratings, last}]` sorted by last activity; unit-tested.
- **`effectiveFeedback(items, code)`** (pure): latest feedback per sender for a code; unit-tested.

## 6. Message tagging rules
1. All app messages use `ContentTypeChatCode`.
2. `ingest()` accepts a message only if content type matches **and** `isAppPayload` passes; otherwise ignore (log at debug level).
3. Ordering/timestamps use XMTP network time; `clientTs` is display-only metadata.
4. "Effective" feedback = latest by network time per (sender, chatCode).

## 7. Security & privacy notes
- Payloads are untrusted input; validate and length-limit. Render via React text nodes only.
- Chat codes are labels, not access control; any participant can send any code.
- Aliases never leave the browser.
- Don't claim at-rest encryption of local history (the browser SDK doesn't use `dbEncryptionKey`).
- Any RPC key (ENS) used client-side is public; use a domain-restricted key.
- Deep links never auto-add contacts or auto-send.

## 8. Error handling matrix

| Situation | Behavior |
|---|---|
| Signature rejected | status `error`, message "Signature rejected", retry button |
| Recipient not on XMTP | contact saved with `reachable:false`; send blocked with explanatory message + invite link |
| Stream error | backoff reconnect (1s→30s), then `syncAll` |
| Send failure | item marked `failed`, retry action |
| localStorage failure | in-memory fallback + non-blocking banner |
| Invalid payload | ignored |
