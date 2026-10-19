"use client";

/**
 * In-memory fallback store.
 *
 * Used when localStorage is unavailable (private mode, quota exceeded, or
 * blocked by browser settings) so the app keeps working for the session.
 */
const memory = new Map<string, string>();

export function readJSON<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (raw === null) raw = memory.get(key) ?? null;
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt JSON → fall back rather than crash.
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): boolean {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return false;
  }
  try {
    localStorage.setItem(key, json);
    memory.delete(key);
    return true;
  } catch {
    // Persisting failed — keep the value in memory for this session.
    memory.set(key, json);
    return false;
  }
}
