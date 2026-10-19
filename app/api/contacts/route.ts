import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { Contact } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "contacts.json");

interface ContactStorage {
  [owner: string]: Record<string, Contact>;
}

async function ensureDataFile(): Promise<ContactStorage> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(FILE_PATH, "utf-8");
    return JSON.parse(content) as ContactStorage;
  } catch (err: any) {
    if (err?.code === "ENOENT" || err instanceof SyntaxError) {
      const initial: ContactStorage = {};
      try {
        await fs.writeFile(FILE_PATH, JSON.stringify(initial, null, 2), "utf-8");
      } catch {}
      return initial;
    }
    return {};
  }
}

async function saveDataFile(data: ContactStorage): Promise<boolean> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempPath = `${FILE_PATH}.tmp.${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tempPath, FILE_PATH);
    return true;
  } catch (err) {
    console.error("Failed to persist contacts file:", err);
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = (searchParams.get("owner") || "global").toLowerCase();

  const store = await ensureDataFile();
  const ownerContacts = store[owner] || {};
  const globalContacts = store["global"] || {};

  // Merge global and owner contacts, with owner-specific taking precedence
  const merged: Record<string, Contact> = { ...globalContacts, ...ownerContacts };

  return NextResponse.json({
    owner,
    contacts: merged,
    count: Object.keys(merged).length,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const owner = (body.owner ? String(body.owner).toLowerCase() : "global");
    const contact = body.contact as Contact;

    if (!contact || !contact.address) {
      return NextResponse.json({ error: "Invalid contact data" }, { status: 400 });
    }

    const key = contact.address.toLowerCase();
    const store = await ensureDataFile();

    if (!store[owner]) {
      store[owner] = {};
    }

    const existing = store[owner][key] || store["global"]?.[key];
    const now = Date.now();

    const savedContact: Contact = {
      ...existing,
      ...contact,
      address: key as `0x${string}`,
      alias: contact.alias || existing?.alias || `${key.slice(0, 6)}…${key.slice(-4)}`,
      createdAt: existing?.createdAt || contact.createdAt || now,
      updatedAt: now,
    };

    store[owner][key] = savedContact;

    // Always mirror to global bucket so contacts persist across wallet disconnects
    if (owner !== "global") {
      if (!store["global"]) store["global"] = {};
      store["global"][key] = savedContact;
    }

    await saveDataFile(store);

    return NextResponse.json({
      success: true,
      owner,
      contact: savedContact,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save contact" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = (searchParams.get("owner") || "global").toLowerCase();
    const address = searchParams.get("address")?.toLowerCase();

    if (!address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    const store = await ensureDataFile();

    if (store[owner] && store[owner][address]) {
      delete store[owner][address];
    }
    if (store["global"] && store["global"][address]) {
      delete store["global"][address];
    }

    await saveDataFile(store);

    return NextResponse.json({ success: true, removed: address });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to remove contact" },
      { status: 500 }
    );
  }
}
