"use client";
import { useCallback, useState } from "react";
import type { ChatItem } from "@/lib/types";
import type { FeedbackCategory } from "@/lib/types";
import { isValidCode, MAX_COMMENT_LENGTH, MAX_TEXT_LENGTH } from "@/lib/codec";
import { FeedbackForm } from "@/components/FeedbackForm";

export interface MessagePanelProps {
  items: ChatItem[];
  activeCode: string;
  onSendText: (text: string) => void;
  onSendFeedback: (score: number, category: FeedbackCategory, text: string) => void;
  onRetry: (item: ChatItem) => void;
  error?: string | null;
}

export function MessagePanel({
  items,
  activeCode,
  onSendText,
  onSendFeedback,
  onRetry,
  error,
}: MessagePanelProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [draft, setDraft] = useState("");

  const filtered = items.filter((i) => i.payload.chatCode === activeCode);
  const codeValid = isValidCode(activeCode);
  const tooLong = draft.length > MAX_TEXT_LENGTH;

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!draft.trim() || tooLong || !codeValid) return;
      onSendText(draft.trim());
      setDraft("");
    },
    [draft, onSendText, tooLong, codeValid],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {error && (
        <div
          role="alert"
          className="rounded-none border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {!codeValid && (
        <div
          role="alert"
          className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
        >
          Chat code &quot;{activeCode}&quot; is invalid — sending is disabled.
        </div>
      )}

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
                    <span className="text-gray-300 text-xs uppercase tracking-wider">
                      {item.payload.category}
                    </span>
                    <span className="ml-1">{item.payload.text}</span>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words">{item.payload.text}</p>
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
            disabled={!codeValid}
          />
        </div>
      ) : null}

      <form onSubmit={handleSend} className="border-t border-gray-200 bg-white p-3 flex gap-2 items-center">
        <input
          aria-label="Message text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={codeValid ? "Message…" : "Invalid chat code"}
          disabled={!codeValid}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={!draft.trim() || tooLong || !codeValid}
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
        {draft.length > MAX_TEXT_LENGTH - 200 && (
          <span
            className={`text-xs ${tooLong ? "text-red-600" : "text-gray-400"}`}
            aria-live="polite"
          >
            {draft.length}/{MAX_TEXT_LENGTH}
          </span>
        )}
      </form>
      {showFeedback && (
        <p className="px-3 pb-2 text-xs text-gray-400">
          Comment max {MAX_COMMENT_LENGTH} characters.
        </p>
      )}
    </div>
  );
}
