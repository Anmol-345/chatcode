"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain, useWriteContract } from "wagmi";
import { isAddress, getAddress } from "viem";
import { useXmtp } from "@/hooks/useXmtp";
import { useContacts } from "@/hooks/useContacts";
import { useChat, codesFor } from "@/hooks/useChat";
import { resolveAddress } from "@/lib/ens";
import { getInboxId, addressOfInbox, VISIBLE } from "@/lib/xmtp";
import { normalizeCode, isValidCode } from "@/lib/codec";
import {
  getContractAddress,
  saveContractAddress,
  CHATCODE_UNIFIED_ABI,
  ROBINHOOD_TESTNET_CHAIN_ID,
  getStuff,
  type StuffResponse,
} from "@/lib/contracts";
import type { Address, FeedbackCategory } from "@/lib/types";

export default function AppPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const { client, status: xmtpStatus, error: xmtpError, init: initXmtp } = useXmtp();
  const { contacts, upsert: upsertContact, updateAlias, remove: removeContact } = useContacts(address);
  const { items, requests, forPeer, sendText, sendFeedback, acceptRequest, blockRequest } = useChat(client);

  // Active view states - Pure live state, ZERO dummy data
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasEditValue, setAliasEditValue] = useState("");
  const [activeCode, setActiveCode] = useState<string>("GENERAL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFeedbackPopover, setShowFeedbackPopover] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>("delivery");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [customCodes, setCustomCodes] = useState<string[]>([]);
  const [isAddingCode, setIsAddingCode] = useState(false);
  const [newCodeDraft, setNewCodeDraft] = useState("");

  // Deployed unified contract on Robinhood Testnet
  const contractAddress = "0x3136deB04E30fF3Cb149e375457A56c465f1f5a6";
  const [attestOnChain, setAttestOnChain] = useState<boolean>(true);
  const [isAttesting, setIsAttesting] = useState<boolean>(false);

  // Server state returned by /api/stuff
  const [serverStuff, setServerStuff] = useState<StuffResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Add contact form state
  const [modalAddressInput, setModalAddressInput] = useState("");
  const [modalAliasInput, setModalAliasInput] = useState("");
  const [modalValidationStatus, setModalValidationStatus] = useState<"empty" | "validating" | "valid" | "invalid">("empty");
  const [modalError, setModalError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Contacts list based on real saved contacts
  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.alias.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.ensName && c.ensName.toLowerCase().includes(q))
    );
  }, [contacts, searchQuery]);

  const activeContact = useMemo(() => {
    if (!selectedAddress) return null;
    return contacts.find((c) => c.address.toLowerCase() === selectedAddress.toLowerCase()) || null;
  }, [contacts, selectedAddress]);

  // Auto-sync real XMTP conversations into contacts list
  useEffect(() => {
    if (!client || xmtpStatus !== "ready") return;
    const activeClient = client;
    let cancelled = false;

    async function syncDMs(c: typeof activeClient) {
      try {
        const dms = await c.conversations.listDms({ consentStates: VISIBLE });
        for (const dm of dms) {
          if (cancelled) break;
          const peerInbox = await dm.peerInboxId();
          const peerAddr = await addressOfInbox(c, peerInbox);
          if (peerAddr) {
            const key = peerAddr.toLowerCase() as Address;
            // Upsert peer inbox and reachable flag without overriding custom contact alias
            upsertContact({
              address: key,
              inboxId: peerInbox,
              reachable: true,
            });
          }
        }
      } catch (e) {
        console.warn("XMTP DMs auto-sync error:", e);
      }
    }

    syncDMs(activeClient);
    return () => {
      cancelled = true;
    };
  }, [client, xmtpStatus, upsertContact]);

  useEffect(() => {
    setIsEditingAlias(false);
  }, [selectedAddress]);

  // Resolve inboxId for active contact if missing
  useEffect(() => {
    if (!client || !activeContact || activeContact.inboxId) return;
    const activeClient = client;
    const targetContact = activeContact;
    let cancelled = false;

    async function resolveInbox(c: typeof activeClient, contact: typeof targetContact) {
      try {
        const inbox = await getInboxId(c, contact.address);
        if (inbox && !cancelled) {
          upsertContact({
            address: contact.address,
            alias: contact.alias,
            ensName: contact.ensName,
            inboxId: inbox,
            reachable: true,
          });
        }
      } catch (e) {
        console.warn("Could not resolve inbox for peer:", e);
      }
    }

    resolveInbox(activeClient, targetContact);
    return () => {
      cancelled = true;
    };
  }, [client, activeContact, upsertContact]);

  // Fetch real data from server endpoint /api/stuff
  const fetchStuff = useCallback(async () => {
    try {
      const data = await getStuff({
        code: activeCode,
        peer: activeContact?.address,
        contract: contractAddress || undefined,
      });
      if (data) {
        setServerStuff(data);
        setServerError(null);
      }
    } catch (err: any) {
      setServerError(err?.message || "Failed to query server data");
    }
  }, [activeCode, activeContact?.address, contractAddress]);

  useEffect(() => {
    fetchStuff();
    const interval = setInterval(fetchStuff, 12000);
    return () => clearInterval(interval);
  }, [fetchStuff]);

  // Messages for active contact strictly from live XMTP items
  const livePeerItems = useMemo(() => {
    if (!activeContact?.inboxId) return [];
    return forPeer(activeContact.inboxId);
  }, [activeContact, forPeer]);

  // Filter messages by active chat code
  const displayItems = useMemo(() => {
    return livePeerItems.filter((i) => i.payload.chatCode === activeCode);
  }, [livePeerItems, activeCode]);

  // Compute available codes strictly from real messages in this thread
  const availableCodes = useMemo(() => {
    const computed = codesFor(livePeerItems);
    const existingCodeNames = new Set(computed.map(([c]) => c));
    const merged = [...computed];

    for (const c of customCodes) {
      if (!existingCodeNames.has(c)) {
        merged.push([c, { count: 0, ratings: [], last: Date.now() }]);
      }
    }
    if (!existingCodeNames.has("GENERAL") && !customCodes.includes("GENERAL")) {
      merged.unshift(["GENERAL", { count: 0, ratings: [], last: 0 }]);
    }
    return merged;
  }, [livePeerItems, customCodes]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayItems]);

  // Handle Send Message via real XMTP
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageDraft.trim()) return;

    if (!activeContact?.address) {
      alert("Please select or add a recipient contact first.");
      return;
    }

    if (!client || xmtpStatus !== "ready") {
      const want = confirm("XMTP messaging is not yet enabled for your connected wallet. Would you like to enable messaging now (1-click gasless signature)?");
      if (want) {
        initXmtp();
      }
      return;
    }

    const textToSend = messageDraft.trim();
    setMessageDraft("");

    try {
      await sendText(activeContact.address, activeCode, textToSend);
    } catch (err: any) {
      console.warn("XMTP send error:", err);
      alert(err?.message || "Failed to send message via XMTP");
    }
  };

  // Handle Submit Feedback via Robinhood Contract & XMTP
  const handleSubmitFeedback = async () => {
    if (!activeContact?.address) {
      alert("Please select a recipient contact first.");
      return;
    }

    setShowFeedbackPopover(false);
    const comment = feedbackNote.trim() || "Cryptographic review signed on-chain.";
    setFeedbackNote("");

    // 1. On-Chain Attestation to Robinhood Testnet
    if (attestOnChain && contractAddress && isAddress(contractAddress)) {
      try {
        setIsAttesting(true);
        const targetPeer = isAddress(activeContact.address)
          ? (activeContact.address as `0x${string}`)
          : ("0x0000000000000000000000000000000000000000" as `0x${string}`);

        await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: CHATCODE_UNIFIED_ABI,
          functionName: "submitReview",
          args: [
            activeCode,
            targetPeer,
            feedbackRating,
            feedbackCategory,
            comment,
          ],
        });
        // Trigger server refresh to load the newly mined review
        setTimeout(fetchStuff, 2000);
      } catch (err: any) {
        console.warn("On-chain review transaction rejected or failed:", err);
      } finally {
        setIsAttesting(false);
      }
    }

    // 2. XMTP P2P Relayer DM
    if (client && xmtpStatus === "ready") {
      try {
        await sendFeedback(
          activeContact.address,
          activeCode,
          feedbackRating as 1 | 2 | 3 | 4 | 5,
          feedbackCategory,
          comment
        );
      } catch (err) {
        console.warn("XMTP feedback send error:", err);
      }
    }
  };

  // Add Contact Modal logic
  const handleValidateModalInput = async (val: string) => {
    setModalAddressInput(val);
    setModalError("");
    if (!val.trim()) {
      setModalValidationStatus("empty");
      return;
    }
    setModalValidationStatus("validating");
    try {
      if (isAddress(val)) {
        setModalValidationStatus("valid");
      } else if (val.includes(".")) {
        const resolved = await resolveAddress(val);
        if (resolved) {
          setModalValidationStatus("valid");
        } else {
          setModalValidationStatus("invalid");
        }
      } else {
        setModalValidationStatus("invalid");
      }
    } catch {
      setModalValidationStatus("invalid");
    }
  };

  const handleConfirmAddContact = async () => {
    const raw = modalAddressInput.trim();
    if (!raw) {
      setModalError("Please enter a wallet address or ENS name.");
      return;
    }
    setModalError("");
    try {
      let resolvedAddr: Address | null = null;
      let ens: string | undefined = undefined;
      if (isAddress(raw)) {
        resolvedAddr = getAddress(raw) as Address;
      } else if (raw.includes(".")) {
        const res = await resolveAddress(raw);
        if (!res) {
          setModalError("Could not resolve ENS name.");
          return;
        }
        resolvedAddr = res;
        ens = raw;
      } else {
        setModalError("Invalid address or ENS.");
        return;
      }

      const key = resolvedAddr.toLowerCase() as Address;
      let peerInbox: string | undefined = undefined;
      if (client) {
        try {
          peerInbox = await getInboxId(client, key);
        } catch {}
      }

      const customName = modalAliasInput.trim();
      const finalAlias = customName || ens || `${key.slice(0, 6)}…${key.slice(-4)}`;

      upsertContact({
        address: key,
        alias: finalAlias,
        ensName: ens,
        inboxId: peerInbox,
        reachable: true,
      });

      setSelectedAddress(key);
      setShowAddModal(false);
      setModalAddressInput("");
      setModalAliasInput("");
      setModalValidationStatus("empty");
    } catch (e: any) {
      setModalError(e.message || "Failed to add contact");
    }
  };

  const handleAddNewCode = () => {
    const code = normalizeCode(newCodeDraft);
    if (isValidCode(code)) {
      if (!customCodes.includes(code)) {
        setCustomCodes((prev) => [...prev, code]);
      }
      setActiveCode(code);
      setNewCodeDraft("");
      setIsAddingCode(false);
    }
  };

  const displayAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "Not Connected";

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface text-on-surface font-body-md select-none">
      {/* Top Application Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-surface-container-lowest border-b-[1.5px] border-[#0A0A0A]">
        <div className="h-14 w-full px-space-md flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <Link
              href="/"
              className="flex items-center gap-space-sm group"
              title="Return to Landing Page"
            >
              <div className="w-8 h-8 rounded-lg bg-primary-container border-[1.5px] border-[#0A0A0A] flex items-center justify-center shadow-[2px_2px_0px_#0A0A0A] group-hover:translate-x-[1px] group-hover:translate-y-[1px] transition-transform">
                <Icon name="chat_bubble" size={18} className="text-on-primary-container" />
              </div>
              <span className="font-headline-sm text-headline-sm text-[#0A0A0A] tracking-tight">
                ChatCode
              </span>
            </Link>
            <span className="font-label-code-sm text-label-code-sm px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant uppercase">
              P2P Relayer
            </span>

            {/* Live Server & Robinhood Network Status Badge */}
            {serverStuff?.network && (
              <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface border-[1.5px] border-[#0A0A0A] font-label-code-sm text-[11px] text-[#0A0A0A]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Robinhood Testnet #{serverStuff.network.blockNumber}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-space-sm sm:gap-space-md">
            {/* Robinhood Testnet Network Switcher */}
            {isConnected && (
              chainId === ROBINHOOD_TESTNET_CHAIN_ID ? (
                <a
                  href="https://explorer.testnet.chain.robinhood.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0A0A0A] text-white border-[1.5px] border-[#0A0A0A] shadow-[2px_2px_0px_#2F6FED] font-label-code-sm text-[11px] font-bold hover:opacity-90"
                  title="Connected to Robinhood Chain Testnet (46630) — Click to view explorer"
                >
                  <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                  Robinhood Testnet
                  <span className="text-[9px] opacity-70">46630</span>
                </a>
              ) : (
                <button
                  onClick={() => switchChain && switchChain({ chainId: ROBINHOOD_TESTNET_CHAIN_ID })}
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-100 text-amber-950 border-[1.5px] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] font-label-code-sm text-[11px] font-bold hover:bg-amber-200 cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                  title="Click to switch your wallet to Robinhood Chain Testnet (46630)"
                  type="button"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Switch to Robinhood
                </button>
              )
            )}

            {/* Active Robinhood Chain Smart Contract */}
            <a
              href={`https://explorer.testnet.chain.robinhood.com/address/${contractAddress}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border-[1.5px] border-[#0A0A0A] bg-surface-container-high text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] font-label-code-sm text-[11px] font-bold hover:bg-surface active:translate-x-[1px] active:translate-y-[1px] transition-all"
              title="Verified ChatCodeUnified contract on Robinhood Chain Testnet — Click to open explorer"
            >
              <Icon name="tag" size={13} />
              <span>Contract: {contractAddress.slice(0, 6)}…{contractAddress.slice(-4)} ↗</span>
            </a>

            {/* Wallet / XMTP status badge */}
            <div className="flex items-center gap-space-sm px-space-sm py-1 rounded bg-surface-container-low border-[1.5px] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected && xmtpStatus === "ready"
                    ? "bg-green-600 animate-pulse"
                    : isConnected
                    ? "bg-amber-500 animate-pulse"
                    : "bg-neutral-400"
                }`}
              />
              <span className="font-label-code-md text-label-code-md text-[#0A0A0A]">
                {displayAddress}
              </span>
            </div>

            {/* Action Buttons */}
            {isConnected ? (
              <>
                {xmtpStatus !== "ready" && (
                  <button
                    onClick={() => initXmtp()}
                    disabled={xmtpStatus === "initializing"}
                    className={`font-label-code-md text-label-code-md px-space-sm py-1 rounded-lg border-[1.5px] border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#0A0A0A] transition-all cursor-pointer ${
                      xmtpStatus === "error"
                        ? "bg-amber-200 text-amber-950 hover:bg-amber-300"
                        : "bg-primary-container text-on-primary-container hover:opacity-95"
                    }`}
                    type="button"
                    title={xmtpError || "Click to sign and enable XMTP messaging"}
                  >
                    {xmtpStatus === "initializing"
                      ? "Signing in wallet…"
                      : xmtpStatus === "error"
                      ? "Retry enabling"
                      : "Enable messaging"}
                  </button>
                )}
                <button
                  onClick={() => {
                    disconnect();
                    setSelectedAddress(null);
                  }}
                  className="font-label-code-md text-label-code-md px-space-sm py-1 rounded-lg bg-surface-container-lowest text-[#0A0A0A] border-[1.5px] border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] hover:bg-surface-container-high active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#0A0A0A] transition-all cursor-pointer"
                  type="button"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  const injectedConn = connectors.find((c) => c.id === "injected") || connectors[0];
                  if (injectedConn) connect({ connector: injectedConn });
                }}
                disabled={connectPending}
                className="font-label-code-md text-label-code-md px-space-sm py-1 rounded-lg bg-primary-container text-on-primary-container border-[1.5px] border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#0A0A0A] transition-all cursor-pointer"
                type="button"
              >
                {connectPending ? "Connecting…" : "Connect Wallet"}
              </button>
            )}

            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center border border-[#0A0A0A]">
              <Icon name="account_circle" size={18} className="text-on-primary" />
            </div>
          </div>
        </div>
      </header>

      {/* Slim Icon Navigation Sidebar */}
      <aside className="fixed left-0 top-14 bottom-0 w-16 bg-surface-container-lowest border-r-[1.5px] border-[#0A0A0A] z-40 flex flex-col items-center py-space-md justify-between">
        <nav className="flex flex-col gap-space-sm w-full px-space-xs">
          <button
            className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-all bg-primary-container text-on-primary-container border-[1.5px] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]"
            title="Active Threads"
            type="button"
          >
            <Icon name="forum" size={20} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all cursor-pointer"
            title="Add New Wallet / Contact"
            type="button"
          >
            <Icon name="contacts" size={20} />
          </button>
          <button
            onClick={() => {
              fetchStuff();
              alert(`Robinhood Chain Testnet Status: ${serverStuff?.network?.status || "online"}\nLatest Block: #${serverStuff?.network?.blockNumber || "syncing"}\nContract Linked: ${contractAddress || "None"}`);
            }}
            className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all cursor-pointer"
            title="Query Server & Network Status"
            type="button"
          >
            <Icon name="hub" size={20} />
          </button>
        </nav>
        <div className="flex flex-col gap-space-sm items-center w-full">
          <a
            href={`https://explorer.testnet.chain.robinhood.com/address/${contractAddress}`}
            target="_blank"
            rel="noreferrer"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all cursor-pointer"
            title={`View ChatCode Contract (${contractAddress.slice(0, 6)}…${contractAddress.slice(-4)}) on Robinhood Explorer`}
          >
            <Icon name="tag" size={20} />
          </a>
        </div>
      </aside>

      {/* Main Container Area */}
      <div className="pl-16 pt-14 h-full flex w-full">
        <div className="flex h-[calc(100vh-56px)] w-full overflow-hidden bg-surface-container-lowest text-on-surface">
          {/* LEFT PANE: Real Contacts List */}
          <aside className="w-[340px] flex-shrink-0 flex flex-col bg-surface-container-lowest border-r-[1.5px] border-[#0A0A0A] h-full relative z-20">
            {/* Header */}
            <div className="p-space-md flex items-center justify-between border-b-[1.5px] border-[#0A0A0A] bg-surface-container-lowest">
              <div className="flex items-center gap-space-sm">
                <h2 className="font-headline-sm text-headline-sm text-[#0A0A0A] tracking-tight">
                  Chats
                </h2>
                <span className="font-label-code-sm text-label-code-sm px-1.5 py-0.5 rounded bg-surface-container border-[1.5px] border-[#0A0A0A] text-[#0A0A0A] font-semibold">
                  {contacts.length} active
                </span>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="w-9 h-9 rounded-lg bg-primary-container text-on-primary-container border-[1.5px] border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] hover:opacity-95 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#0A0A0A] flex items-center justify-center transition-all cursor-pointer"
                title="Add contact"
                type="button"
              >
                <Icon name="add" size={20} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-space-md border-b-[1.5px] border-[#0A0A0A] bg-surface">
              <div className="relative flex items-center">
                <Icon
                  name="search"
                  size={18}
                  className="absolute left-3 text-on-surface-variant pointer-events-none"
                />
                <input
                  className="w-full pl-9 pr-3 py-2 bg-surface-container-lowest rounded-lg border-[1.5px] border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] font-body-sm text-body-sm text-[#0A0A0A] placeholder-on-surface-variant focus:outline-none focus:shadow-[4px_4px_0px_#2F6FED] transition-all"
                  placeholder="Search contacts…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  type="text"
                />
              </div>
            </div>

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto divide-y-[1.5px] divide-[#0A0A0A] bg-surface-container-lowest">
              {filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                  <div className="w-12 h-12 rounded-lg bg-surface border-[1.5px] border-[#0A0A0A] flex items-center justify-center shadow-[2px_2px_0px_#0A0A0A] mb-3">
                    <Icon name="contacts" size={22} className="text-[#0A0A0A]/60" />
                  </div>
                  <p className="font-headline-sm text-sm font-bold text-[#0A0A0A]">
                    {searchQuery ? "No matching contacts" : "No contacts yet"}
                  </p>
                  <p className="font-body-sm text-[12px] text-[#0A0A0A]/70 mt-1 max-w-[200px]">
                    {searchQuery
                      ? "Try searching another address or alias."
                      : "Add a peer wallet address or ENS name to start messaging."}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-4 px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-label-code-sm text-xs font-bold border-[1.5px] border-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] hover:opacity-95 active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                      type="button"
                    >
                      + Add First Contact
                    </button>
                  )}
                </div>
              ) : (
                filteredContacts.map((c) => {
                  const isSelected =
                    c.address.toLowerCase() === selectedAddress?.toLowerCase();
                  const initials =
                    c.alias
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "0X";

                  // Real last message computation
                  const peerMsgs = c.inboxId ? forPeer(c.inboxId) : [];
                  const lastMsg = peerMsgs.length > 0 ? peerMsgs[peerMsgs.length - 1] : null;
                  let lastMsgText = "No messages yet";
                  let lastMsgTime = "";
                  if (lastMsg) {
                    if (lastMsg.payload.kind === "feedback") {
                      lastMsgText = `★ ${lastMsg.payload.score}/5: ${lastMsg.payload.text}`;
                    } else {
                      lastMsgText = lastMsg.payload.text;
                    }
                    const d = new Date(lastMsg.sentAt);
                    lastMsgTime = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
                  }

                  return (
                    <div
                      key={c.address}
                      onClick={() => setSelectedAddress(c.address)}
                      className={`group relative flex items-start gap-space-sm p-3.5 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[rgba(47,111,237,0.08)] border-l-[4px] border-l-primary-container"
                          : "hover:bg-surface-container-low"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg border-[1.5px] border-[#0A0A0A] flex items-center justify-center font-headline-sm text-[14px] font-bold flex-shrink-0 shadow-[2px_2px_0px_#0A0A0A] ${
                          isSelected
                            ? "bg-primary-container text-on-primary-container"
                            : "bg-[#0A0A0A] text-on-primary"
                        }`}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-headline-sm text-[14px] text-[#0A0A0A] font-bold truncate">
                            {c.alias}
                          </span>
                          {lastMsgTime && (
                            <span className="font-label-code-sm text-label-code-sm text-[#0A0A0A] opacity-70">
                              {lastMsgTime}
                            </span>
                          )}
                        </div>
                        <div className="font-label-code-sm text-label-code-sm text-[#0A0A0A] opacity-60 mb-1">
                          {c.ensName || `${c.address.slice(0, 6)}…${c.address.slice(-4)}`}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-body-sm text-[12px] text-[#0A0A0A] truncate pr-2 opacity-80">
                            {lastMsgText}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Requests Bar */}
            <div className="p-3 border-t-[1.5px] border-[#0A0A0A] bg-surface-container-lowest flex items-center justify-between">
              <button
                className="flex items-center gap-space-sm hover:opacity-80 transition-opacity cursor-pointer"
                onClick={() => setIsRequestsOpen(!isRequestsOpen)}
                type="button"
              >
                <span className="font-headline-sm text-[13px] text-[#0A0A0A] font-bold">
                  Requests
                </span>
                <span className={`px-1.5 py-0.5 rounded font-label-code-sm text-label-code-sm border-[1.5px] border-[#0A0A0A] ${
                  requests.length > 0 ? "bg-primary-container text-on-primary shadow-[2px_2px_0px_#0A0A0A]" : "bg-surface-container text-[#0A0A0A]"
                }`}>
                  {requests.length} new
                </span>
              </button>
              <span className="font-label-code-sm text-[11px] text-[#0A0A0A] opacity-60">
                Inbound XMTP consent
              </span>
            </div>

            {/* Inbound Requests Drawer */}
            {isRequestsOpen && (
              <div className="p-3 border-t-[1.5px] border-[#0A0A0A] bg-surface space-y-2 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-headline-sm text-xs font-bold text-[#0A0A0A]">Pending Inbound DMs</span>
                  <button onClick={() => setIsRequestsOpen(false)} className="text-xs text-[#0A0A0A]/60 hover:text-[#0A0A0A]">✕</button>
                </div>
                {requests.length === 0 ? (
                  <p className="font-body-sm text-xs text-[#0A0A0A]/60 italic">No pending connection requests.</p>
                ) : (
                  requests.map((r) => (
                    <div key={r.peerInboxId} className="p-2 rounded bg-surface-container-lowest border border-[#0A0A0A] text-xs space-y-1">
                      <p className="font-mono truncate font-bold text-[#0A0A0A]">{r.peerInboxId.slice(0, 16)}…</p>
                      <p className="text-[#0A0A0A]/80 truncate">{r.preview}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => acceptRequest(r.peerInboxId)}
                          className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-bold border border-[#0A0A0A]"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => blockRequest(r.peerInboxId)}
                          className="px-2 py-0.5 rounded bg-surface text-red-600 font-bold border border-red-600"
                        >
                          Block
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </aside>

          {/* RIGHT PANE: Conversation Thread */}
          <main className="flex-1 flex flex-col h-full bg-surface-container-lowest relative overflow-hidden">
            {/* Background Grid Pattern */}
            <div
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                backgroundSize: "36px 36px",
                backgroundImage:
                  "linear-gradient(to right, rgba(10, 10, 10, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(10, 10, 10, 0.05) 1px, transparent 1px)",
              }}
            />

            {!activeContact ? (
              /* EMPTY MAIN PANE WHEN NO CONTACT SELECTED */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative z-10">
                <div className="w-16 h-16 rounded-xl bg-primary-container border-[1.5px] border-[#0A0A0A] flex items-center justify-center shadow-[4px_4px_0px_#0A0A0A] mb-4">
                  <Icon name="chat_bubble" size={32} className="text-on-primary-container" />
                </div>
                <h3 className="font-headline-sm text-lg font-bold text-[#0A0A0A]">
                  No Active Chat Selected
                </h3>
                <p className="font-body-sm text-sm text-[#0A0A0A]/70 max-w-sm mt-1">
                  Select a contact from the left sidebar or click below to add a wallet address / ENS name.
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-code-md text-xs font-bold border-[1.5px] border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                    type="button"
                  >
                    + Add New Contact
                  </button>
                  {!isConnected && (
                    <button
                      onClick={() => {
                        const injectedConn = connectors.find((c) => c.id === "injected") || connectors[0];
                        if (injectedConn) connect({ connector: injectedConn });
                      }}
                      className="px-4 py-2 rounded-lg bg-surface-container-lowest text-[#0A0A0A] font-label-code-md text-xs font-bold border-[1.5px] border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] hover:bg-surface active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                      type="button"
                    >
                      Connect Wallet
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ACTIVE THREAD VIEW */
              <div className="flex-1 flex flex-col h-full relative z-10">
                {/* Thread Header */}
                <header className="h-16 px-space-md border-b-[1.5px] border-[#0A0A0A] bg-surface-container-lowest flex items-center justify-between flex-shrink-0 z-20">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-10 h-10 rounded-lg bg-primary-container border-[1.5px] border-[#0A0A0A] flex items-center justify-center text-on-primary-container font-headline-sm text-[15px] font-bold shadow-[2px_2px_0px_#0A0A0A]">
                      {activeContact.alias.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      {isEditingAlias ? (
                        <div className="flex items-center gap-1.5 mb-1">
                          <input
                            type="text"
                            value={aliasEditValue}
                            onChange={(e) => setAliasEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (activeContact) {
                                  updateAlias(activeContact.address, aliasEditValue);
                                }
                                setIsEditingAlias(false);
                              } else if (e.key === "Escape") {
                                setIsEditingAlias(false);
                              }
                            }}
                            autoFocus
                            className="px-2 py-0.5 border-[1.5px] border-[#0A0A0A] rounded font-headline-sm text-[15px] font-bold bg-surface-container-lowest focus:outline-none focus:shadow-[2px_2px_0px_#2F6FED]"
                            placeholder="Enter contact name…"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (activeContact) {
                                updateAlias(activeContact.address, aliasEditValue);
                              }
                              setIsEditingAlias(false);
                            }}
                            title="Save name"
                            className="px-2.5 py-1 rounded bg-primary-container text-on-primary-container border-[1.5px] border-[#0A0A0A] font-label-code-sm text-xs font-bold shadow-[1.5px_1.5px_0px_#0A0A0A] hover:opacity-90 cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingAlias(false)}
                            title="Cancel"
                            className="px-2 py-1 rounded bg-surface border-[1.5px] border-[#0A0A0A] font-label-code-sm text-xs hover:bg-surface-container cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-headline-sm text-[16px] text-[#0A0A0A] font-bold leading-tight">
                            {activeContact.alias}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setAliasEditValue(activeContact.alias);
                              setIsEditingAlias(true);
                            }}
                            title="Edit contact name"
                            className="w-6 h-6 rounded flex items-center justify-center border border-[#0A0A0A] bg-surface hover:bg-surface-container shadow-[1px_1px_0px_#0A0A0A] text-[#0A0A0A] cursor-pointer"
                          >
                            <Icon name="edit" size={12} />
                          </button>
                          <span className="flex items-center gap-1 font-label-code-sm text-[11px] text-[#0A0A0A] border-[1.5px] border-[#0A0A0A] px-1.5 py-0.2 rounded bg-surface shadow-[1.5px_1.5px_0px_#0A0A0A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
                            {activeContact.reachable ? "XMTP Verified" : "Peer"}
                          </span>
                          <span className="flex items-center gap-1 font-label-code-sm text-[11px] text-primary-container border-[1.5px] border-[#0A0A0A] px-1.5 py-0.2 rounded bg-surface-container-lowest shadow-[1.5px_1.5px_0px_#0A0A0A]">
                            <Icon name="lock" size={13} />
                            End-to-end encrypted
                          </span>
                        </div>
                      )}
                      <div className="font-label-code-sm text-label-code-sm text-[#0A0A0A] opacity-60">
                        {activeContact.address
                          ? `${activeContact.address.slice(0, 6)}…${activeContact.address.slice(-4)}`
                          : ""}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#0A0A0A] bg-surface-container-lowest shadow-[2px_2px_0px_#0A0A0A] font-label-code-sm text-label-code-sm text-[#0A0A0A] flex items-center gap-1 hover:bg-surface active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                      title="View thread chat code identity"
                      type="button"
                      onClick={() => alert(`Channel Code: ${activeCode}\nEncryption: Ed25519\nNetwork: XMTP Zero Gas\nContract: ${contractAddress || "None"}`)}
                    >
                      <Icon name="tag" size={15} />
                      CODE INFO
                    </button>
                    <button
                      className="w-9 h-9 rounded-lg border-[1.5px] border-[#0A0A0A] bg-surface-container-lowest shadow-[2px_2px_0px_#0A0A0A] flex items-center justify-center hover:bg-surface active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                      title="Export transcript"
                      type="button"
                      onClick={() => {
                        const text = JSON.stringify(displayItems, null, 2);
                        const blob = new Blob([text], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `chatcode-${activeCode}.json`;
                        a.click();
                      }}
                    >
                      <Icon name="download" size={18} />
                    </button>
                    <button
                      className="w-9 h-9 rounded-lg border-[1.5px] border-[#ba1a1a] bg-surface-container-lowest text-[#ba1a1a] shadow-[2px_2px_0px_#ba1a1a] flex items-center justify-center hover:bg-red-50 active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                      title="Delete contact"
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${activeContact.alias} from contacts?`)) {
                          removeContact(activeContact.address);
                          setSelectedAddress(null);
                        }
                      }}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                </header>

                {/* Chat Code Switcher Bar */}
                <div className="px-space-md py-2 border-b-[1.5px] border-[#0A0A0A] bg-surface-container-lowest flex items-center gap-2 overflow-x-auto flex-shrink-0 z-10">
                  <span className="font-label-code-sm text-[11px] text-[#0A0A0A] uppercase tracking-wider font-bold mr-1">
                    CHANNELS:
                  </span>
                  {availableCodes.map(([code, s]) => {
                    const isActive = code === activeCode;
                    const avgRating =
                      s.ratings && s.ratings.length > 0
                        ? (s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length).toFixed(1)
                        : null;

                    return (
                      <button
                        key={code}
                        onClick={() => setActiveCode(code)}
                        className={`px-3 py-1 rounded-lg border-[1.5px] border-[#0A0A0A] font-label-code-sm text-label-code-sm flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
                          isActive
                            ? "bg-primary-container text-on-primary-container font-bold shadow-[4px_4px_0px_#0A0A0A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#0A0A0A]"
                            : "bg-surface-container-lowest text-[#0A0A0A] hover:bg-surface shadow-[2px_2px_0px_#0A0A0A] active:translate-x-[1px] active:translate-y-[1px]"
                        }`}
                        type="button"
                      >
                        {code}
                        <span className={isActive ? "opacity-80" : "opacity-50"}>
                          · {s.count}
                        </span>
                        {avgRating && (
                          <span className="font-bold">★ {avgRating}</span>
                        )}
                      </button>
                    );
                  })}

                  {/* Add new code input or button */}
                  {isAddingCode ? (
                    <div className="flex items-center gap-1">
                      <input
                        className="px-2 py-1 rounded-lg border-[1.5px] border-[#0A0A0A] bg-surface font-label-code-sm text-label-code-sm uppercase w-28 focus:outline-none"
                        placeholder="ORDER-…"
                        value={newCodeDraft}
                        onChange={(e) => setNewCodeDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddNewCode()}
                        autoFocus
                      />
                      <button
                        onClick={handleAddNewCode}
                        className="px-2 py-1 bg-primary-container text-on-primary-container font-label-code-sm text-label-code-sm rounded border border-[#0A0A0A]"
                        type="button"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setIsAddingCode(false)}
                        className="px-1 py-1 text-xs"
                        type="button"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className="px-3 py-1 rounded-lg border-[1.5px] border-dashed border-[#0A0A0A] bg-transparent text-[#0A0A0A] font-label-code-sm text-label-code-sm hover:bg-surface active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      onClick={() => setIsAddingCode(true)}
                      type="button"
                    >
                      <Icon name="add" size={14} />
                      New code
                    </button>
                  )}
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-space-md space-y-4">
                  {/* Day Divider */}
                  <div className="flex items-center justify-center my-3">
                    <span className="px-3 py-1 rounded-full border-[1.5px] border-[#0A0A0A] bg-surface-container-lowest font-label-code-sm text-[11px] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]">
                      Verified P2P Session · Zero Gas
                    </span>
                  </div>

                  {displayItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-12 h-12 rounded-lg bg-surface border-[1.5px] border-[#0A0A0A] flex items-center justify-center shadow-[2px_2px_0px_#0A0A0A] mb-3">
                        <Icon name="forum" size={24} className="text-primary-container" />
                      </div>
                      <p className="font-headline-sm text-sm font-bold text-[#0A0A0A]">
                        No messages in channel [{activeCode}]
                      </p>
                      <p className="font-body-sm text-xs text-[#0A0A0A]/70 max-w-xs mt-1">
                        Send the first zero-gas encrypted message or attach an on-chain review below.
                      </p>
                    </div>
                  ) : (
                    displayItems.map((item) => {
                      if (item.payload.kind === "feedback") {
                        const fb = item.payload;
                        return (
                          <div key={item.id} className="flex justify-center my-4">
                            <div className="w-full max-w-[620px] bg-surface-container-lowest border-[1.5px] border-[#0A0A0A] rounded-lg p-4 shadow-[4px_4px_0px_#0A0A0A]">
                              <div className="flex items-center justify-between pb-2 border-b-[1.5px] border-[#0A0A0A]">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-code-sm text-[11px] font-bold border-[1.5px] border-[#0A0A0A]">
                                    SESSION REVIEW [{fb.chatCode}]
                                  </span>
                                  <span className="font-label-code-sm text-[11px] text-[#0A0A0A] font-bold uppercase">
                                    CATEGORY: {fb.category}
                                  </span>
                                </div>
                                {item.onChainTx ? (
                                  <a
                                    href={`https://explorer.testnet.chain.robinhood.com/tx/${item.onChainTx}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-label-code-sm text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 border-[1.5px] border-[#0A0A0A] hover:bg-emerald-200 transition-colors flex items-center gap-1 font-bold shadow-[1px_1px_0px_#0A0A0A]"
                                    title="View attestation on Robinhood Chain Explorer"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                    <span>ROBINHOOD ON-CHAIN ↗</span>
                                  </a>
                                ) : (
                                  <span className="font-label-code-sm text-label-code-sm px-2 py-0.5 rounded bg-surface border-[1.5px] border-[#0A0A0A] text-[#0A0A0A]">
                                    ED25519 SIGNED
                                  </span>
                                )}
                              </div>
                              <div className="my-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Icon
                                      key={s}
                                      name="star"
                                      filled={s <= fb.score}
                                      size={20}
                                      className={
                                        s <= fb.score
                                          ? "text-amber-500"
                                          : "text-[#0A0A0A]/30"
                                      }
                                    />
                                  ))}
                                  <span className="ml-2 font-headline-sm text-[15px] text-[#0A0A0A] font-bold">
                                    {fb.score}.0 / 5.0 Rating
                                  </span>
                                </div>
                              </div>
                              <blockquote className="p-3 bg-surface rounded border-[1.5px] border-[#0A0A0A] font-body-md text-body-md text-[#0A0A0A] italic my-2">
                                “{fb.text}”
                              </blockquote>
                              <div className="mt-2 pt-2 border-t-[1.5px] border-[#0A0A0A] flex items-center justify-between font-label-code-sm text-[11px] text-[#0A0A0A] opacity-80">
                                <span>
                                  Signed by{" "}
                                  <span className="font-bold">
                                    {item.mine ? displayAddress : activeContact.alias}
                                  </span>
                                </span>
                                <span className="text-primary-container font-semibold">
                                  Cryptographic Record
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Standard text message bubble
                      const isMine = item.mine;
                      const date = new Date(item.sentAt);
                      const timeStr = `${String(date.getUTCHours()).padStart(2, "0")}:${String(
                        date.getUTCMinutes()
                      ).padStart(2, "0")} UTC`;

                      return (
                        <div
                          key={item.id}
                          className={`flex flex-col max-w-[620px] ${
                            isMine ? "items-end ml-auto" : "items-start"
                          }`}
                        >
                          <div
                            className={`border-[1.5px] border-[#0A0A0A] rounded-lg p-3.5 shadow-[4px_4px_0px_#0A0A0A] ${
                              isMine
                                ? "bg-primary-container text-on-primary-container"
                                : "bg-surface-container-lowest text-[#0A0A0A]"
                            }`}
                          >
                            <div
                              className={`flex items-center justify-between gap-4 mb-1.5`}
                            >
                              <span
                                className={`font-label-code-sm text-[11px] font-bold ${
                                  isMine
                                    ? "text-on-primary-container"
                                    : "text-primary-container"
                                }`}
                              >
                                [{item.payload.chatCode}]
                              </span>
                              <span
                                className={`font-label-code-sm text-[10px] ${
                                  isMine
                                    ? "text-on-primary-container opacity-80 uppercase"
                                    : "text-[#0A0A0A] opacity-60 uppercase"
                                }`}
                              >
                                {isMine
                                  ? `You (${displayAddress.slice(0, 6)})`
                                  : activeContact.alias}
                              </span>
                            </div>
                            <p
                              className={`font-body-md text-body-md leading-relaxed whitespace-pre-wrap break-words ${
                                isMine
                                  ? "text-on-primary-container"
                                  : "text-[#0A0A0A]"
                              }`}
                            >
                              {item.payload.text}
                            </p>
                            <div
                              className={`mt-2 pt-2 border-t flex items-center justify-between font-label-code-sm text-[11px] ${
                                isMine
                                  ? "border-white/20 text-on-primary-container opacity-90 justify-end gap-2"
                                  : "border-[#0A0A0A]/10 text-[#0A0A0A] opacity-60"
                              }`}
                            >
                              <span>
                                {timeStr} · {isMine ? "Signed & Delivered" : "Relayed via XMTP Node"}
                              </span>
                              <Icon
                                name={isMine ? "check_circle" : "hub"}
                                size={14}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer at Bottom */}
                <div className="relative p-space-md border-t-[1.5px] border-[#0A0A0A] bg-surface-container-lowest flex-shrink-0 z-20">
                  {/* FLOATING FEEDBACK POPOVER CARD */}
                  {showFeedbackPopover && (
                    <div className="absolute bottom-[84px] left-6 w-[420px] bg-surface-container-lowest border-[1.5px] border-[#0A0A0A] rounded-lg p-4 shadow-[6px_6px_0px_#0A0A0A] z-40">
                      <div className="flex items-center justify-between pb-2 border-b-[1.5px] border-[#0A0A0A] mb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="shield" size={18} className="text-primary-container" />
                          <h4 className="font-headline-sm text-[15px] font-bold text-[#0A0A0A]">
                            Submit Verified Feedback
                          </h4>
                        </div>
                        <button
                          className="text-[#0A0A0A] hover:opacity-70 cursor-pointer"
                          onClick={() => setShowFeedbackPopover(false)}
                          type="button"
                        >
                          <Icon name="close" size={18} />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block font-label-code-sm text-[11px] text-[#0A0A0A] uppercase font-bold mb-1">
                            Score Rating (1-5)
                          </label>
                          <div className="flex items-center gap-2 cursor-pointer">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setFeedbackRating(star)}
                                type="button"
                                className="cursor-pointer transition-transform hover:scale-110"
                              >
                                <Icon
                                  name="star"
                                  filled={star <= feedbackRating}
                                  size={24}
                                  className={
                                    star <= feedbackRating
                                      ? "text-amber-500"
                                      : "text-[#0A0A0A]/30"
                                  }
                                />
                              </button>
                            ))}
                            <span className="ml-2 font-label-code-md text-label-code-md text-[#0A0A0A] font-bold">
                              {feedbackRating}.0 / 5.0
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block font-label-code-sm text-[11px] text-[#0A0A0A] uppercase font-bold mb-1">
                            Feedback Category
                          </label>
                          <select
                            className="w-full px-2.5 py-1.5 bg-surface-container-lowest border-[1.5px] border-[#0A0A0A] rounded-lg font-body-sm text-body-sm text-[#0A0A0A] focus:outline-none focus:shadow-[2px_2px_0px_#2F6FED]"
                            value={feedbackCategory}
                            onChange={(e) =>
                              setFeedbackCategory(e.target.value as FeedbackCategory)
                            }
                          >
                            <option value="delivery">Delivery & Milestone Sign-off</option>
                            <option value="service">Service Speed</option>
                            <option value="communication">P2P Communication</option>
                            <option value="quality">Quality Verification</option>
                            <option value="other">Other / Escrow</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-label-code-sm text-[11px] text-[#0A0A0A] uppercase font-bold mb-1">
                            Attestation Note
                          </label>
                          <textarea
                            className="w-full p-2 bg-surface rounded-lg border-[1.5px] border-[#0A0A0A] font-body-sm text-body-sm text-[#0A0A0A] focus:outline-none focus:shadow-[2px_2px_0px_#2F6FED] resize-none"
                            placeholder="Write cryptographically signed review comment…"
                            rows={2}
                            value={feedbackNote}
                            onChange={(e) => setFeedbackNote(e.target.value)}
                          />
                        </div>

                        <div className="p-2.5 rounded border-[1.5px] border-[#0A0A0A] bg-surface flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="font-label-code-sm text-[11px] font-bold text-[#0A0A0A]">
                              Attest On-Chain (Robinhood Testnet)
                            </span>
                            <span className="font-body-sm text-[11px] text-[#0A0A0A]/60">
                              Verified on contract 0x3136…f5a6
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={attestOnChain}
                            onChange={(e) => setAttestOnChain(e.target.checked)}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </div>

                        <button
                          className="w-full py-2 bg-primary-container text-on-primary-container font-label-code-md text-label-code-md font-bold rounded-lg border-[1.5px] border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] hover:opacity-95 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#0A0A0A] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                          onClick={handleSubmitFeedback}
                          disabled={isAttesting}
                          type="button"
                        >
                          {isAttesting ? (
                            <>
                              <Icon name="sync" size={16} className="animate-spin" />
                              <span>Broadcasting to Robinhood Testnet…</span>
                            </>
                          ) : (
                            <span>Submit review [{activeCode}]</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Composer Form Row */}
                  <form
                    className="flex items-center gap-space-sm"
                    onSubmit={handleSendMessage}
                  >
                    <button
                      className="px-3 py-2.5 rounded-lg border-[1.5px] border-[#0A0A0A] bg-surface-container-lowest text-[#0A0A0A] font-label-code-md text-label-code-md font-bold shadow-[4px_4px_0px_#0A0A0A] hover:bg-surface active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#0A0A0A] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      onClick={() => setShowFeedbackPopover(!showFeedbackPopover)}
                      type="button"
                    >
                      <Icon
                        name="star"
                        filled
                        size={18}
                        className="text-amber-500"
                      />
                      ★ Feedback
                    </button>
                    <div className="relative flex-1 flex items-center">
                      <input
                        className="w-full pl-3 pr-10 py-2.5 bg-surface-container-lowest border-[1.5px] border-[#0A0A0A] rounded-lg shadow-[2px_2px_0px_#0A0A0A] font-body-md text-body-md text-[#0A0A0A] placeholder-on-surface-variant focus:outline-none focus:shadow-[4px_4px_0px_#2F6FED] transition-all"
                        placeholder={`Message in ${activeCode}…`}
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        type="text"
                      />
                      <Icon
                        name="lock"
                        size={18}
                        className="absolute right-3 text-[#0A0A0A] opacity-50 pointer-events-none"
                      />
                    </div>
                    <button
                      className="px-4 py-2.5 rounded-lg bg-primary-container text-on-primary-container border-[1.5px] border-[#0A0A0A] shadow-[4px_4px_0px_#0A0A0A] hover:opacity-95 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#0A0A0A] flex items-center justify-center transition-all cursor-pointer"
                      type="submit"
                    >
                      <Icon name="send" size={18} />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* MODAL: ADD NEW WALLET / CONTACT */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]/40 backdrop-blur-[1px]">
          <div className="w-[460px] bg-surface-container-lowest border-[1.5px] border-[#0A0A0A] rounded-lg shadow-[8px_8px_0px_#0A0A0A] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b-[1.5px] border-[#0A0A0A] flex items-center justify-between bg-surface">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary-container border border-[#0A0A0A]" />
                <h3 className="font-headline-sm text-headline-sm text-[#0A0A0A]">
                  Add new wallet
                </h3>
              </div>
              <button
                className="w-7 h-7 rounded border-[1.5px] border-[#0A0A0A] bg-surface-container-lowest flex items-center justify-center text-[#0A0A0A] hover:bg-surface-container-high cursor-pointer"
                onClick={() => setShowAddModal(false)}
                type="button"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 bg-surface-container-lowest">
              <div>
                <label className="block font-label-code-sm text-label-code-sm uppercase font-bold text-[#0A0A0A] mb-1.5">
                  Wallet address or ENS name
                </label>
                <input
                  className="w-full px-3 py-2 bg-surface-container-lowest border-[1.5px] border-[#0A0A0A] rounded-lg font-label-code-md text-label-code-md text-[#0A0A0A] placeholder-on-surface-variant focus:outline-none focus:shadow-[4px_4px_0px_#2F6FED]"
                  placeholder="0x… or name.eth"
                  value={modalAddressInput}
                  onChange={(e) => handleValidateModalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConfirmAddContact();
                    }
                  }}
                  type="text"
                />
                {modalValidationStatus === "valid" && (
                  <div className="flex items-center gap-1.5 mt-2 text-primary-container font-label-code-sm text-[11px]">
                    <Icon name="check_circle" size={15} />
                    <span>Can receive XMTP gasless messages</span>
                  </div>
                )}
                {modalValidationStatus === "invalid" && (
                  <div className="flex items-center gap-1.5 mt-2 text-red-600 font-label-code-sm text-[11px]">
                    <Icon name="close" size={15} />
                    <span>Invalid address format or unresolvable ENS</span>
                  </div>
                )}
                {modalValidationStatus === "validating" && (
                  <div className="flex items-center gap-1.5 mt-2 text-on-surface-variant font-label-code-sm text-[11px]">
                    <Icon name="sync" size={15} className="animate-spin" />
                    <span>Validating address / ENS…</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-label-code-sm text-label-code-sm uppercase font-bold text-[#0A0A0A] mb-1.5">
                  Nickname (local label)
                </label>
                <input
                  className="w-full px-3 py-2 bg-surface-container-lowest border-[1.5px] border-[#0A0A0A] rounded-lg font-body-md text-body-md text-[#0A0A0A] placeholder-on-surface-variant focus:outline-none focus:shadow-[4px_4px_0px_#2F6FED]"
                  placeholder="e.g. Supplier, Auditor, Designer"
                  value={modalAliasInput}
                  onChange={(e) => setModalAliasInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConfirmAddContact();
                    }
                  }}
                  type="text"
                />
                <p className="font-body-sm text-[12px] text-[#0A0A0A] opacity-60 mt-1">
                  Nicknames are stored only in your browser. Nobody else sees them.
                </p>
              </div>

              {modalError && (
                <div className="p-2.5 rounded border border-red-500 bg-red-50 text-red-700 text-xs">
                  {modalError}
                </div>
              )}

              <div className="p-3 rounded-lg border-[1.5px] border-[#0A0A0A] bg-surface flex items-start gap-2.5">
                <Icon name="shield" size={18} className="text-primary-container" />
                <p className="font-body-sm text-[12px] text-[#0A0A0A]">
                  Messages are end-to-end encrypted and gasless. The recipient will be notified via XMTP network.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-[1.5px] border-[#0A0A0A] bg-surface flex items-center justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-surface-container-lowest text-[#0A0A0A] border-[1.5px] border-[#0A0A0A] font-label-code-md text-label-code-md shadow-[2px_2px_0px_#0A0A0A] hover:bg-surface-container-high active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                onClick={() => setShowAddModal(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container border-[1.5px] border-[#0A0A0A] font-label-code-md text-label-code-md font-bold shadow-[4px_4px_0px_#0A0A0A] hover:opacity-95 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#0A0A0A] cursor-pointer"
                onClick={handleConfirmAddContact}
                type="button"
              >
                Add contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
