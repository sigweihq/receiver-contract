import { ethers, upgrades } from "hardhat";
import {
  getUpgradeConfig,
  checkProxyAdmin,
  getReceiverContractFactory,
  verifyUpgrade,
  getImplementationAddress,
  handleUpgradeError,
  verifyImplementation,
  UpgradeResult
} from "./upgrade-utils";

async function main(): Promise<UpgradeResult> {
  // Check if DEPLOYER_PRIVATE_KEY is set
  const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error("Please set DEPLOYER_PRIVATE_KEY environment variable");
  }

  // Create deployer wallet from private key
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, ethers.provider);
  console.log("Upgrading contracts with the account:", deployer.address);

  // Get upgrade configuration
  const config = getUpgradeConfig();
  console.log("Proxy address:", config.proxyAddress);
  
  if (config.ownerAccount) {
    console.log("Note: Contract is owned by:", config.ownerAccount);
    console.log("Make sure the deployer has ProxyAdmin permissions or use the owner account");
  }

  try {
    // Check proxy admin
    await checkProxyAdmin(config.proxyAddress, deployer.address);

    // Get contract factory
    const ReceiverContractV2 = await getReceiverContractFactory(deployer);
    
    console.log("Deploying new ReceiverContract implementation...");
    // Deploy new implementation first to get the address
    const newImplementationAddress = await upgrades.deployImplementation(ReceiverContractV2) as string;
    console.log("New implementation deployed at:", newImplementationAddress);
    
    // Verify the new implementation on block explorer
    await verifyImplementation(newImplementationAddress);
    
    console.log("Upgrading proxy to point to new implementation...");
    const upgraded = await upgrades.upgradeProxy(config.proxyAddress, ReceiverContractV2);
    await upgraded.waitForDeployment();

    console.log("ReceiverContract upgraded successfully!");
    
    // Verify the proxy now points to the new implementation
    const currentImplementationAddress = await getImplementationAddress(config.proxyAddress);
    console.log("Proxy now points to:", currentImplementationAddress);
    
    // Sanity check
    if (newImplementationAddress !== currentImplementationAddress) {
      console.log("⚠️  Warning: Implementation addresses don't match!");
      console.log("Deployed:", newImplementationAddress);
      console.log("Proxy points to:", currentImplementationAddress);
    } else {
      console.log("✅ Proxy successfully updated to new implementation");
    }
    
    // Verify the upgrade
    await verifyUpgrade(config.proxyAddress, deployer.address);

    return {
      proxy: config.proxyAddress,
      implementation: newImplementationAddress,
    };
  } catch (error) {
    handleUpgradeError(error);
    throw error; // This won't be reached due to handleUpgradeError throwing, but keeps TypeScript happy
  }
}

main()
  .then((result) => {
    console.log("\n=== Upgrade Summary ===");
    console.log("Proxy Address:", result.proxy);
    console.log("New Implementation Address:", result.implementation);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 