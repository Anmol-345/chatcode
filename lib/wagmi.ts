import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { defineChain } from "viem";

/**
 * Robinhood Chain Testnet definition
 * Chain ID: 46630
 * RPC: https://rpc.testnet.chain.robinhood.com
 * Explorer: https://explorer.testnet.chain.robinhood.com
 */
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.chain.robinhood.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [robinhoodTestnet, mainnet, sepolia],
  connectors: [injected(), coinbaseWallet({ appName: "ChatCode" })],
  transports: {
    [robinhoodTestnet.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
});
