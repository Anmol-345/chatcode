"use client";
import { useCallback, useEffect, useState } from "react";
import type { Address, Contact, ContactBook } from "@/lib/types";
import { readJSON, writeJSON } from "@/lib/storage";

const KEY = "chatcode:contacts:v1";
const empty: ContactBook = { version: 1, contacts: {} };

function load(): ContactBook {
  return readJSON(KEY, empty);
}

export function useContacts() {
  const [book, setBook] = useState<ContactBook>(empty);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(false);

  // Hydrate after mount to avoid SSR mismatch, then sync across tabs.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBook(load());
    setHydrated(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setBook(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: ContactBook) => {
    setBook(next);
    setStorageError(!writeJSON(KEY, next));
  }, []);

  const upsert = useCallback(
    (c: Pick<Contact, "address" | "alias"> & Partial<Contact>) => {
      const key = c.address.toLowerCase() as Address;
      const cur = load();
      const existing = cur.contacts[key];
      const now = Date.now();
      persist({
        version: 1,
        contacts: {
          ...cur.contacts,
          [key]: {
            ...existing,
            ...c,
            address: key,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          },
        },
      });
    },
    [persist],
  );

  const remove = useCallback((address: Address) => {
    const key = address.toLowerCase() as Address;
    const cur = load().contacts;
    const rest = Object.fromEntries(
      Object.entries(cur).filter(([k]) => k !== key),
    ) as Record<string, Contact>;
    persist({ version: 1, contacts: rest });
  }, [persist]);

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
    remove,
    label,
    exportJSON,
    importJSON,
  };
}

function nowOrDefault(): number {
  return Date.now();
}
