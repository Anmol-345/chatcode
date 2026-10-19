"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { toBytes } from "viem";
import { Client, IdentifierKind, type Signer, type XmtpEnv } from "@xmtp/browser-sdk";
import { ChatCodeCodec } from "@/lib/codec";

type Status = "idle" | "initializing" | "ready" | "error";
interface Ctx {
  client: Client | null;
  status: Status;
  error: string | null;
  init: () => Promise<void>;
}
const XmtpCtx = createContext<Ctx>({} as Ctx);
export const useXmtp = () => useContext(XmtpCtx);

export function XmtpProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const clientRef = useRef<Client | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Wallet changed or disconnected → tear everything down (FR-4).
  // Intentionally resets React state here so the UI reflects the teardown.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional full reset on wallet change (FR-4) */
    clientRef.current?.close();
    clientRef.current = null;
    setClient(null);
    setStatus("idle");
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [address]);

  const init = useCallback(async () => {
    if (!address || !walletClient) return;
    setStatus("initializing");
    setError(null);
    try {
      const identifier = {
        identifier: address.toLowerCase(),
        identifierKind: IdentifierKind.Ethereum,
      };
      const signer: Signer = {
        type: "EOA",
        getIdentifier: () => identifier,
        signMessage: async (message: string) =>
          toBytes(await walletClient.signMessage({ account: address, message })),
      };
      const c = await Client.create(signer, {
        env: "production" as XmtpEnv,
        codecs: [new ChatCodeCodec()],
        appVersion: "chatcode/0.1.0",
      } as Parameters<typeof Client.create>[1]);
      clientRef.current = c as unknown as Client;
      setClient(c as unknown as Client);
      setStatus("ready");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(/reject|denied/i.test(message) ? "Signature rejected" : message);
      setStatus("error");
    }
  }, [address, walletClient]);

  return (
    <XmtpCtx.Provider value={{ client, status, error, init }}>
      {children}
    </XmtpCtx.Provider>
  );
}
