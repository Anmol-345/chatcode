"use client";
import { useState } from "react";
import { isValidCode, normalizeCode } from "@/lib/codec";

export interface CodeStat {
  count: number;
  ratings: number[];
  last: number;
}

export interface CodeTab {
  code: string;
  stat: CodeStat;
}

export function ChatCodeSwitcher({ codes, active, onChange }: {
  codes: CodeTab[];
  active: string;
  onChange: (code: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const avg = (r: number[]) => (r.length ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1) : null);
  // Always surface a GENERAL default tab.
  const hasGeneral = codes.some((t) => t.code === "GENERAL");
  const list: CodeTab[] = hasGeneral
    ? codes
    : [{ code: "GENERAL", stat: { count: 0, ratings: [], last: 0 } }, ...codes];
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 px-3 py-2 bg-white">
      {list.map(({ code, stat }) => (
        <button
          key={code}
          onClick={() => onChange(code)}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${active === code ? "bg-black text-white border-black" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
        >
          {code} · {stat.count}{avg(stat.ratings) && ` · ★${avg(stat.ratings)}`}
        </button>
      ))}
      <input
        aria-label="New chat code"
        className="w-32 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="New code…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          const c = normalizeCode(draft);
          if (e.key === "Enter" && isValidCode(c)) {
            onChange(c);
            setDraft("");
          }
        }}
      />
    </div>
  );
}
