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
  onChainTx?: string;
  onChainBlock?: number;
  payload: AppPayload;
}

/** An inbound conversation from a sender we have not allowed yet (FR-21). */
export interface ChatRequest {
  peerInboxId: string;
  conversationId: string;
  preview: string;         // latest app-payload text, for display only
  at: number;              // ms, network time of the latest message
  count: number;           // number of app-payload messages seen
}
