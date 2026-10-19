"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parseInviteParams } from "@/lib/invite";
import type { Address } from "@/lib/types";

export interface DeepLinkPromptProps {
  onConfirm: (peer?: Address, code?: string) => void;
  onCancel: () => void;
}

/**
 * Renders the "Add contact?" confirmation for deep links (FR-15).
 * Never auto-adds a contact and never auto-sends anything.
 */
export function DeepLinkPrompt({ onConfirm, onCancel }: DeepLinkPromptProps) {
  const searchParams = useSearchParams();
  const [deepLink, setDeepLink] = useState<{ peer?: Address; code?: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const { peer, code } = parseInviteParams(searchParams.toString());
    if (peer || code) {
      /* eslint-disable react-hooks/set-state-in-effect -- surface the deep-link prompt after mount */
      setDeepLink({ peer, code });
      setOpen(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [searchParams]);

  if (!open || !deepLink) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Add contact?</h3>
        <p className="text-sm text-gray-600 mb-4">
          {deepLink.peer ? `Add contact ${deepLink.peer}` : "Add a contact"}
          {deepLink.code ? ` and set active code to "${deepLink.code}"` : ""}.
          Nothing is added or sent until you confirm.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setOpen(false);
              onCancel();
            }}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onConfirm(deepLink.peer, deepLink.code);
            }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
