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

    const client = createPublicClient({
      chain: robinhoodTestnet,
      transport: http("https://rpc.testnet.chain.robinhood.com"),
    });

    // 1. Live Network Status from Robinhood Testnet RPC
    const [blockNumber, chainId] = await Promise.all([
      client.getBlockNumber(),
      client.getChainId(),
    ]);

    const result: Record<string, any> = {
      success: true,
      network: {
        name: "Robinhood Chain Testnet",
        chainId: Number(chainId),
        blockNumber: Number(blockNumber),
        rpcUrl: "https://rpc.testnet.chain.robinhood.com",
        explorerUrl: "https://explorer.testnet.chain.robinhood.com",
        status: "online",
      },
      timestamp: Date.now(),
    };

    // 2. If a valid contract address is configured, check bytecode & query state
    if (contract && isAddress(contract) && contract !== "0x0000000000000000000000000000000000000000") {
      const code = await client.getCode({ address: contract as `0x${string}` });
      const isDeployed = Boolean(code && code !== "0x");

      result.contract = {
        address: contract,
        isDeployed,
        explorerUrl: `https://explorer.testnet.chain.robinhood.com/address/${contract}`,
      };

      if (isDeployed) {
        // Query channel data if code provided
        if (chatCode) {
          try {
            const [channelData, reviews] = await Promise.all([
              client.readContract({
                address: contract as `0x${string}`,
                abi: CHATCODE_UNIFIED_ABI,
                functionName: "getChannel",
                args: [chatCode],
              }) as Promise<any>,
              client.readContract({
                address: contract as `0x${string}`,
                abi: CHATCODE_UNIFIED_ABI,
                functionName: "getReviewsByChatCode",
                args: [chatCode],
              }) as Promise<any>,
            ]);

            result.channel = {
              chatCode,
              initiator: channelData.initiator,
              counterparty: channelData.counterparty,
              status: Number(channelData.status),
              escrowAmount: channelData.escrowAmount.toString(),
              escrowStatus: Number(channelData.escrowStatus),
              metadataURI: channelData.metadataURI,
            };

            result.reviews = (reviews || []).map((r: any) => ({
              id: Number(r.id),
              chatCode: r.chatCode,
              reviewer: r.reviewer,
              peer: r.peer,
              score: Number(r.score),
              category: r.category,
              text: r.text,
              timestamp: Number(r.timestamp),
              blockNumber: Number(r.blockNumber),
            }));
          } catch (e: any) {
            result.channelError = e?.message || "Failed to query channel from contract";
          }
        }

        // Query peer reputation if peer address provided
        if (peer && isAddress(peer)) {
          try {
            const [avgScaled, count] = (await client.readContract({
              address: contract as `0x${string}`,
              abi: CHATCODE_UNIFIED_ABI,
              functionName: "getPeerAverageRating",
              args: [peer as `0x${string}`],
            })) as [bigint, bigint];

            result.peerReputation = {
              peer,
              averageScore: Number(avgScaled) / 100,
              totalReviews: Number(count),
            };
          } catch (e: any) {
            result.peerReputationError = e?.message || "Failed to query peer reputation";
          }
        }
      }
    } else {
      result.contract = {
        address: contract || null,
        isDeployed: false,
        note: "Contract not configured yet. Deploy via Remix and set address in UI.",
      };
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Server error while fetching stuff",
        network: {
          name: "Robinhood Chain Testnet",
          chainId: 46630,
          status: "error",
        },
      },
      { status: 500 }
    );
  }
}
