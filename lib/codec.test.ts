import { describe, expect, it } from "vitest";
import { ContentTypeChatCode, isAppPayload, isValidCode, normalizeCode } from "./codec";
import type { AppPayload } from "./types";

const base = (overrides: Record<string, unknown> = {}): AppPayload =>
  ({ v: 1, chatCode: "ORDER-1", clientTs: Date.now(), kind: "message", text: "hi", ...overrides }) as AppPayload;

describe("normalizeCode", () => {
  it("trims, uppercases, and collapses whitespace to dashes", () => {
    expect(normalizeCode("  order  1042  ")).toBe("ORDER-1042");
    expect(normalizeCode("a   b c")).toBe("A-B-C");
    expect(normalizeCode("lowercase")).toBe("LOWERCASE");
  });
});

describe("isValidCode", () => {
  it.each([
    ["ORDER-1", true],
    ["GENERAL", true],
    ["A-B", true], // exactly 3 chars is valid
    ["AB", false], // too short (< 3)
    ["aBc", false], // lowercase not allowed
    ["ORDER_1", false], // underscore not allowed
    ["ORDER 1", false], // space not allowed
    ["A".repeat(33), false], // too long (> 32)
    ["", false],
  ])("%s -> %s", (input, expected) => {
    expect(isValidCode(input)).toBe(expected);
  });
});

describe("isAppPayload", () => {
  it("accepts a valid text payload", () => {
    expect(isAppPayload(base({ kind: "message", text: "hello" }))).toBe(true);
  });

  it("accepts a valid feedback payload", () => {
    expect(isAppPayload(base({ kind: "feedback", score: 5, category: "delivery", text: "great" }))).toBe(true);
  });

  it("rejects invalid (wrong v)", () => {
    expect(isAppPayload(base({ v: 2 }))).toBe(false);
  });

  it("rejects invalid (bad chatCode)", () => {
    expect(isAppPayload(base({ chatCode: "bad code" }))).toBe(false);
  });

  it("rejects invalid (missing/wrong clientTs)", () => {
    expect(isAppPayload(base({ clientTs: "now" }))).toBe(false);
    expect(isAppPayload(base({ clientTs: undefined }))).toBe(false);
  });

  it("rejects invalid (message text empty)", () => {
    expect(isAppPayload(base({ kind: "message", text: "" }))).toBe(false);
  });

  it("rejects invalid (message text oversize > 4000)", () => {
    expect(isAppPayload(base({ kind: "message", text: "x".repeat(4001) }))).toBe(false);
  });

  it("rejects invalid (feedback score out of range)", () => {
    expect(isAppPayload(base({ kind: "feedback", score: 0 }))).toBe(false);
    expect(isAppPayload(base({ kind: "feedback", score: 6 }))).toBe(false);
  });

  it("rejects invalid (feedback bad category)", () => {
    expect(isAppPayload(base({ kind: "feedback", category: "shipping" }))).toBe(false);
  });

  it("rejects invalid (feedback comment oversize > 2000)", () => {
    expect(isAppPayload(base({ kind: "feedback", text: "x".repeat(2001) }))).toBe(false);
  });

  it("rejects unknown kind", () => {
    expect(isAppPayload(base({ kind: "reaction" }))).toBe(false);
  });

  it("rejects null / undefined / non-object", () => {
    expect(isAppPayload(null)).toBe(false);
    expect(isAppPayload(undefined)).toBe(false);
    expect(isAppPayload("string")).toBe(false);
    expect(isAppPayload(42)).toBe(false);
  });
});

describe("ContentTypeChatCode", () => {
  it("has the expected content type id", () => {
    expect(ContentTypeChatCode.authorityId).toBe("chatcode.app");
    expect(ContentTypeChatCode.typeId).toBe("envelope");
    expect(ContentTypeChatCode.versionMajor).toBe(1);
    expect(ContentTypeChatCode.versionMinor).toBe(0);
  });
});
