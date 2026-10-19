import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { robinhoodTestnet } from "@/lib/wagmi";



export async function GET() {
  try {
    const client = createPublicClient({
      chain: robinhoodTestnet,
      transport: http("https://rpc.testnet.chain.robinhood.com"),
    });

    const [blockNumber, chainId] = await Promise.all([
      client.getBlockNumber(),
      client.getChainId(),
    ]);

    return NextResponse.json({
      success: true,
      network: "Robinhood Chain Testnet",
      chainId: Number(chainId),
      blockNumber: Number(blockNumber),
      rpcUrl: "https://rpc.testnet.chain.robinhood.com",
      explorerUrl: "https://explorer.testnet.chain.robinhood.com",
      status: "online",
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to query Robinhood Chain Testnet",
        chainId: 46630,
        status: "degraded",
      },
      { status: 500 }
    );
  }
}
