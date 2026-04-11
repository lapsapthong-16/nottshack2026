import hre from "hardhat";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const address = await signer.getAddress();
  console.log("Wallet:", address);

  // Send self-transfers with nonce 3, 4, 5 to clear the stuck queue
  for (let nonce = 3; nonce <= 5; nonce++) {
    console.log(`Sending replacement tx with nonce ${nonce}...`);
    const tx = await signer.sendTransaction({
      to: address,
      value: 0,
      nonce: nonce,
      gasLimit: 21000,
    });
    console.log(`  TX ${nonce}: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  Confirmed in block ${receipt.blockNumber}`);
  }

  console.log("Nonce queue cleared! Now testing topUp...");
  const contract = await hre.ethers.getContractAt(
    "ValidusStaking",
    "0xBd7aac367ff35f7c117B0674770F702C16838145"
  );
  const tx = await contract.topUp({ value: hre.ethers.parseEther("0.001") });
  console.log("TopUp TX:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed block:", receipt.blockNumber);

  const credits = await contract.getCredits(address);
  console.log("Credits:", hre.ethers.formatEther(credits), "tDCAI");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
