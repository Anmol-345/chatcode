"use client";
import { Suspense, useCallback, useMemo, useState } from "react";
import { ConnectBar } from "@/components/ConnectBar";
import { ContactManager } from "@/components/ContactManager";
import { ChatCodeSwitcher } from "@/components/ChatCodeSwitcher";
import { MessagePanel } from "@/components/MessagePanel";
import { DeepLinkPrompt } from "@/components/DeepLinkPrompt";
import { RequestsDrawer } from "@/components/RequestsDrawer";
import { useXmtp } from "@/hooks/useXmtp";
import { useContacts } from "@/hooks/useContacts";
import { useChat, codesFor } from "@/hooks/useChat";
import { isValidCode } from "@/lib/codec";
import { addressOfInbox } from "@/lib/xmtp";
import type { Address, ChatItem, ChatRequest, Contact, FeedbackCategory } from "@/lib/types";

export default function Page() {
  const { client, status, error: xmtpError } = useXmtp();
  const { contacts, hydrated, upsert, label } = useContacts();
  const ready = status === "ready" && !!client;

  const [activeContact, setActiveContact] = useState<Contact | undefined>(undefined);
  const [activeCode, setActiveCode] = useState<string>("GENERAL");
  const [sendError, setSendError] = useState<string | null>(null);

  const { items, requests, sendText, sendFeedback, retry, acceptRequest, blockRequest } = useChat(client);

  const handleConfirmDeepLink = useCallback(
    (peer?: Address, code?: string) => {
      if (peer) {
        const existing = contacts.find((c) => c.address === peer);
        if (!existing) {
          upsert({ address: peer, alias: peer, reachable: undefined });
        }
        setActiveContact(existing ?? { address: peer, alias: peer, createdAt: Date.now(), updatedAt: Date.now() });
      }
      if (code && isValidCode(code)) setActiveCode(code);
    },
    [contacts, upsert],
  );

  const handleSelectContact = useCallback((contact: Contact) => {
    setActiveContact(contact);
  }, []);

  const peerInboxId = activeContact?.inboxId;
  const peerItems = useMemo(
    () => (peerInboxId ? [...items.values()].filter((i) => i.peerInboxId === peerInboxId) : []),
    [items, peerInboxId],
  );
  const codes = useMemo(() => codesFor(peerItems).map(([code, stat]) => ({ code, stat })), [peerItems]);

  const handleSendText = useCallback(
    (text: string) => {
      if (!activeContact || !client) return;
      setSendError(null);
      try {
        const p = sendText(activeContact.address, activeCode, text);
        void p.catch((e: unknown) =>
          setSendError(e instanceof Error ? e.message : "Failed to send message"),
        );
      } catch (e: unknown) {
        setSendError(e instanceof Error ? e.message : "Failed to send message");
      }
    },
    [activeContact, activeCode, client, sendText],
  );

  const handleSendFeedback = useCallback(
    (score: number, category: FeedbackCategory, text: string) => {
      if (!activeContact || !client) return;
      setSendError(null);
      try {
        const p = sendFeedback(
          activeContact.address,
          activeCode,
          score as 1 | 2 | 3 | 4 | 5,
          category,
          text,
        );
        void p.catch((e: unknown) =>
          setSendError(e instanceof Error ? e.message : "Failed to send feedback"),
        );
      } catch (e: unknown) {
        setSendError(e instanceof Error ? e.message : "Failed to send feedback");
      }
    },
    [activeContact, activeCode, client, sendFeedback],
  );

  const handleRetry = useCallback(
    (item: ChatItem) => {
      setSendError(null);
      try {
        const p = retry(item);
        void p.catch((e: unknown) =>
          setSendError(e instanceof Error ? e.message : "Failed to resend message"),
        );
      } catch (e: unknown) {
        setSendError(e instanceof Error ? e.message : "Failed to resend message");
      }
    },
    [retry],
  );

  const handleAcceptRequest = useCallback(
    async (request: ChatRequest) => {
      await acceptRequest(request.peerInboxId);
    },
    [acceptRequest],
  );

  const handleAcceptAndAddRequest = useCallback(
    async (request: ChatRequest) => {
      await acceptRequest(request.peerInboxId);
      if (!client) return;
      try {
        const address = await addressOfInbox(client, request.peerInboxId);
        if (address) {
          upsert({
            address,
            alias: `${address.slice(0, 6)}…${address.slice(-4)}`,
            reachable: true,
            inboxId: request.peerInboxId,
          });
        }
      } catch {
        // resolving the address is best-effort; the request is still accepted
      }
    },
    [acceptRequest, client, upsert],
  );

  const handleBlockRequest = useCallback(
    async (request: ChatRequest) => {
      await blockRequest(request.peerInboxId);
    },
    [blockRequest],
  );

  if (!hydrated) {
    return <div className="p-4 text-center text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <ConnectBar />
      {!ready ? (
        <div className="px-4 py-6 text-center">
          {xmtpError && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-red-800 text-sm mb-3">
              {xmtpError}
            </div>
          )}
          {!status && <p className="text-sm text-gray-500">Connect your wallet to begin.</p>}
        </div>
      ) : (
        <div className="flex-1 flex">
          <aside className="w-80 border-r border-gray-200 bg-white flex-shrink-0">
            <ContactManager onSelect={handleSelectContact} />
          </aside>
          <main className="flex-1 flex flex-col min-w-0">
            <div className="border-b border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                {activeContact ? label(activeContact.address) : "Select a contact"}
              </h2>
              <ChatCodeSwitcher codes={codes} active={activeCode} onChange={setActiveCode} />
            </div>
            {activeContact ? (
              <MessagePanel
                items={peerItems}
                activeCode={activeCode}
                onSendText={handleSendText}
                onSendFeedback={handleSendFeedback}
                onRetry={handleRetry}
                error={sendError}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <p className="text-sm text-gray-500">
                  Select a contact on the left to start chatting.
                </p>
              </div>
            )}
          </main>
          <RequestsDrawer
            requests={requests}
            onAccept={handleAcceptRequest}
            onAcceptAndAdd={handleAcceptAndAddRequest}
            onBlock={handleBlockRequest}
          />
        </div>
      )}
      <Suspense fallback={null}>
        <DeepLinkPrompt onConfirm={handleConfirmDeepLink} onCancel={() => {}} />
      </Suspense>
    </div>
  );
}
