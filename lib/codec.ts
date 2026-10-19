import { type ContentTypeId, type ContentCodec, type EncodedContent } from "@xmtp/content-type-primitives";
import type { AppPayload } from "./types";

// ContentTypeId is a type-only interface in @xmtp/content-type-primitives@3.0.1
// (no runtime constructor), so we build the value as a plain object literal.
export const ContentTypeChatCode: ContentTypeId = {
  authorityId: "chatcode.app",
  typeId: "envelope",
  versionMajor: 1,
  versionMinor: 0,
};

export const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "-");
export const isValidCode = (s: string) => /^[A-Z0-9-]{3,32}$/.test(s);

/** Maximum payload sizes (SPEC §6). Enforced on send and on receive. */
export const MAX_TEXT_LENGTH = 4000;
export const MAX_COMMENT_LENGTH = 2000;

export function isAppPayload(x: unknown): x is AppPayload {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  if (p.v !== 1) return false;
  if (typeof p.chatCode !== "string" || !isValidCode(p.chatCode)) return false;
  if (typeof p.clientTs !== "number") return false;
  if (p.kind === "message") {
    return typeof p.text === "string" && p.text.length > 0 && p.text.length <= MAX_TEXT_LENGTH;
  }
  if (p.kind === "feedback") {
    const score = p.score;
    const category = p.category;
    return (
      typeof score === "number" &&
      [1, 2, 3, 4, 5].includes(score) &&
      typeof category === "string" &&
      ["service", "communication", "delivery", "quality", "other"].includes(category) &&
      typeof p.text === "string" &&
      p.text.length <= MAX_COMMENT_LENGTH
    );
  }
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
