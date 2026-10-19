"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AsyncStreamProxy,
  Client,
  DecodedMessage,
} from "@xmtp/browser-sdk";
import { contentTypesAreEqual } from "@xmtp/content-type-primitives";
import {
  ChatCodeCodec,
  ContentTypeChatCode,
  isAppPayload,
  normalizeCode,
} from "@/lib/codec";
import { createDM, peerInboxOf, VISIBLE } from "@/lib/xmtp";
import type { Address, AppPayload, ChatItem, FeedbackCategory } from "@/lib/types";

/** Pure selector: group chat items by code, sorted by last activity. */
export function codesFor(list: ChatItem[]) {
  const stats = new Map<string, { count: number; ratings: number[]; last: number }>();
  for (const i of list) {
    const s = stats.get(i.payload.chatCode) ?? { count: 0, ratings: [], last: 0 };
    s.count++;
    s.last = Math.max(s.last, i.sentAt);
    if (i.payload.kind === "feedback") s.ratings.push(i.payload.score);
    stats.set(i.payload.chatCode, s);
  }
  return [...stats.entries()].sort((a, b) => b[1].last - a[1].last);
}

/** Pure selector: latest feedback per sender (mine) for a code, by network time. */
export function effectiveFeedback(list: ChatItem[], code: string) {
  const latest = new Map<boolean, ChatItem>();
  for (const i of list) {
    if (i.payload.kind !== "feedback" || i.payload.chatCode !== code) continue;
    const cur = latest.get(i.mine);
    if (!cur || i.sentAt > cur.sentAt) latest.set(i.mine, i);
  }
  return latest;
}

export function useChat(client: Client | null) {
  const [items, setItems] = useState<Map<string, ChatItem>>(new Map());
  const counter = useRef(0);
  const recipientById = useRef<Map<string, Address>>(new Map());
  const peerCache = useRef(new Map<string, string>());

  // ---- ingest: validate, resolve peer, dedupe, map to ChatItem ----
  const ingest = useCallback(
    async (m: DecodedMessage) => {
      if (!client) return;
      if (!contentTypesAreEqual(m.contentType, ContentTypeChatCode)) return;
      if (!isAppPayload(m.content)) return;
      let peer = peerCache.current.get(m.conversationId);
      if (!peer) {
        peer = await peerInboxOf(client, m.conversationId);
        if (!peer) return;
        peerCache.current.set(m.conversationId, peer);
      }
      const item: ChatItem = {
        id: m.id,
        peerInboxId: peer,
        mine: m.senderInboxId === client.inboxId,
        sentAt: Number(m.sentAtNs) / 1000000,
        payload: m.content,
      };
      setItems((prev) => (prev.has(item.id) ? prev : new Map(prev).set(item.id, item)));
    },
    [client],
  );

  // ---- history + live stream with exponential backoff reconnect ----
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(new Map());
    peerCache.current.clear();
    if (!client) return;
    let stream: AsyncStreamProxy<DecodedMessage> | undefined;
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
          onValue: (m: DecodedMessage) => void ingest(m),
          onError: () => reconnect(),
        });
        attempt = 0;
      } catch {
        reconnect();
      }
    };

    const reconnect = () => {
      if (cancelled) return;
      void stream?.end();
      const delay = Math.min(30_000, 1000 * 2 ** attempt++);
      setTimeout(() => !cancelled && void run(), delay);
    };

    void run();
    return () => {
      cancelled = true;
      void stream?.end();
    };
  }, [client, ingest]);

  // ---- send with optimistic pending -> confirmed/failed + retry ----
  const send = useCallback(async (to: Address, payload: AppPayload) => {
    if (!client) throw new Error("XMTP client not ready");
    const { dm, peerInboxId } = await createDM(client, to);
    const tempId = `opt-${Date.now()}-${++counter.current}`;
    recipientById.current.set(tempId, to);
    const optimistic: ChatItem = {
      id: tempId,
      peerInboxId,
      mine: true,
      sentAt: Date.now(),
      status: "pending",
      payload,
    };
    setItems((prev) => new Map(prev).set(tempId, optimistic));
    try {
      const messageId = await dm.send(new ChatCodeCodec().encode(payload));
      setItems((prev) => {
        const next = new Map(prev);
        next.delete(tempId);
        recipientById.current.delete(tempId);
        recipientById.current.set(messageId, to);
        next.set(messageId, { ...optimistic, id: messageId, status: undefined });
        return next;
      });
      return messageId;
    } catch (e) {
      setItems((prev) => {
        const next = new Map(prev);
        const cur = next.get(tempId);
        if (cur) next.set(tempId, { ...cur, status: "failed" });
        return next;
      });
      throw e;
    }
  }, [client]);

  const sendText = useCallback(
    (to: Address, code: string, text: string) =>
      send(to, {
        v: 1,
        kind: "message",
        chatCode: normalizeCode(code),
        text,
        clientTs: Date.now(),
      }),
    [send],
  );

  const sendFeedback = useCallback(
    (
      to: Address,
      code: string,
      score: 1 | 2 | 3 | 4 | 5,
      category: FeedbackCategory,
      text: string,
    ) =>
      send(to, {
        v: 1,
        kind: "feedback",
        chatCode: normalizeCode(code),
        score,
        category,
        text,
        clientTs: Date.now(),
      }),
    [send],
  );

  const retry = useCallback(
    async (item: ChatItem) => {
      if (!client) throw new Error("XMTP client not ready");
      const to = recipientById.current.get(item.id);
      if (!to) throw new Error("No recipient recorded for this message");
      setItems((prev) => {
        const next = new Map(prev);
        const cur = next.get(item.id);
        if (cur) next.set(item.id, { ...cur, status: "pending" });
        return next;
      });
      try {
        const { dm, peerInboxId } = await createDM(client, to);
        const messageId = await dm.send(new ChatCodeCodec().encode(item.payload));
        setItems((prev) => {
          const next = new Map(prev);
          next.delete(item.id);
          recipientById.current.delete(item.id);
          recipientById.current.set(messageId, to);
          next.set(messageId, {
            id: messageId,
            peerInboxId,
            mine: true,
            sentAt: Date.now(),
            status: undefined,
            payload: item.payload,
          });
          return next;
        });
        return messageId;
      } catch (e) {
        setItems((prev) => {
          const next = new Map(prev);
          const cur = next.get(item.id);
          if (cur) next.set(item.id, { ...cur, status: "failed" });
          return next;
        });
        throw e;
      }
    },
    [client],
  );

  const forPeer = useCallback(
    (peerInboxId?: string) =>
      [...items.values()]
        .filter((i) => !peerInboxId || i.peerInboxId === peerInboxId)
        .sort((a, b) => a.sentAt - b.sentAt),
    [items],
  );

  return { items, sendText, sendFeedback, retry, forPeer };
}
