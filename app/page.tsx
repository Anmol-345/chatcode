"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

export default function Home() {
  const [copied, setCopied] = useState(false);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<
    Array<{
      sender: "peer" | "user";
      text: string;
      time: string;
      meta: string;
    }>
  >([
    {
      sender: "peer",
      text: "Hey! Transferred the 2.5 ETH escrow for milestone #2. Can you review the contract pull request?",
      time: "14:02:44 UTC",
      meta: "Relayed via XMTP Node",
    },
    {
      sender: "user",
      text: "Confirmed on-chain! Reviewing now. Leaving verified positive feedback under code ORDER-1042.",
      time: "14:03:12 UTC",
      meta: "Signed & Delivered",
    },
  ]);

  const handleCopy = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "https://chatcode-app.vercel.app");
    navigator.clipboard.writeText(`${origin}/app?code=ORDER-1042`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, "0")}:${String(
      now.getUTCMinutes()
    ).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")} UTC`;

    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: inputText.trim(),
        time: timeStr,
        meta: "Signed & Delivered",
      },
    ]);
    setInputText("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-container-lowest font-body-md text-on-surface antialiased">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface-container-lowest/95 backdrop-blur-md border-b-[1.5px] border-on-surface">
        <div className="h-20 max-w-[1200px] mx-auto px-gutter flex items-center justify-between">
          <Link className="flex items-center gap-space-sm group" href="/">
            <div className="w-8 h-8 rounded bg-primary-container border-[1.5px] border-on-surface flex items-center justify-center shadow-[2px_2px_0px_#1a1c1c]">
              <Icon name="chat_bubble" size={18} className="text-on-primary-container" />
            </div>
            <span className="font-headline-md text-headline-md text-on-surface tracking-tight">
              ChatCode
            </span>
          </Link>

          <nav
            className="hidden md:flex items-center gap-space-xl"
            data-active-classes="text-on-surface font-semibold underline underline-offset-8 decoration-2 decoration-primary-container"
          >
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
              href="#how-it-works"
            >
              How it works
            </a>
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
              href="#features"
            >
              Features
            </a>
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
              href="#docs"
            >
              Docs
            </a>
          </nav>

          <div className="flex items-center gap-space-md">
            <Link
              className="inline-flex items-center justify-center px-space-lg py-space-sm bg-primary-container text-on-primary-container font-headline-sm text-headline-sm rounded-lg border-[1.5px] border-on-surface shadow-[4px_4px_0px_#1a1c1c] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1a1c1c] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer"
              href="/app"
            >
              Launch App
            </Link>
            <Link
              href="/app"
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[1.5px_1.5px_0px_#1a1c1c] border border-on-surface"
              title="Open App Profile"
            >
              <Icon name="account_circle" size={18} className="text-on-primary" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full pt-20 bg-surface-container-lowest min-h-screen">
        <div className="flex flex-col w-full">
          {/* Top Technical Grid Hero Wrapper */}
          <section className="relative w-full overflow-hidden bg-surface-container-lowest">
            {/* Graph Background Grid Layer */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(10,10,10,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(10,10,10,0.07)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_95%)]" />

            <div className="relative max-w-[1200px] mx-auto px-gutter py-16 md:py-24">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">
                {/* Left Content Column */}
                <div className="lg:col-span-7 flex flex-col items-start gap-space-md">
                  {/* Monospace Utility Pill Tag */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-container-lowest rounded-lg border-[1.5px] border-on-surface shadow-[2px_2px_0px_#1a1c1c]">
                    <span className="text-primary-container text-sm font-label-code-md">
                      ⚡
                    </span>
                    <span className="font-label-code-md text-label-code-md text-on-surface font-semibold uppercase tracking-wider">
                      Zero Gas Messaging Protocol
                    </span>
                  </div>

                  {/* Main Impact Title */}
                  <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight mt-space-xs">
                    Chat from your wallet.{" "}
                    <span className="text-primary-container">Zero gas.</span>{" "}
                    Zero servers.
                  </h1>

                  {/* Crisp Functional Description */}
                  <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[560px] leading-relaxed">
                    End-to-end encrypted messaging between wallets, with feedback
                    organized by chat codes. No accounts, no database, no fees.
                  </p>

                  {/* Tactile CTAs */}
                  <div className="flex flex-wrap items-center gap-space-md pt-space-sm w-full sm:w-auto">
                    <Link
                      className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary-container text-on-primary-container font-headline-sm text-headline-sm rounded-lg border-[1.5px] border-on-surface shadow-[4px_4px_0px_#1a1c1c] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1a1c1c] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer"
                      href="/app"
                    >
                      <span>Launch App</span>
                      <Icon name="arrow_forward" size={18} className="text-lg leading-none" />
                    </Link>
                    <a
                      className="inline-flex items-center justify-center px-7 py-3.5 bg-surface-container-lowest text-on-surface font-headline-sm text-headline-sm rounded-lg border-[1.5px] border-on-surface shadow-[4px_4px_0px_#1a1c1c] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1a1c1c] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer"
                      href="#how-it-works"
                    >
                      How it works
                    </a>
                  </div>

                  {/* Trust Badges Strip */}
                  <div className="pt-space-md border-t-[1.5px] border-on-surface/10 w-full flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-1.5 font-label-code-sm text-label-code-sm text-on-surface font-medium">
                      <Icon name="check_circle" size={16} className="text-primary-container" />
                      <span>E2E Encrypted</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-label-code-sm text-label-code-sm text-on-surface font-medium">
                      <Icon name="check_circle" size={16} className="text-primary-container" />
                      <span>Multi-Chain</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-label-code-sm text-label-code-sm text-on-surface font-medium">
                      <Icon name="check_circle" size={16} className="text-primary-container" />
                      <span>Open Protocol</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-label-code-sm text-label-code-sm text-on-surface font-medium">
                      <Icon name="check_circle" size={16} className="text-primary-container" />
                      <span>100% On-Chain Identity</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Interactive Chat UI Card */}
                <div className="lg:col-span-5 relative mt-8 lg:mt-0">
                  {/* Floating Gas Badge */}
                  <div className="absolute -top-3 -right-2 z-20 bg-primary-container text-on-primary-container border-[1.5px] border-on-surface rounded-lg px-3 py-1 font-label-code-md text-label-code-md font-bold shadow-[2px_2px_0px_#1a1c1c] rotate-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-surface-container-lowest animate-ping" />
                    0 gas
                  </div>

                  {/* Main Neo-Brutalist Chat Mockup Window */}
                  <div className="bg-surface-container-lowest border-[1.5px] border-on-surface rounded-lg shadow-[6px_6px_0px_#1a1c1c] p-5 flex flex-col gap-4">
                    {/* Window Navigation & Metainfo Bar */}
                    <div className="flex items-center justify-between pb-3.5 border-b-[1.5px] border-on-surface">
                      <div className="flex items-center gap-2">
                        <div className="border-[1.5px] border-on-surface rounded px-2 py-0.5 font-label-code-sm text-label-code-sm bg-surface-container-lowest text-on-surface font-semibold">
                          0x7a3f…c91e
                        </div>
                        <div className="bg-on-surface text-surface-container-lowest font-label-code-sm text-label-code-sm px-2.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                          ORDER-1042
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 font-label-code-sm text-label-code-sm text-on-surface font-medium">
                        <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
                        <span>Verified Peer</span>
                      </div>
                    </div>

                    {/* Message Feed Stream */}
                    <div className="flex flex-col gap-3 py-1 max-h-[340px] overflow-y-auto">
                      {messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex flex-col max-w-[88%] gap-1 ${
                            msg.sender === "user"
                              ? "items-end ml-auto"
                              : "items-start"
                          }`}
                        >
                          <div
                            className={`p-3.5 rounded-lg border-[1.5px] border-on-surface shadow-[3px_3px_0px_#1a1c1c] ${
                              msg.sender === "user"
                                ? "bg-primary-container text-on-primary-container"
                                : "bg-on-surface text-surface-container-lowest"
                            }`}
                          >
                            <p className="font-body-sm text-body-sm leading-relaxed">
                              {msg.text}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 px-1 font-label-code-sm text-[10px] text-on-surface-variant">
                            <span>{msg.time}</span>
                            <span>•</span>
                            <span
                              className={
                                msg.sender === "peer"
                                  ? "text-primary-container font-semibold"
                                  : ""
                              }
                            >
                              {msg.meta}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Embedded Reputation & Rating Card */}
                      <div className="border-[1.5px] border-on-surface bg-surface-container-lowest rounded-lg p-3.5 shadow-[2px_2px_0px_#1a1c1c] flex flex-col gap-2 mt-1">
                        <div className="flex items-center justify-between">
                          <span className="font-label-code-sm text-label-code-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                            SESSION REVIEW [ORDER-1042]
                          </span>
                          <span className="font-label-code-sm text-[10px] bg-surface-container-highest px-1.5 py-0.5 rounded font-bold text-on-surface">
                            ED25519 SIGNED
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex text-primary-container font-headline-sm text-headline-sm leading-none">
                            ★★★★★
                          </div>
                          <span className="font-label-code-md text-label-code-md font-bold text-on-surface">
                            5.0 Rating Verified On-Chain
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface italic bg-surface-container-low p-2 rounded border-[1.5px] border-on-surface/10">
                          “Fast turnaround and seamless cryptographic sign-off.”
                        </p>
                      </div>
                    </div>

                    {/* Terminal Mockup Chat Input Field */}
                    <form
                      onSubmit={handleSendMessage}
                      className="pt-2 border-t-[1.5px] border-on-surface/10 flex items-center gap-2"
                    >
                      <div className="relative flex-1">
                        <input
                          className="w-full bg-surface-container-lowest border-[1.5px] border-on-surface rounded-lg py-2 pl-3 pr-8 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/70 shadow-[2px_2px_0px_#1a1c1c] focus:outline-none focus:ring-1 focus:ring-primary-container"
                          type="text"
                          placeholder="Type encrypted message..."
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                        />
                        <Icon
                          name="lock"
                          size={16}
                          className="text-on-surface-variant absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        />
                      </div>
                      <button
                        aria-label="Send Message Simulation"
                        className="w-10 h-10 bg-primary-container text-on-primary-container border-[1.5px] border-on-surface rounded-lg shadow-[2px_2px_0px_#1a1c1c] flex items-center justify-center hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer active:shadow-none"
                        type="submit"
                      >
                        <Icon name="send" size={18} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Architecture Section (Medium Blue Solid Neo-Brutalist Block) */}
          <section
            className="relative w-full bg-primary-container text-on-primary-container border-y-[1.5px] border-on-surface py-20 overflow-hidden"
            id="how-it-works"
          >
            {/* Graph Background Grid Layer (Inverted for Blue background) */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:40px_40px]" />

            <div className="relative max-w-[1200px] mx-auto px-gutter flex flex-col gap-space-xl">
              {/* Section Header */}
              <div className="flex flex-col items-start gap-space-xs max-w-[700px]">
                <div className="inline-flex items-center px-3 py-1 bg-surface-container-lowest text-on-surface font-label-code-md text-label-code-md font-bold uppercase tracking-wider rounded-lg border-[1.5px] border-on-surface shadow-[2px_2px_0px_#1a1c1c]">
                  PROTOCOL ARCHITECTURE
                </div>
                <h2 className="font-headline-xl text-headline-xl text-on-primary-container tracking-tight">
                  How it works
                </h2>
                <p className="font-body-lg text-body-lg text-on-primary-container/85">
                  Four simple steps to sovereign, gasless wallet communications.
                </p>
              </div>

              {/* 4-Step Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg">
                {/* Step 1 */}
                <div className="bg-surface-container-lowest text-on-surface border-[1.5px] border-on-surface rounded-lg p-6 shadow-[4px_4px_0px_#1a1c1c] flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
                  <div>
                    <div className="text-primary-container font-headline-xl text-headline-xl font-label-code-lg mb-4">
                      01
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">
                      Connect your wallet
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      MetaMask, Coinbase Wallet, or WalletConnect. Sign a
                      cryptographic keypair once. No gas, no transaction fees.
                    </p>
                  </div>
                  <div className="pt-6 mt-6 border-t-[1.5px] border-on-surface/10 flex items-center justify-between font-label-code-sm text-label-code-sm text-on-surface-variant font-mono">
                    <span>EIP-712</span>
                    <span>ZERO GAS</span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-surface-container-lowest text-on-surface border-[1.5px] border-on-surface rounded-lg p-6 shadow-[4px_4px_0px_#1a1c1c] flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
                  <div>
                    <div className="text-primary-container font-headline-xl text-headline-xl font-label-code-lg mb-4">
                      02
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">
                      Add a contact
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      Paste any EVM wallet address or ENS name (.eth) and assign
                      private local nicknames that only your device sees.
                    </p>
                  </div>
                  <div className="pt-6 mt-6 border-t-[1.5px] border-on-surface/10 flex items-center justify-between font-label-code-sm text-label-code-sm text-on-surface-variant font-mono">
                    <span>RESOLVER</span>
                    <span>LOCAL ONLY</span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-surface-container-lowest text-on-surface border-[1.5px] border-on-surface rounded-lg p-6 shadow-[4px_4px_0px_#1a1c1c] flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
                  <div>
                    <div className="text-primary-container font-headline-xl text-headline-xl font-label-code-lg mb-4">
                      03
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">
                      Share a chat code
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      Tag conversations with structured codes like ORDER-1042 or
                      DEAL-88 to keep trades, freelance tasks, and deals segregated.
                    </p>
                  </div>
                  <div className="pt-6 mt-6 border-t-[1.5px] border-on-surface/10 flex items-center justify-between font-label-code-sm text-label-code-sm text-on-surface-variant font-mono">
                    <span>ISOLATION</span>
                    <span>TAG ROUTING</span>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="bg-surface-container-lowest text-on-surface border-[1.5px] border-on-surface rounded-lg p-6 shadow-[4px_4px_0px_#1a1c1c] flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
                  <div>
                    <div className="text-primary-container font-headline-xl text-headline-xl font-label-code-lg mb-4">
                      04
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">
                      Chat &amp; leave feedback
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      Exchange E2E encrypted messages and publish signed 1–5 star
                      ratings and reviews grouped directly by chat code.
                    </p>
                  </div>
                  <div className="pt-6 mt-6 border-t-[1.5px] border-on-surface/10 flex items-center justify-between font-label-code-sm text-label-code-sm text-on-surface-variant font-mono">
                    <span>REPUTATION</span>
                    <span>E2E XMTP</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Core Features / Pillars Section */}
          <section
            className="relative w-full bg-surface-container-lowest py-20 overflow-hidden"
            id="features"
          >
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(10,10,10,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(10,10,10,0.07)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_95%)]" />

            <div className="relative max-w-[1200px] mx-auto px-gutter flex flex-col gap-space-xl">
              {/* Section Title Unit */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md border-b-[1.5px] border-on-surface pb-6">
                <div>
                  <span className="font-label-code-md text-label-code-md text-primary-container font-bold uppercase tracking-wider">
                    SOVEREIGN DESIGN
                  </span>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-1">
                    Engineered for uncompromised trust
                  </h2>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-[420px]">
                  No centralized infrastructure. Built with cryptographic standards
                  that operate independent of platform survivability.
                </p>
              </div>

              {/* Feature Highlight Tri-Panel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
                {/* Feature Card A */}
                <div className="bg-surface-container-lowest border-[1.5px] border-on-surface rounded-lg p-6 shadow-[4px_4px_0px_#1a1c1c] flex flex-col justify-between group hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1a1c1c] transition-all">
                  <div className="flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-lg bg-surface-container-lowest border-[1.5px] border-on-surface flex items-center justify-center shadow-[2px_2px_0px_#1a1c1c]">
                      <Icon name="bolt" size={24} className="text-primary-container" />
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface">
                      Zero Gas &amp; Off-Chain Relay Network
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      Decentralized relays carry encrypted payloads with zero gas
                      cost. Instant millisecond synchronization without paying
                      Ethereum or L2 base fees.
                    </p>
                  </div>
                  <div className="pt-6 mt-6 border-t-[1.5px] border-on-surface/10 flex items-center justify-between">
                    <span className="font-label-code-sm text-label-code-sm font-semibold text-primary-container">
                      GASLESS SPEC v2.4
                    </span>
                    <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">
                      0.00 GWEI
                    </span>
                  </div>
                </div>

                {/* Feature Card B */}
                <div className="bg-surface-container-lowest border-[1.5px] border-on-surface rounded-lg p-6 shadow-[4px_4px_0px_#1a1c1c] flex flex-col justify-between group hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1a1c1c] transition-all">
                  <div className="flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-lg bg-surface-container-lowest border-[1.5px] border-on-surface flex items-center justify-center shadow-[2px_2px_0px_#1a1c1c]">
                      <Icon name="shield" size={24} className="text-primary-container" />
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface">
                      Cryptographic Reputation by Chat Code
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      Portable peer reviews tied directly to transaction codes, not
                      centralized server profiles. Sign cryptographic verifications
                      after completing trades.
                    </p>
                  </div>
                  <div className="pt-6 mt-6 border-t-[1.5px] border-on-surface/10 flex items-center justify-between">
                    <span className="font-label-code-sm text-label-code-sm font-semibold text-primary-container">
                      SIGNATURE AUDITED
                    </span>
                    <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">
                      IMMUTABLE
                    </span>
                  </div>
                </div>

                {/* Feature Card C */}
                <div className="bg-surface-container-lowest border-[1.5px] border-on-surface rounded-lg p-6 shadow-[4px_4px_0px_#1a1c1c] flex flex-col justify-between group hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1a1c1c] transition-all">
                  <div className="flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-lg bg-surface-container-lowest border-[1.5px] border-on-surface flex items-center justify-center shadow-[2px_2px_0px_#1a1c1c]">
                      <Icon name="key" size={24} className="text-primary-container" />
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface">
                      Sovereign &amp; Ephemeral Key Management
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      Export your keys anytime, run your own self-hosted relay node,
                      or purge local device caches with a single terminal click. You
                      hold the encryption keys.
                    </p>
                  </div>
                  <div className="pt-6 mt-6 border-t-[1.5px] border-on-surface/10 flex items-center justify-between">
                    <span className="font-label-code-sm text-label-code-sm font-semibold text-primary-container">
                      CLIENT-SIDE PRIVACY
                    </span>
                    <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">
                      SELF-SOVEREIGN
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Code Inspection Sandbox Banner */}
              {/* Shareable Deep-Link Utility Banner */}
              <div
                className="bg-surface-container-lowest border-[1.5px] border-on-surface rounded-lg p-6 shadow-[6px_6px_0px_#1a1c1c] flex flex-col md:flex-row items-center justify-between gap-space-lg"
                id="docs"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="font-label-code-sm text-label-code-sm font-bold text-primary-container uppercase">
                    SHAREABLE CHAT LINKS
                  </span>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface">
                    Share an encrypted chat link for any transaction
                  </h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Send a direct link with your reference code. Your counterparty connects their wallet and chats with zero gas.
                  </p>
                </div>
                <div className="flex items-center gap-space-sm w-full md:w-auto">
                  <div className="px-4 py-2.5 bg-on-surface text-surface-container-lowest font-label-code-sm text-label-code-sm rounded-lg border-[1.5px] border-on-surface font-mono overflow-x-auto select-all">
                    chatcode-app.vercel.app/app?code=ORDER-1042
                  </div>
                  <button
                    className="px-4 py-2.5 bg-primary-container text-on-primary-container font-label-code-sm text-label-code-sm font-bold rounded-lg border-[1.5px] border-on-surface shadow-[2px_2px_0px_#1a1c1c] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none transition-all cursor-pointer min-w-[90px]"
                    id="copy-btn"
                    onClick={handleCopy}
                    type="button"
                  >
                    {copied ? "COPIED!" : "COPY LINK"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Terminal Callout Banner (Neo-Brutalist Launch Prompt) */}
          <section className="w-full bg-surface-container-lowest border-t-[1.5px] border-on-surface py-16" id="app">
            <div className="max-w-[1200px] mx-auto px-gutter">
              <div className="bg-on-surface text-surface-container-lowest rounded-lg border-[1.5px] border-on-surface p-8 md:p-12 shadow-[8px_8px_0px_#2f6fed] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-space-lg">
                <div className="relative z-10 flex flex-col gap-2 max-w-[650px]">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-primary-container text-on-primary-container text-xs font-label-code-md font-bold rounded w-fit uppercase">
                    NO DEPOSIT • NO GAS • INSTANT
                  </div>
                  <h3 className="font-headline-lg text-headline-lg text-surface-container-lowest tracking-tight">
                    Ready to communicate without central intermediaries?
                  </h3>
                  <p className="font-body-md text-body-md text-surface-variant">
                    Connect your wallet to establish your sovereign communications
                    layer immediately.
                  </p>
                </div>
                <div className="relative z-10 flex flex-col sm:flex-row items-center gap-space-md w-full md:w-auto">
                  <Link
                    className="w-full sm:w-auto text-center px-8 py-4 bg-primary-container text-on-primary-container font-headline-sm text-headline-sm rounded-lg border-[1.5px] border-surface-container-lowest shadow-[4px_4px_0px_#ffffff] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#ffffff] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer"
                    href="/app"
                  >
                    Launch App
                  </Link>
                  <a
                    className="w-full sm:w-auto text-center px-8 py-4 bg-surface-container-lowest text-on-surface font-headline-sm text-headline-sm rounded-lg border-[1.5px] border-surface-container-lowest shadow-[4px_4px_0px_#ffffff] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#ffffff] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer"
                    href="#docs"
                  >
                    View Docs
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-on-surface text-surface-container-lowest border-t-[1.5px] border-on-surface relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative max-w-[1200px] mx-auto px-gutter pt-space-xl pb-space-lg">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-space-xl pb-space-xl border-b border-surface-variant/20">
            <div className="md:col-span-5 flex flex-col items-start gap-space-md">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded bg-primary-container border-[1.5px] border-surface-container-lowest flex items-center justify-center shadow-[2px_2px_0px_#ffffff]">
                  <Icon name="chat_bubble" size={18} className="text-on-primary-container" />
                </div>
                <span className="font-headline-md text-headline-md text-surface-container-lowest tracking-tight">
                  ChatCode
                </span>
              </div>
              <p className="font-label-code-md text-label-code-md text-surface-variant uppercase tracking-wider">
                Gasless. Private. Serverless.
              </p>
            </div>
            <div className="md:col-span-2 flex flex-col gap-space-sm">
              <span className="font-headline-sm text-headline-sm text-surface-container-lowest">
                Product
              </span>
              <a
                className="font-body-sm text-body-sm text-surface-variant hover:text-surface-container-lowest transition-colors"
                href="#how-it-works"
              >
                How it works
              </a>
              <Link
                className="font-body-sm text-body-sm text-surface-variant hover:text-surface-container-lowest transition-colors"
                href="/app"
              >
                Launch App
              </Link>
            </div>
            <div className="md:col-span-2 flex flex-col gap-space-sm">
              <span className="font-headline-sm text-headline-sm text-surface-container-lowest">
                Resources
              </span>
              <a
                className="font-body-sm text-body-sm text-surface-variant hover:text-surface-container-lowest transition-colors"
                href="#docs"
              >
                Docs
              </a>
              <a
                className="font-body-sm text-body-sm text-surface-variant hover:text-surface-container-lowest transition-colors"
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <a
                className="font-body-sm text-body-sm text-surface-variant hover:text-surface-container-lowest transition-colors"
                href="https://xmtp.org"
                target="_blank"
                rel="noreferrer"
              >
                XMTP
              </a>
            </div>
            <div className="md:col-span-3 flex flex-col gap-space-sm">
              <span className="font-headline-sm text-headline-sm text-surface-container-lowest">
                Legal
              </span>
              <a
                className="font-body-sm text-body-sm text-surface-variant hover:text-surface-container-lowest transition-colors"
                href="#privacy"
              >
                Privacy
              </a>
              <a
                className="font-body-sm text-body-sm text-surface-variant hover:text-surface-container-lowest transition-colors"
                href="#terms"
              >
                Terms
              </a>
            </div>
          </div>
          <div className="pt-space-lg flex flex-col sm:flex-row items-center justify-between gap-space-md">
            <p className="font-label-code-sm text-label-code-sm text-surface-variant">
              © 2026 ChatCode. All rights reserved.
            </p>
            <div className="inline-flex items-center gap-space-xs px-space-sm py-1 bg-primary-container text-on-primary-container border border-surface-container-lowest rounded shadow-[2px_2px_0px_#ffffff]">
              <span className="font-label-code-sm text-label-code-sm font-semibold tracking-wide uppercase">
                Built on XMTP
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
