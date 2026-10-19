"use client";
import { useCallback, useState } from "react";
import { isAddress, getAddress } from "viem";
import { useXmtp } from "@/hooks/useXmtp";
import { useContacts } from "@/hooks/useContacts";
import { resolveAddress } from "@/lib/ens";
import { canReach, getInboxId } from "@/lib/xmtp";
import { buildInviteLink } from "@/lib/invite";
import type { Address, Contact } from "@/lib/types";

export interface ContactManagerProps {
  /** Called when a contact row is selected (not edit/delete). */
  onSelect?: (contact: Contact) => void;
}

export function ContactManager({ onSelect }: ContactManagerProps = {}) {
  const {
    contacts,
    hydrated,
    storageError,
    upsert,
    remove,
    label,
    exportJSON,
    importJSON,
  } = useContacts();
  const { client, status } = useXmtp();

  const [input, setInput] = useState("");
  const [alias, setAlias] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ address: Address; alias: string } | null>(null);
  const [inviteFor, setInviteFor] = useState<Address | null>(null);

  const handleAdd = useCallback(async () => {
    setError("");
    const raw = input.trim();
    if (!raw) return;

    let address: Address | null = null;
    if (isAddress(raw)) {
      address = getAddress(raw) as Address;
    } else if (raw.includes(".")) {
      const resolved = await resolveAddress(raw);
      if (!resolved) {
        setError("ENS name could not be resolved.");
        return;
      }
      address = resolved;
    } else {
      setError("Enter a 0x address or ENS name.");
      return;
    }

    const key = address.toLowerCase() as Address;
    const reachable = await canReach(address);

    let inboxId: string | undefined;
    if (client && status === "ready") {
      try {
        inboxId = await getInboxId(client, key);
      } catch {
        // inbox lookup is non-fatal
      }
    }

    upsert({
      address: key,
      alias: alias.trim() || raw,
      reachable,
      ...(inboxId ? { inboxId } : {}),
    });

    setInput("");
    setAlias("");
    setInviteFor(reachable ? null : key);
  }, [input, alias, client, status, upsert]);

  const handleSaveEdit = useCallback(
    (address: Address) => {
      if (!editing || editing.address !== address) return;
      upsert({ address, alias: editing.alias.trim() || address });
      setEditing(null);
    },
    [editing, upsert],
  );

  const handleDelete = useCallback((address: Address) => {
    remove(address);
    if (inviteFor === address) setInviteFor(null);
  }, [remove, inviteFor]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result ?? "";
        const ok = importJSON(typeof text === "string" ? text : String(text));
        if (!ok) setError("Invalid contacts file.");
        setError("");
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [importJSON],
  );

  const handleExport = useCallback(() => {
    const json = exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chatcode-contacts.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [exportJSON]);

  const isShort = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  if (!hydrated) {
    return <div className="p-4 text-center text-sm text-gray-500">Loading contacts…</div>;
  }

  return (
    <div className="space-y-4 p-4">
      {storageError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800 text-sm">
          localStorage write failed — contacts are held in memory only.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800 text-sm">{error}</div>
      )}

      {/* Add contact */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Add contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            id="contact-input"
            placeholder="0x address or name.eth"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            id="contact-alias"
            placeholder="Alias (optional)"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add
          </button>
        </div>
      </div>

      {/* Contact list */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Contacts ({contacts.length})
        </h3>
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-500">No contacts yet.</p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c) => {
              const reachable = c.reachable === true;
              const isEditing = editing?.address === c.address;
              return (
                <li
                  key={c.address}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded border border-gray-100 cursor-pointer hover:bg-gray-50"
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("button")) onSelect?.(c);
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{label(c.address)}</span>
                    <span className="text-xs text-gray-500 truncate max-w-xs">{isShort(c.address)}</span>
                    {c.ensName && (
                      <span className="text-xs italic text-gray-400">({c.ensName})</span>
                    )}
                  </div>
                  {!reachable && (
                    <span className="text-xs text-amber-600 bg-amber-50/50 rounded px-2 py-0.5">
                      Not on XMTP · {inviteFor === c.address ? <InviteLink contact={c} /> : <button onClick={() => setInviteFor(c.address)} className="underline">Invite</button>}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <input
                          value={editing.alias}
                          onChange={(e) => setEditing({ ...editing, alias: e.target.value })}
                          className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleSaveEdit(c.address)}
                          className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditing({ address: c.address, alias: c.alias })}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Edit alias
                        </button>
                        <button
                          onClick={() => handleDelete(c.address)}
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Invite hint (persistent when an unreachable contact is selected) */}
      {inviteFor && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-800">
            This address isn&rsquo;t on XMTP yet. Share the invite link so they can enable messaging:
          </p>
          <InviteLink contact={contacts.find((c) => c.address === inviteFor) as Contact} />
          <button
            onClick={() => setInviteFor(null)}
            className="mt-2 text-xs underline text-blue-600"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Export / Import */}
      <div className="flex items-center gap-3">
        <button onClick={handleExport} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
          Export contacts
        </button>
        <label className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
          Import
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
}

function InviteLink({ contact }: { contact: Contact }) {
  const link = buildInviteLink(contact.address);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 mt-1">
      <input
        readOnly
        value={link}
        className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-700"
      />
      <button
        onClick={() => {
          navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded bg-blue-600 px-2.5 py-1.5 text-xs text-white hover:bg-blue-700"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
