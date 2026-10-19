"use client";
import { useCallback, useState } from "react";
import type { ChatItem } from "@/lib/types";
import type { FeedbackCategory } from "@/lib/types";
import { FeedbackForm } from "@/components/FeedbackForm";

export interface MessagePanelProps {
  items: ChatItem[];
  activeCode: string;
  onSendText: (text: string) => void;
  onSendFeedback: (score: number, category: FeedbackCategory, text: string) => void;
  onRetry: (item: ChatItem) => void;
}

export function MessagePanel({ items, activeCode, onSendText, onSendFeedback, onRetry }: MessagePanelProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [draft, setDraft] = useState("");

  const filtered = items.filter((i) => i.payload.chatCode === activeCode);

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!draft.trim()) return;
      onSendText(draft.trim());
      setDraft("");
    },
    [draft, onSendText],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-500">No messages yet. Start the conversation.</p>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className={`flex flex-col ${item.mine ? "items-end ml-auto" : "items-start"}`}>
              <div
                className={`max-w-[80%] p-3 rounded-lg shadow-sm ${item.mine ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-900"}`}
              >
                {item.payload.kind === "feedback" ? (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-bold">{"★".repeat(item.payload.score)}</span>
                    <span className="text-gray-300 text-xs uppercase tracking-wider">{item.payload.category}</span>
                    <span className="ml-1">{item.payload.text}</span>
                  </div>
                ) : (
                  <p className="text-sm">{item.payload.text}</p>
                )}
                {item.status === "failed" && (
                  <span className="text-xs text-red-600 mt-1">Send failed — retry below</span>
                )}
                {item.status === "pending" && <span className="text-xs text-gray-500 mt-1">Sending…</span>}
              </div>
              {item.status === "failed" && (
                <button
                  onClick={() => onRetry(item)}
                  className="mt-1 text-xs text-blue-600 underline hover:text-blue-800"
                >
                  Retry
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {showFeedback ? (
        <div className="border-t border-gray-200 bg-white p-3">
          <FeedbackForm
            onSubmit={(score, category, text) => onSendFeedback(score, category, text)}
            disabled={false}
          />
        </div>
      ) : null}

      <form onSubmit={handleSend} className="border-t border-gray-200 bg-white p-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => setShowFeedback(!showFeedback)}
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          {showFeedback ? "Cancel" : "★ Feedback"}
        </button>
      </form>
    </div>
  );
}
