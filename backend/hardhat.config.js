import "@nomicfoundation/hardhat-toolbox";

export default {
  solidity: "0.8.20",
  networks: {
    dcai: {
      url: "http://139.180.188.61:8545",
      chainId: 18441,
      accounts: ["0x62127cbc71ce6a05a68f500285e27e5078f04d78f6e0076756ec9635064af4fa"],
    },
  },
};
