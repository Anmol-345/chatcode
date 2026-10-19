import { isAddress, type Address as ViemAddress } from "viem";
import type { Address } from "./types";

export function buildInviteLink(address: Address, code?: string): string {
  const params = new URLSearchParams({ peer: address.toLowerCase() });
  if (code) params.set("code", code);
  return `/?${params.toString()}`;
}

export function parseInviteParams(search: string): { peer?: Address; code?: string } {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const peerRaw = params.get("peer");
  const code = params.get("code") || undefined;
  const peer = peerRaw && isAddress(peerRaw) ? (peerRaw as ViemAddress) : undefined;
  return peer ? { peer: peer as Address, ...(code ? { code } : {}) } : {};
}
