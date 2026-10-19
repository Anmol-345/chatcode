"use client";
import { useCallback, useRef, useState } from "react";
import type { Client } from "@xmtp/browser-sdk";
import { ChatCodeCodec, normalizeCode } from "@/lib/codec";
import { createDM } from "@/lib/xmtp";
import type { Address, AppPayload, ChatItem, FeedbackCategory } from "@/lib/types";

export function useChat(client: Client | null) {
  const [items, setItems] = useState<Map<string, ChatItem>>(new Map());
  const counter = useRef(0);
  // Maps optimistic/failed item id -> recipient address, so retries know who to resend to.
  const recipientById = useRef<Map<string, Address>>(new Map());

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
