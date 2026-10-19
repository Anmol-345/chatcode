import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import { robinhoodTestnet } from "@/lib/wagmi";
import { CHATCODE_UNIFIED_ABI, getContractAddress } from "@/lib/contracts";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contract = searchParams.get("contract") || getContractAddress();
    const chatCode = searchParams.get("code");
    const peer = searchParams.get("peer");

    if (!contract || !isAddress(contract)) {
      return NextResponse.json({
        success: false,
        error: "No valid contract address specified or configured.",
      }, { status: 400 });
    }

    const client = createPublicClient({
      chain: robinhoodTestnet,
      transport: http("https://rpc.testnet.chain.robinhood.com"),
    });

    // Query reviews for a specific chat code
    if (chatCode) {
      const reviews = await client.readContract({
        address: contract as `0x${string}`,
        abi: CHATCODE_UNIFIED_ABI,
        functionName: "getReviewsByChatCode",
        args: [chatCode],
      });
      return NextResponse.json({
        success: true,
        contract,
        chatCode,
        reviews,
      });
    }

    // Query reputation for a specific peer
    if (peer && isAddress(peer)) {
      const [avgScaled, count] = await client.readContract({
        address: contract as `0x${string}`,
        abi: CHATCODE_UNIFIED_ABI,
        functionName: "getPeerAverageRating",
        args: [peer as `0x${string}`],
      }) as [bigint, bigint];

      return NextResponse.json({
        success: true,
        contract,
        peer,
        averageScore: Number(avgScaled) / 100,
        totalReviews: Number(count),
      });
    }

    return NextResponse.json({
      success: true,
      contract,
      status: "connected",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || "Failed to query contract",
    }, { status: 500 });
  }
}
