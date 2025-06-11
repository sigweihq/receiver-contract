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
import { findMatchingSigner } from "./deploy-utils";

async function main(): Promise<UpgradeResult> {
  // For hardware wallets, you'll need to configure hardhat.config.ts with:
  // - Ledger plugin: @nomicfoundation/hardhat-ledger
  // - Or use a provider that connects to your hardware wallet
  
  // Get upgrade configuration
  const config = getUpgradeConfig();
  console.log("Proxy address:", config.proxyAddress);

  // Get the proxy admin address for smart signer selection
  let proxyAdminAddress: string;
  try {
    proxyAdminAddress = await upgrades.erc1967.getAdminAddress(config.proxyAddress);
    console.log("Proxy admin address:", proxyAdminAddress);
  } catch (error) {
    throw new Error(`Could not fetch proxy admin address: ${error}`);
  }

  // Use smart signer selection with proxy admin and owner account as targets
  const targetAddresses = [proxyAdminAddress, config.ownerAccount].filter(Boolean) as string[];
  const deployer = await findMatchingSigner(targetAddresses);
  
  const deployerAddress = await deployer.getAddress();
  console.log("Using hardware wallet address:", deployerAddress);

  try {
    // Check proxy admin
    await checkProxyAdmin(config.proxyAddress, deployerAddress);

    // Get contract factory
    const ReceiverContractV2 = await getReceiverContractFactory(deployer);
    
    console.log("Deploying new ReceiverContract implementation...");
    console.log("Please confirm the deployment transaction on your hardware wallet...");
    // Deploy new implementation first to get the address
    const newImplementationAddress = await upgrades.deployImplementation(ReceiverContractV2) as string;
    console.log("New implementation deployed at:", newImplementationAddress);
    
    // Verify the new implementation on block explorer
    await verifyImplementation(newImplementationAddress);
    
    console.log("Upgrading proxy to point to new implementation...");
    console.log("Please confirm the upgrade transaction on your hardware wallet...");
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
    
    // Verify upgrade (optional for hardware wallets since owner might be different)
    try {
      await verifyUpgrade(config.proxyAddress, deployerAddress);
    } catch (error) {
      console.log("Note: Owner verification skipped (normal for hardware wallet scenarios)");
    }
    
    return {
      proxy: config.proxyAddress,
      implementation: newImplementationAddress,
    };
  } catch (error) {
    console.log("Additional hardware wallet troubleshooting:");
    console.log("- Make sure your hardware wallet is connected and unlocked");
    console.log("- Try using a different USB port/cable");
    console.log("- Verify hardware wallet drivers are installed");
    handleUpgradeError(error);
    throw error;
  }
}

main()
  .then((result) => {
    console.log("\n=== Upgrade Summary ===");
    console.log("Proxy Address:", result.proxy);
    console.log("New Implementation Address:", result.implementation);
    console.log("Hardware wallet upgrade completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 