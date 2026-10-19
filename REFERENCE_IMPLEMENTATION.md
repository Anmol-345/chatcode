# Reference Implementation (starting point — a sketch)

> These snippets show intended structure and behavior. **They are not guaranteed to compile.** XMTP calls are marked `VERIFY`; confirm them against the installed SDK types (see `XMTP_NOTES.md`) and adapt inside `lib/xmtp.ts`.
> Types and codec: see `docs/ARCHITECTURE.md` §3 (copy verbatim to `lib/types.ts`, `lib/codec.ts`).

## lib/wagmi.ts
```ts
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [mainnet], // used for ENS reads only
  connectors: [injected(), coinbaseWallet({ appName: "ChatCode" })],
  transports: { [mainnet.id]: http() }, // replace with a domain-restricted RPC URL via NEXT_PUBLIC_RPC_URL
  ssr: true,
});
```

## app/providers.tsx
```tsx
"use client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { wagmiConfig } from "@/lib/wagmi";
import { XmtpProvider } from "@/hooks/useXmtp";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <XmtpProvider>{children}</XmtpProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

## hooks/useXmtp.tsx
```tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { toBytes } from "viem";
import { Client, IdentifierKind, type Signer } from "@xmtp/browser-sdk";
import { ChatCodeCodec } from "@/lib/codec";

type Status = "idle" | "initializing" | "ready" | "error";
interface Ctx { client: Client | null; status: Status; error: string | null; init: () => Promise<void> }
const XmtpCtx = createContext<Ctx>({} as Ctx);
export const useXmtp = () => useContext(XmtpCtx);

export function XmtpProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const clientRef = useRef<Client | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Wallet changed or disconnected → tear everything down (FR-4)
  useEffect(() => {
    clientRef.current?.close(); // VERIFY
    clientRef.current = null;
    setClient(null); setStatus("idle"); setError(null);
  }, [address]);

  const init = useCallback(async () => {
    if (!address || !walletClient) return;
    setStatus("initializing"); setError(null);
    try {
      const identifier = { identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum };
      const signer: Signer = {
        type: "EOA",
        getIdentifier: () => identifier,
        signMessage: async (message: string) =>
          toBytes(await walletClient.signMessage({ account: address, message })),
      };
      const c = await Client.create(signer, {            // VERIFY options
        env: "production",
        codecs: [new ChatCodeCodec()],
        appVersion: "chatcode/0.1.0",
      });
      clientRef.current = c; setClient(c); setStatus("ready");
    } catch (e: any) {
      setError(/reject|denied/i.test(e?.message ?? "") ? "Signature rejected" : e?.message ?? "Failed to initialize XMTP");
      setStatus("error");
    }
  }, [address, walletClient]);

  return <XmtpCtx.Provider value={{ client, status, error, init }}>{children}</XmtpCtx.Provider>;
}
```

## lib/xmtp.ts (adapter — all VERIFY)
```ts
import { Client, IdentifierKind, ConsentState, type Dm } from "@xmtp/browser-sdk";
import { ContentTypeChatCode } from "./codec";
import type { Address, AppPayload } from "./types";

const id = (a: Address) => ({ identifier: a.toLowerCase(), identifierKind: IdentifierKind.Ethereum });

export async function canReach(address: Address): Promise<boolean> {
  const res = await Client.canMessage([id(address)], "production"); // VERIFY static vs instance
  return res.get(address.toLowerCase()) ?? false;
}

export async function getInboxId(client: Client, address: Address) {
  return (await client.fetchInboxIdByIdentifier(id(address))) ?? undefined; // VERIFY
}

export async function sendPayload(client: Client, to: Address, payload: AppPayload) {
  const dm = await client.conversations.createDmWithIdentifier(id(to)); // VERIFY; throws if unregistered
  await dm.send(payload, ContentTypeChatCode);                            // VERIFY send signature
  return dm;
}

export async function peerInboxOf(client: Client, conversationId: string) {
  const convo = await client.conversations.getConversationById(conversationId); // VERIFY
  return convo ? await (convo as Dm).peerInboxId() : undefined;                 // VERIFY
}

export const VISIBLE = [ConsentState.Allowed, ConsentState.Unknown];
```

## lib/ens.ts
```ts
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const pc = createPublicClient({ chain: mainnet, transport: http(process.env.NEXT_PUBLIC_RPC_URL) });

export async function resolveAddress(name: string) {
  try { return await pc.getEnsAddress({ name: normalize(name) }); } catch { return null; }
}
export async function reverseName(address: `0x${string}`) {
  try {
    const name = await pc.getEnsName({ address });
    return name && (await resolveAddress(name))?.toLowerCase() === address.toLowerCase() ? name : null; // forward-verify
  } catch { return null; }
}
```

## hooks/useContacts.ts
```ts
"use client";
import { useCallback, useEffect, useState } from "react";
import type { Address, Contact, ContactBook } from "@/lib/types";

const KEY = "chatcode:contacts:v1";
const empty: ContactBook = { version: 1, contacts: {} };

function load(): ContactBook {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return p?.version === 1 && p.contacts && typeof p.contacts === "object" ? p : empty;
  } catch { return empty; }
}

export function useContacts() {
  const [book, setBook] = useState<ContactBook>(empty);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    setBook(load()); setHydrated(true);
    const onStorage = (e: StorageEvent) => e.key === KEY && setBook(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = (next: ContactBook) => {
    setBook(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  };

  const upsert = useCallback((c: Pick<Contact, "address" | "alias"> & Partial<Contact>) => {
    const key = c.address.toLowerCase() as Address;
    const cur = load();
    const now = Date.now();
    persist({ version: 1, contacts: { ...cur.contacts, [key]: { createdAt: now, ...cur.contacts[key], ...c, address: key, updatedAt: now } } });
  }, []);

  const remove = useCallback((address: Address) => {
    const { [address.toLowerCase()]: _, ...rest } = load().contacts;
    persist({ version: 1, contacts: rest });
  }, []);

  const label = useCallback((addr?: string) =>
    (addr && (book.contacts[addr.toLowerCase()]?.alias || book.contacts[addr.toLowerCase()]?.ensName)) ||
    (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "Unknown"), [book]);

  return { contacts: Object.values(book.contacts), hydrated, storageError, upsert, remove, label };
}
```
(Add `exportJSON()` / `importJSON(text)` with validation per FR-10.)

## hooks/useChat.ts
```ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Client } from "@xmtp/browser-sdk";
import { ContentTypeChatCode, isAppPayload, normalizeCode } from "@/lib/codec";
import { VISIBLE, peerInboxOf, sendPayload } from "@/lib/xmtp";
import type { Address, ChatItem, FeedbackCategory } from "@/lib/types";

export function useChat(client: Client | null) {
  const [items, setItems] = useState<Map<string, ChatItem>>(new Map());
  const peerCache = useRef(new Map<string, string>());

  const ingest = useCallback(async (m: any) => {            // VERIFY message shape
    if (!client) return;
    const ct = m.contentType;
    if (ct?.authorityId !== ContentTypeChatCode.authorityId || ct?.typeId !== ContentTypeChatCode.typeId) return;
    if (!isAppPayload(m.content)) return;
    let peer = peerCache.current.get(m.conversationId);
    if (!peer) {
      peer = await peerInboxOf(client, m.conversationId);
      if (!peer) return;
      peerCache.current.set(m.conversationId, peer);
    }
    const item: ChatItem = {
      id: m.id, peerInboxId: peer, mine: m.senderInboxId === client.inboxId,
      sentAt: Number(m.sentAtNs / 1_000_000n), payload: m.content,
    };
    setItems((prev) => (prev.has(item.id) ? prev : new Map(prev).set(item.id, item)));
  }, [client]);

  useEffect(() => {
    setItems(new Map()); peerCache.current.clear();
    if (!client) return;
    let stream: { end: () => unknown } | undefined;
    let cancelled = false;
    let attempt = 0;

    const run = async () => {
      try {
        await client.conversations.syncAll(VISIBLE);
        for (const dm of await client.conversations.listDms({ consentStates: VISIBLE })) {
          for (const m of await dm.messages()) await ingest(m);
        }
        if (cancelled) return;
        stream = await client.conversations.streamAllMessages({
          consentStates: VISIBLE,
          onValue: (m: any) => void ingest(m),
          onError: () => reconnect(),
        });
        attempt = 0;
      } catch { reconnect(); }
    };
    const reconnect = () => {
      if (cancelled) return;
      void stream?.end();
      const delay = Math.min(30_000, 1000 * 2 ** attempt++);
      setTimeout(() => !cancelled && void run(), delay);
    };
    void run();
    return () => { cancelled = true; void stream?.end(); };
  }, [client, ingest]);

  const sendText = (to: Address, code: string, text: string) =>
    sendPayload(client!, to, { v: 1, kind: "message", chatCode: normalizeCode(code), text, clientTs: Date.now() });
  const sendFeedback = (to: Address, code: string, score: 1|2|3|4|5, category: FeedbackCategory, text: string) =>
    sendPayload(client!, to, { v: 1, kind: "feedback", chatCode: normalizeCode(code), score, category, text, clientTs: Date.now() });

  const forPeer = useCallback((peerInboxId?: string) =>
    [...items.values()].filter((i) => i.peerInboxId === peerInboxId).sort((a, b) => a.sentAt - b.sentAt), [items]);

  return { items, forPeer, sendText, sendFeedback };
}

export function codesFor(list: ChatItem[]) {
  const stats = new Map<string, { count: number; ratings: number[]; last: number }>();
  for (const i of list) {
    const s = stats.get(i.payload.chatCode) ?? { count: 0, ratings: [], last: 0 };
    s.count++; s.last = Math.max(s.last, i.sentAt);
    if (i.payload.kind === "feedback") s.ratings.push(i.payload.score);
    stats.set(i.payload.chatCode, s);
  }
  return [...stats.entries()].sort((a, b) => b[1].last - a[1].last);
}

/** Latest feedback per sender for a code, by network time. */
export function effectiveFeedback(list: ChatItem[], code: string) {
  const latest = new Map<boolean, ChatItem>(); // keyed by `mine`
  for (const i of list) {
    if (i.payload.kind !== "feedback" || i.payload.chatCode !== code) continue;
    const cur = latest.get(i.mine);
    if (!cur || i.sentAt > cur.sentAt) latest.set(i.mine, i);
  }
  return latest;
}
```
(Add pending/failed optimistic handling per FR-24 and a Requests selector for Unknown-consent senders per FR-21.)

## components (Tailwind, minimal)
Use the structure below; polish styling as desired.

### ChatCodeSwitcher
```tsx
"use client";
import { useState } from "react";
import { isValidCode, normalizeCode } from "@/lib/codec";

export function ChatCodeSwitcher({ codes, active, onChange }: {
  codes: [string, { count: number; ratings: number[] }][]; active: string; onChange: (c: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const avg = (r: number[]) => (r.length ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1) : null);
  const list = codes.some(([c]) => c === "GENERAL") ? codes : [["GENERAL", { count: 0, ratings: [] }] as const, ...codes];
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b p-2">
      {list.map(([code, s]) => (
        <button key={code} onClick={() => onChange(code)}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${active === code ? "bg-black text-white" : ""}`}>
          {code} · {s.count}{avg(s.ratings) && ` · ★${avg(s.ratings)}`}
        </button>
      ))}
      <input aria-label="New chat code" className="w-32 rounded border px-2 py-1 text-xs" placeholder="New code…"
        value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { const c = normalizeCode(draft); if (e.key === "Enter" && isValidCode(c)) { onChange(c); setDraft(""); } }} />
    </div>
  );
}
```

### MessagePanel / FeedbackForm / ContactManager
- `MessagePanel`: props `{ items, activeCode, onSend, onFeedback }`; filter `items` by `payload.chatCode === activeCode`; mine → right-aligned dark bubble; feedback → `★` string + category + text; composer form + "★ Feedback" toggle revealing `FeedbackForm`.
- `FeedbackForm`: score select (1–5), category select (5 options), optional comment (≤2000), submit.
- `ContactManager`: input (0x or ENS), alias input, Add button → `isAddress ? addr : resolveAddress(input)` → `canReach` → `upsert`; list with select/edit/delete; export/import; show invite link (`buildInviteLink`) for unreachable contacts.

## app/page.tsx (composition outline)
```tsx
"use client";
// 1. not connected → connect buttons (ConnectBar)
// 2. connected, status !== "ready" → "Enable messaging (one signature, no gas)" button (init), show error
// 3. ready → <ContactManager/> | <ChatCodeSwitcher/> + <MessagePanel/>
// On contact select: inboxId = contact.inboxId ?? await getInboxId(client, contact.address);
//   then upsert({address, alias, inboxId}) so threads map to contacts.
// Deep link: parse ?peer=&code= on mount → show confirm dialog (never auto-add / auto-send).
```

## next.config.ts (only if needed)
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};
export default nextConfig;
```
