import { ethers, upgrades } from "hardhat";

async function main() {
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;
  
  if (!PROXY_ADDRESS) {
    throw new Error("Please set PROXY_ADDRESS environment variable");
  }

  console.log("🔍 Verifying ownership for proxy:", PROXY_ADDRESS);

  // Get the ReceiverContract instance
  const receiverContract = await ethers.getContractAt("ReceiverContract", PROXY_ADDRESS);
  
  // Check ReceiverContract owner
  const contractOwner = await receiverContract.owner();
  console.log("\n📋 Ownership Status:");
  console.log("ReceiverContract owner:", contractOwner);
  
  // Get ProxyAdmin address and check its owner
  const adminAddress = await upgrades.erc1967.getAdminAddress(PROXY_ADDRESS);
  console.log("ProxyAdmin address:", adminAddress);
  
  // Get ProxyAdmin contract instance and check owner
  const proxyAdminAbi = [
    "function owner() view returns (address)"
  ];
  const proxyAdmin = new ethers.Contract(adminAddress, proxyAdminAbi, ethers.provider);
  const adminOwner = await proxyAdmin.owner();
  console.log("ProxyAdmin owner:", adminOwner);
  
  // Check if both have the same owner
  if (contractOwner === adminOwner) {
    console.log("\n✅ Both ReceiverContract and ProxyAdmin have the same owner!");
    console.log("✅ Ownership structure is correctly configured.");
  } else {
    console.log("\n❌ WARNING: ReceiverContract and ProxyAdmin have different owners!");
    console.log("❌ This may cause issues with unified control.");
  }

  // Additional info
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("\n📊 Contract Information:");
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("Implementation Address:", implementationAddress);
  console.log("ProxyAdmin Address:", adminAddress);
  console.log("Unified Owner:", contractOwner);
}

main()
  .then(() => {
    console.log("\n🎉 Ownership verification completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 