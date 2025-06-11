import { ethers, upgrades } from "hardhat";

async function main() {
  // Check if DEPLOYER_PRIVATE_KEY is set
  const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error("Please set DEPLOYER_PRIVATE_KEY environment variable");
  }

  // Create deployer wallet from private key
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, ethers.provider);

  console.log("Upgrading contracts with the account:", deployer.address);

  // You need to provide the proxy address from the initial deployment
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;
  const OWNER_ACCOUNT = process.env.OWNER_ACCOUNT;
  
  if (!PROXY_ADDRESS) {
    throw new Error("Please set PROXY_ADDRESS environment variable");
  }

  console.log("Proxy address:", PROXY_ADDRESS);
  
  if (OWNER_ACCOUNT) {
    console.log("Note: Contract is owned by:", OWNER_ACCOUNT);
    console.log("Make sure the deployer has ProxyAdmin permissions or use the owner account");
  }

  // Deploy the new implementation
  const ReceiverContractV2 = await ethers.getContractFactory("ReceiverContract", deployer);
  
  console.log("Upgrading ReceiverContract...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, ReceiverContractV2);

  await upgraded.waitForDeployment();

  console.log("ReceiverContract upgraded successfully!");
  
  // Get the new implementation address
  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New implementation address:", newImplementationAddress);
  
  // Verify the upgrade
  const owner = await upgraded.owner();
  console.log("Contract owner after upgrade:", owner);
  console.log("Expected owner (deployer):", deployer.address);
  
  if (owner === deployer.address) {
    console.log("✅ Contract upgraded successfully!");
  } else {
    console.log("❌ Contract upgrade verification failed!");
  }

  return {
    proxy: PROXY_ADDRESS,
    implementation: newImplementationAddress,
  };
}

main()
  .then((addresses) => {
    console.log("\n=== Upgrade Summary ===");
    console.log("Proxy Address:", addresses.proxy);
    console.log("New Implementation Address:", addresses.implementation);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 