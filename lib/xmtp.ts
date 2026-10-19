import { Client, IdentifierKind, ConsentState, type Dm } from "@xmtp/browser-sdk";
import { ChatCodeCodec } from "./codec";
import type { Address, AppPayload } from "./types";

const id = (a: Address) => ({ identifier: a.toLowerCase(), identifierKind: IdentifierKind.Ethereum });

/** Consent states whose conversations/messages the app surfaces. */
export const VISIBLE = [ConsentState.Allowed, ConsentState.Unknown];

/**
 * Check whether an address can receive XMTP messages (static, works before a
 * client exists). Uses the deprecated env-string overload; see XMTP_NOTES.md.
 */
export async function canReach(address: Address): Promise<boolean> {
  const res = await Client.canMessage([id(address)], "production");
  return res.get(address.toLowerCase()) ?? false;
}

export async function getInboxId(client: Client, address: Address): Promise<string | undefined> {
  return client.fetchInboxIdByIdentifier(id(address));
}

export async function sendPayload(client: Client, to: Address, payload: AppPayload): Promise<string> {
  const dm = await client.conversations.createDmWithIdentifier(id(to));
  const encoded = new ChatCodeCodec().encode(payload);
  return dm.send(encoded);
}

export async function peerInboxOf(client: Client, conversationId: string): Promise<string | undefined> {
  const convo = await client.conversations.getConversationById(conversationId);
  if (!convo) return undefined;
  return (convo as Dm).peerInboxId();
}
