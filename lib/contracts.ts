import type { Abi } from "viem";

export const ROBINHOOD_TESTNET_CHAIN_ID = 46630;

// Deployed unified contract on Robinhood Chain Testnet (Chain ID: 46630)
export const DEFAULT_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CHATCODE_CONTRACT ||
  "0x3136deB04E30fF3Cb149e375457A56c465f1f5a6") as `0x${string}`;

export const LOCAL_STORAGE_CONTRACT_KEY = "chatcode:contract:v1";

export function getContractAddress(): `0x${string}` {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(LOCAL_STORAGE_CONTRACT_KEY);
    if (saved && saved.startsWith("0x") && saved.length === 42 && saved !== "0x0000000000000000000000000000000000000000") {
      return saved as `0x${string}`;
    }
  }
  return DEFAULT_CONTRACT_ADDRESS;
}

export function saveContractAddress(addr: string): void {
  if (typeof window !== "undefined") {
    if (addr.startsWith("0x") && addr.length === 42) {
      localStorage.setItem(LOCAL_STORAGE_CONTRACT_KEY, addr);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_CONTRACT_KEY);
    }
  }
}

export interface StuffResponse {
  success: boolean;
  network: {
    name: string;
    chainId: number;
    blockNumber: number;
    rpcUrl: string;
    explorerUrl: string;
    status: string;
  };
  contract?: {
    address: string | null;
    isDeployed: boolean;
    explorerUrl?: string;
    note?: string;
  };
  channel?: {
    chatCode: string;
    initiator: string;
    counterparty: string;
    status: number;
    escrowAmount: string;
    escrowStatus: number;
    metadataURI: string;
  };
  reviews?: Array<{
    id: number;
    chatCode: string;
    reviewer: string;
    peer: string;
    score: number;
    category: string;
    text: string;
    timestamp: number;
    blockNumber: number;
  }>;
  peerReputation?: {
    peer: string;
    averageScore: number;
    totalReviews: number;
  };
  error?: string;
  timestamp: number;
}

export async function getStuff(params?: {
  code?: string;
  peer?: string;
  contract?: string;
}): Promise<StuffResponse | null> {
  try {
    const q = new URLSearchParams();
    if (params?.code) q.set("code", params.code);
    if (params?.peer) q.set("peer", params.peer);
    if (params?.contract) q.set("contract", params.contract);

    const res = await fetch(`/api/stuff?${q.toString()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Failed to fetch stuff from server:", err);
    return null;
  }
}

export const CHATCODE_UNIFIED_ABI = [
  {
    type: "function",
    name: "createChannel",
    inputs: [
      { name: "chatCode", type: "string" },
      { name: "counterparty", type: "address" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "submitReview",
    inputs: [
      { name: "chatCode", type: "string" },
      { name: "peer", type: "address" },
      { name: "score", type: "uint8" },
      { name: "category", type: "string" },
      { name: "reviewText", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "depositEscrow",
    inputs: [
      { name: "chatCode", type: "string" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "releaseEscrow",
    inputs: [{ name: "chatCode", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refundEscrow",
    inputs: [{ name: "chatCode", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getReviewsByChatCode",
    inputs: [{ name: "chatCode", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "chatCode", type: "string" },
          { name: "reviewer", type: "address" },
          { name: "peer", type: "address" },
          { name: "score", type: "uint8" },
          { name: "category", type: "string" },
          { name: "text", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "blockNumber", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPeerAverageRating",
    inputs: [{ name: "peer", type: "address" }],
    outputs: [
      { name: "averageScoreScaled", type: "uint256" },
      { name: "count", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getChannel",
    inputs: [{ name: "chatCode", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "chatCode", type: "string" },
          { name: "initiator", type: "address" },
          { name: "counterparty", type: "address" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "escrowAmount", type: "uint256" },
          { name: "escrowStatus", type: "uint8" },
          { name: "metadataURI", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ReviewSubmitted",
    inputs: [
      { name: "reviewId", type: "uint256", indexed: true },
      { name: "chatCode", type: "string", indexed: true },
      { name: "reviewer", type: "address", indexed: true },
      { name: "peer", type: "address", indexed: false },
      { name: "score", type: "uint8", indexed: false },
      { name: "category", type: "string", indexed: false },
      { name: "text", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "blockNumber", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;
