import hre from "hardhat";

async function main() {
  const contract = await hre.ethers.deployContract("ValidusStaking");
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("ValidusStaking deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
