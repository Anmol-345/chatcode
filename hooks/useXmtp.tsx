"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { toBytes, createWalletClient, custom } from "viem";
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
  const { address, connector } = useAccount();
  const { data: walletClient } = useWalletClient();
  const clientRef = useRef<Client | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Wallet changed or disconnected → tear everything down (FR-4).
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
    if (!address) {
      alert("Please connect your wallet first.");
      return;
    }
    setStatus("initializing");
    setError(null);

    try {
      // 1. Resolve a working wallet client (via Wagmi hook, connector provider, or window.ethereum)
      let wc = walletClient;

      if (!wc && connector) {
        try {
          const provider = await connector.getProvider();
          if (provider) {
            wc = createWalletClient({
              account: address,
              transport: custom(provider as any),
            });
          }
        } catch (err) {
          console.warn("Could not get provider from connector:", err);
        }
      }

      if (!wc && typeof window !== "undefined" && (window as any).ethereum) {
        try {
          wc = createWalletClient({
            account: address,
            transport: custom((window as any).ethereum),
          });
        } catch (err) {
          console.warn("Could not get provider from window.ethereum:", err);
        }
      }

      if (!wc) {
        throw new Error(
          "Wallet signer not detected. Please unlock your wallet extension (e.g. MetaMask) or refresh the page."
        );
      }

      const identifier = {
        identifier: address.toLowerCase(),
        identifierKind: IdentifierKind.Ethereum,
      };

      const signer: Signer = {
        type: "EOA",
        getIdentifier: () => identifier,
        signMessage: async (message: string) => {
          const signature = await wc.signMessage({ account: address, message });
          return toBytes(signature);
        },
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
      const isRejected = /reject|denied|user rejected/i.test(message);
      const errText = isRejected ? "Signature request rejected by wallet" : message;
      console.error("XMTP initialization failed:", e);
      setError(errText);
      setStatus("error");
      alert(`Could not enable messaging: ${errText}`);
    }
  }, [address, walletClient, connector]);

  return (
    <XmtpCtx.Provider value={{ client, status, error, init }}>
      {children}
    </XmtpCtx.Provider>
  );
}
