import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [injected(), coinbaseWallet({ appName: "ChatCode" })],
  transports: { [mainnet.id]: http() },
  ssr: true,
});
