import { beforeEach, describe, expect, it } from "vitest";
import { readJSON, writeJSON } from "./storage";

class FakeStorage {
  map = new Map<string, string>();
  failWrite = false;
  failRead = false;
  getItem(k: string) {
    if (this.failRead) throw new Error("storage blocked");
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrite) throw new Error("quota exceeded");
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

const install = (s: FakeStorage) => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = s as unknown as Storage;
};

describe("readJSON / writeJSON", () => {
  let store: FakeStorage;

  beforeEach(() => {
    store = new FakeStorage();
    install(store);
  });

  it("round-trips a value", () => {
    expect(writeJSON("k1", { a: 1 })).toBe(true);
    expect(readJSON("k1", { a: 0 })).toEqual({ a: 1 });
  });

  it("returns the fallback when the key is missing", () => {
    expect(readJSON("missing", { a: 0 })).toEqual({ a: 0 });
  });

  it("returns the fallback for corrupt JSON", () => {
    store.map.set("corrupt", "{not json");
    expect(readJSON("corrupt", { a: 0 })).toEqual({ a: 0 });
  });

  it("reports failure but keeps the value in memory when persistence fails", () => {
    store.failWrite = true;
    expect(writeJSON("k2", { b: 2 })).toBe(false);
    // The app keeps working: the value is still readable for this session.
    expect(readJSON("k2", { b: 0 })).toEqual({ b: 2 });
  });

  it("returns the fallback when reading throws and nothing is cached in memory", () => {
    store.failRead = true;
    expect(readJSON("never-written", { c: 0 })).toEqual({ c: 0 });
  });

  it("returns false when the value cannot be serialized", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(writeJSON("k3", cyclic)).toBe(false);
  });
});
