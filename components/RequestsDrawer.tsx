"use client";
import { useState } from "react";
import type { ChatRequest } from "@/lib/types";

export interface RequestsDrawerProps {
  requests: ChatRequest[];
  onAccept: (request: ChatRequest) => void;
  onAcceptAndAdd: (request: ChatRequest) => void;
  onBlock: (request: ChatRequest) => void;
  disabled?: boolean;
}

export function RequestsDrawer({
  requests,
  onAccept,
  onAcceptAndAdd,
  onBlock,
  disabled,
}: RequestsDrawerProps) {
  const [open, setOpen] = useState(false);

  if (requests.length === 0) return null;

  return (
    <aside className="w-72 border-l border-gray-200 bg-white flex-shrink-0 flex flex-col">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-3 py-2 border-b border-gray-200 text-left hover:bg-gray-50"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-gray-900">
          Requests ({requests.length})
        </span>
        <span className="text-xs text-gray-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {requests.map((r) => (
            <li key={r.peerInboxId} className="p-3">
              <p className="text-xs font-mono text-gray-500 break-all">{r.peerInboxId}</p>
              <p className="text-sm text-gray-900 mt-1 line-clamp-3">{r.preview}</p>
              <p className="text-xs text-gray-400 mt-1">
                {r.count} message{r.count === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button
                  onClick={() => onAccept(r)}
                  disabled={disabled}
                  className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Accept
                </button>
                <button
                  onClick={() => onAcceptAndAdd(r)}
                  disabled={disabled}
                  className="rounded border border-green-600 px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Accept &amp; add
                </button>
                <button
                  onClick={() => onBlock(r)}
                  disabled={disabled}
                  className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Block
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
