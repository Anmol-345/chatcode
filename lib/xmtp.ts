import { Client, IdentifierKind, ConsentEntityType, ConsentState, type Dm } from "@xmtp/browser-sdk";
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

/** Creates (or reuses) a DM for `to` and returns it together with the peer's inbox id. */
export async function createDM(client: Client, to: Address): Promise<{ dm: Dm; peerInboxId: string }> {
  const dm = await client.conversations.createDmWithIdentifier(id(to));
  const peerInboxId = await dm.peerInboxId();
  return { dm, peerInboxId };
}

export async function sendPayload(client: Client, to: Address, payload: AppPayload): Promise<string> {
  const { dm } = await createDM(client, to);
  const encoded = new ChatCodeCodec().encode(payload);
  return dm.send(encoded);
}

export async function peerInboxOf(client: Client, conversationId: string): Promise<string | undefined> {
  const convo = await client.conversations.getConversationById(conversationId);
  if (!convo) return undefined;
  return (convo as Dm).peerInboxId();
}

/** Read the consent state we hold for a given peer inbox id. */
export async function consentOf(client: Client, inboxId: string): Promise<ConsentState> {
  return client.preferences.getConsentState(ConsentEntityType.InboxId, inboxId);
}

/**
 * Resolve the 0x address behind a peer inbox id, using the inbox's recovery
 * identifier. Returns undefined for non-EVM identities.
 */
export async function addressOfInbox(client: Client, inboxId: string): Promise<Address | undefined> {
  const states = await client.preferences.getInboxStates([inboxId]);
  const recovery = states[0]?.recoveryIdentifier;
  if (!recovery || recovery.identifierKind !== IdentifierKind.Ethereum) return undefined;
  return recovery.identifier.toLowerCase() as Address;
}

/** Allow or block a peer inbox id. */
export async function setConsent(
  client: Client,
  inboxId: string,
  state: ConsentState,
): Promise<void> {
  await client.preferences.setConsentStates([
    { entityType: ConsentEntityType.InboxId, state, entity: inboxId },
  ]);
}
