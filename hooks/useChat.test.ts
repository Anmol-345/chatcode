import { describe, expect, it } from "vitest";
import { codesFor, effectiveFeedback } from "./useChat";
import type { AppPayload, ChatItem } from "@/lib/types";

const now = Date.now();
const inboxA = "inbox-a";

const msgPayload = (code: string, clientTs: number): AppPayload =>
  ({ v: 1, kind: "message", chatCode: code, clientTs, text: "hi" });
const fbPayload = (
  code: string,
  score: 1 | 2 | 3 | 4 | 5,
  clientTs: number,
): AppPayload =>
  ({
    v: 1,
    kind: "feedback",
    chatCode: code,
    clientTs,
    score,
    category: "delivery",
    text: "good",
  } as AppPayload);

const item = (overrides: Partial<ChatItem> = {}): ChatItem =>
  ({
    id: "msg-1",
    peerInboxId: inboxA,
    mine: true,
    sentAt: now,
    payload: msgPayload("ORDER-1", now),
    ...overrides,
  } as ChatItem);

describe("codesFor", () => {
  it("returns empty array for no items", () => {
    expect(codesFor([])).toEqual([]);
  });

  it("groups items by chat code with count and last activity", () => {
    const list = [
      item({ id: "a", sentAt: 100 }),
      item({ id: "b", sentAt: 200 }),
      item({ id: "c", sentAt: 50, payload: msgPayload("ORDER-2", 50) }),
    ];
    const result = codesFor(list);
    expect(result).toHaveLength(2);
    const byCode = Object.fromEntries(result.map(([code, s]) => [code, s]));
    expect(byCode["ORDER-1"].count).toBe(2);
    expect(byCode["ORDER-1"].last).toBe(200);
    expect(byCode["ORDER-2"].count).toBe(1);
    expect(byCode["ORDER-2"].last).toBe(50);
    // sorted by last desc: ORDER-1 first
    expect(result[0][0]).toBe("ORDER-1");
  });

  it("collects ratings only for feedback items", () => {
    const list = [
      item({ id: "a", sentAt: 100 }),
      item({
        id: "fb1",
        sentAt: 100,
        mine: true,
        payload: fbPayload("ORDER-1", 5, 100),
      }),
      item({
        id: "fb2",
        sentAt: 100,
        mine: false,
        payload: fbPayload("ORDER-1", 3, 100),
      }),
    ];
    const result = codesFor(list);
    expect(result[0][1].ratings).toEqual([5, 3]);
  });
});

describe("effectiveFeedback", () => {
  it("returns empty map when no feedback for code", () => {
    expect(effectiveFeedback([item()], "ORDER-1")).toEqual(new Map());
  });

  it("returns latest feedback per sender (mine)", () => {
    const olderMine = item({ id: "old", mine: true, sentAt: 100, payload: fbPayload("ORDER-1", 3, 100) });
    const newerMine = item({ id: "new", mine: true, sentAt: 200, payload: fbPayload("ORDER-1", 5, 200) });
    const olderTheirs = item({ id: "old2", mine: false, sentAt: 100, payload: fbPayload("ORDER-1", 4, 100) });
    const newerTheirs = item({ id: "new2", mine: false, sentAt: 300, payload: fbPayload("ORDER-1", 2, 300) });
    const result = effectiveFeedback([olderMine, newerMine, olderTheirs, newerTheirs], "ORDER-1");
    expect(result.get(true)?.id).toBe("new");
    expect(result.get(false)?.id).toBe("new2");
  });

  it("ignores non-feedback and other codes", () => {
    const result = effectiveFeedback(
      [
        item(),
        item({ id: "fb", sentAt: 100, payload: fbPayload("OTHER", 5, 100) }),
      ],
      "ORDER-1",
    );
    expect(result.size).toBe(0);
  });

  it("picks latest by network time", () => {
    const early = item({ id: "e", mine: true, sentAt: 10, payload: fbPayload("ORDER-1", 1, 10) });
    const late = item({ id: "l", mine: true, sentAt: 90, payload: fbPayload("ORDER-1", 5, 90) });
    const middle = item({ id: "m", mine: true, sentAt: 50, payload: fbPayload("ORDER-1", 3, 50) });
    const result = effectiveFeedback([middle, early, late], "ORDER-1");
    expect((result.get(true)?.payload as { score: number })?.score).toBe(5);
    expect(result.get(true)?.id).toBe("l");
  });
});
