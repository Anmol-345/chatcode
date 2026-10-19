"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useXmtp } from "@/hooks/useXmtp";

export function ConnectBar() {
  const { address, isConnected, isReconnecting } = useAccount();
  const { connect, connectors, isPending: connectPending, error: connectError } = useConnect();
  const { disconnect, isPending: disconnectPending } = useDisconnect();
  const { status, error: xmtpError, init } = useXmtp();

  const isReady = status === "ready";
  const isInitializing = status === "initializing";

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-between w-full border-b border-surface-low p-3 bg-surface-container bg-on-surface">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-body-sm text-on-surface-variant">
            Not connected
          </span>
          <div className="flex flex-wrap gap-2">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => connect({ connector })}
                disabled={connectPending || isReconnecting}
                className="inline-flex items-center gap-2 rounded-md border border-surface-outline px-3 py-1.5 text-body-sm text-on-surface hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect {connector.name}
              </button>
            ))}
            {connectError && (
              <span className="rounded-md border border-error px-3 py-1.5 text-xs text-error">
                {connectError.message}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full border-b border-surface-low p-3 bg-surface-container bg-on-surface">
      <div className="flex items-center gap-3">
        <span className="text-body-sm text-on-surface-variant truncate max-w-xs">{address}</span>
        {!isReady && (
          <button
            onClick={init}
            disabled={isInitializing}
            className="inline-flex items-center gap-2 rounded-md border border-surface-outline px-3 py-1.5 text-body-sm text-on-surface hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isInitializing ? "Enabling messaging…" : "Enable messaging"}
          </button>
        )}
        {isReady && (
          <span className="inline-flex items-center gap-1 rounded-md bg-success-container px-2 py-1 text-xs text-success">
            Ready
          </span>
        )}
        {xmtpError && (
          <span className="rounded-md border border-error bg-error-container px-3 py-1.5 text-xs text-error">
            {xmtpError}
          </span>
        )}
      </div>
      <button
        onClick={() => disconnect()}
        disabled={disconnectPending}
        className="rounded-md border border-surface-outline px-3 py-1.5 text-body-sm text-on-surface hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Disconnect
      </button>
    </div>
  );
}
