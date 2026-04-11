import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export const dcai = defineChain({
  id: 18441,
  name: "DCAI",
  nativeCurrency: { name: "tDCAI", symbol: "tDCAI", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["http://139.180.188.61:8545"],
    },
  },
  blockExplorers: {
    default: {
      name: "DCAI Explorer",
      url: "http://139.180.140.143:3002",
    },
  },
});

export const config = getDefaultConfig({
  appName: "DCAI Staking",
  projectId: "dcai-staking-app",
  chains: [dcai],
  ssr: true,
});
