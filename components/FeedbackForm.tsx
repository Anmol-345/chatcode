"use client";
import { useState } from "react";
import type { FeedbackCategory } from "@/lib/types";

export interface FeedbackFormProps {
  onSubmit: (score: 1 | 2 | 3 | 4 | 5, category: FeedbackCategory, text: string) => void;
  disabled?: boolean;
}

const CATEGORIES: FeedbackCategory[] = ["service", "communication", "delivery", "quality", "other"];

export function FeedbackForm({ onSubmit, disabled }: FeedbackFormProps) {
  const [score, setScore] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [category, setCategory] = useState<FeedbackCategory>("delivery");
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(score, category, text);
    setText("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
      <div className="flex items-center gap-2">
        <label htmlFor="feedback-score" className="text-sm font-medium text-gray-900">Score</label>
        <select
          id="feedback-score"
          value={String(score)}
          onChange={(e) => setScore(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
          disabled={disabled}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {[5, 4, 3, 2, 1].map((s) => (
            <option key={s} value={String(s)}>
              {s}★
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="feedback-category" className="text-sm font-medium text-gray-900">Category</label>
        <select
          id="feedback-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
          disabled={disabled}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <textarea
        id="feedback-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Comment (optional)"
        disabled={disabled}
        rows={2}
        className="rounded border border-gray-300 px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send Feedback
      </button>
    </form>
  );
}
