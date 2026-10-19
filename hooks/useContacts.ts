"use client";
import { useCallback, useEffect, useState } from "react";
import type { Address, Contact, ContactBook } from "@/lib/types";
import { readJSON, writeJSON } from "@/lib/storage";

const KEY = "chatcode:contacts:v1";
const empty: ContactBook = { version: 1, contacts: {} };

function load(): ContactBook {
  return readJSON(KEY, empty);
}

export function useContacts(owner?: string | null) {
  const [book, setBook] = useState<ContactBook>(empty);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(false);

  // Sync to permanent backend server API in background
  const syncContactToServer = useCallback((contact: Contact) => {
    fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: owner || "global",
        contact,
      }),
    }).catch((err) => console.warn("Failed to persist contact to server:", err));
  }, [owner]);

  const deleteContactFromServer = useCallback((address: Address) => {
    fetch(`/api/contacts?owner=${owner || "global"}&address=${address}`, {
      method: "DELETE",
    }).catch((err) => console.warn("Failed to delete contact from server:", err));
  }, [owner]);

  // Hydrate after mount to avoid SSR mismatch, then sync across tabs and permanent server.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage after mount */
    const local = load();
    setBook(local);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setBook(load());
    };
    window.addEventListener("storage", onStorage);

    // Fetch permanent contacts from server backend
    let cancelled = false;
    async function fetchServer() {
      try {
        const res = await fetch(`/api/contacts?owner=${owner || "global"}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.contacts) return;

        const serverContacts = data.contacts as Record<string, Contact>;
        const currentLocal = load();
        let changed = false;
        const mergedContacts = { ...currentLocal.contacts };

        const isAddressFallback = (s?: string, k?: string) => {
          if (!s) return true;
          const lower = s.trim().toLowerCase();
          if (k && lower === k.toLowerCase()) return true;
          if (/^0x[a-f0-9]{3,8}[.…]+[a-f0-9]{3,8}$/i.test(s.trim())) return true;
          if (/^0x[a-f0-9]{40}$/i.test(s.trim())) return true;
          return false;
        };

        // 1. Merge server contacts into local contacts
        for (const [key, serverC] of Object.entries(serverContacts)) {
          const localC = mergedContacts[key];
          if (!localC) {
            mergedContacts[key] = serverC;
            changed = true;
          } else {
            // If server has custom alias and local only has fallback, restore server alias
            if (isAddressFallback(localC.alias, key) && !isAddressFallback(serverC.alias, key)) {
              mergedContacts[key] = {
                ...localC,
                alias: serverC.alias,
                updatedAt: Math.max(localC.updatedAt, serverC.updatedAt),
              };
              changed = true;
            }
          }
        }

        // 2. Also ensure local contacts with custom names are backed up to server
        for (const [key, localC] of Object.entries(currentLocal.contacts)) {
          if (!serverContacts[key]) {
            syncContactToServer(localC);
          }
        }

        if (changed) {
          const nextBook: ContactBook = { version: 1, contacts: mergedContacts };
          setBook(nextBook);
          writeJSON(KEY, nextBook);
        }
      } catch (e) {
        console.warn("Could not sync contacts from server:", e);
      }
    }

    fetchServer();

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [owner, syncContactToServer]);

  const persist = useCallback((next: ContactBook) => {
    setBook(next);
    setStorageError(!writeJSON(KEY, next));
  }, []);

  const upsert = useCallback(
    (c: { address: Address; alias?: string } & Partial<Contact>) => {
      const key = c.address.toLowerCase() as Address;
      const cur = load();
      const existing = cur.contacts[key];
      const now = Date.now();

      const isAddressFallback = (s?: string) => {
        if (!s) return true;
        const lower = s.trim().toLowerCase();
        if (lower === key) return true;
        if (/^0x[a-f0-9]{3,8}[.…]+[a-f0-9]{3,8}$/i.test(s.trim())) return true;
        if (/^0x[a-f0-9]{40}$/i.test(s.trim())) return true;
        return false;
      };

      let chosenAlias: string;
      const inputAlias = c.alias?.trim();

      if (inputAlias && !isAddressFallback(inputAlias)) {
        // User explicitly specified a real custom alias/nickname
        chosenAlias = inputAlias;
      } else if (existing?.alias && !isAddressFallback(existing.alias)) {
        // Preserve existing user-defined alias/nickname
        chosenAlias = existing.alias;
      } else if (inputAlias) {
        chosenAlias = inputAlias;
      } else if (c.ensName) {
        chosenAlias = c.ensName;
      } else if (existing?.alias) {
        chosenAlias = existing.alias;
      } else {
        chosenAlias = `${key.slice(0, 6)}…${key.slice(-4)}`;
      }

      const updatedContact: Contact = {
        ...existing,
        ...c,
        address: key,
        alias: chosenAlias,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      persist({
        version: 1,
        contacts: {
          ...cur.contacts,
          [key]: updatedContact,
        },
      });

      // Permanently save to server
      syncContactToServer(updatedContact);
    },
    [persist, syncContactToServer],
  );

  const updateAlias = useCallback(
    (address: Address, newAlias: string) => {
      const key = address.toLowerCase() as Address;
      const cur = load();
      const existing = cur.contacts[key];
      const now = Date.now();
      const trimmed = newAlias.trim() || `${key.slice(0, 6)}…${key.slice(-4)}`;

      const updatedContact: Contact = {
        ...existing,
        address: key,
        alias: trimmed,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      persist({
        version: 1,
        contacts: {
          ...cur.contacts,
          [key]: updatedContact,
        },
      });

      // Permanently save to server
      syncContactToServer(updatedContact);
    },
    [persist, syncContactToServer],
  );

  const remove = useCallback(
    (address: Address) => {
      const key = address.toLowerCase() as Address;
      const cur = load().contacts;
      const rest = Object.fromEntries(
        Object.entries(cur).filter(([k]) => k !== key),
      ) as Record<string, Contact>;
      persist({ version: 1, contacts: rest });

      // Permanently remove from server
      deleteContactFromServer(key);
    },
    [persist, deleteContactFromServer],
  );

  const label = useCallback(
    (addr?: string) => {
      if (!addr) return "Unknown";
      const c = book.contacts[addr.toLowerCase() as Address];
      return c?.alias || c?.ensName || `${addr.slice(0, 6)}…${addr.slice(-4)}`;
    },
    [book],
  );

  const exportJSON = useCallback(() => JSON.stringify(book), [book]);

  const importJSON = useCallback(
    (text: string): boolean => {
      try {
        const parsed = JSON.parse(text);
        if (
          parsed?.version === 1 &&
          parsed.contacts &&
          typeof parsed.contacts === "object" &&
          !Array.isArray(parsed.contacts)
        ) {
          const clean: Record<string, Contact> = {};
          for (const [addr, value] of Object.entries(parsed.contacts as Record<string, unknown>)) {
            const c = value as Partial<Contact> & Record<string, unknown>;
            if (typeof c.alias === "string") {
              clean[addr.toLowerCase() as Address] = {
                address: addr.toLowerCase() as Address,
                alias: c.alias,
                ensName: typeof c.ensName === "string" ? c.ensName : undefined,
                inboxId: typeof c.inboxId === "string" ? c.inboxId : undefined,
                reachable: typeof c.reachable === "boolean" ? c.reachable : undefined,
                createdAt: typeof c.createdAt === "number" ? c.createdAt : nowOrDefault(),
                updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : nowOrDefault(),
              };
            }
          }
          persist({ version: 1, contacts: { ...book.contacts, ...clean } });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [book, persist],
  );

  return {
    contacts: Object.values(book.contacts),
    hydrated,
    storageError,
    upsert,
    updateAlias,
    remove,
    label,
    exportJSON,
    importJSON,
  };
}

function nowOrDefault(): number {
  return Date.now();
}
