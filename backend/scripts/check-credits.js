import hre from "hardhat";

async function main() {
  const contract = await hre.ethers.getContractAt(
    "ValidusStaking",
    "0xBd7aac367ff35f7c117B0674770F702C16838145"
  );
  const addr = "0x597469A74130E6445D96496B5F9F12F91b339Caa";
  const credits = await contract.getCredits(addr);
  const stake = await contract.getStake(addr);
  console.log("Credits:", hre.ethers.formatEther(credits), "tDCAI");
  console.log("Stake:", hre.ethers.formatEther(stake), "tDCAI");
}

main().catch((e) => { console.error(e); process.exit(1); });
