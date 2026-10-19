import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import type { Address } from "./types";

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

/** Resolve an ENS name (e.g. "somename.eth") to its lowercase 0x address. */
export async function resolveAddress(name: string): Promise<Address | null> {
  try {
    const resolved = await publicClient.getEnsAddress({ name: normalize(name) });
    return resolved ?? null;
  } catch {
    return null;
  }
}

/** Reverse-resolve an address to its ENS name, forward-verified. */
export async function reverseName(address: Address): Promise<string | null> {
  try {
    const name = await publicClient.getEnsName({ address });
    if (!name) return null;
    const resolved = await resolveAddress(name);
    if (resolved && resolved.toLowerCase() === address.toLowerCase()) return name;
    return null;
  } catch {
    return null;
  }
}
