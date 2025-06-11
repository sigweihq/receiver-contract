import { ethers, upgrades } from "hardhat";
import {
  getUpgradeConfig,
  checkProxyAdmin,
  getReceiverContractFactory,
  handleUpgradeError,
  verifyImplementation,
  UpgradeResult
} from "./upgrade-utils";

async function main(): Promise<UpgradeResult> {
  // Get upgrade configuration
  const config = getUpgradeConfig();
  
  if (!config.multisigAddress) {
    throw new Error("Please set MULTISIG_ADDRESS environment variable");
  }

  console.log("Preparing upgrade transaction for multisig execution");
  console.log("Proxy address:", config.proxyAddress);
  console.log("Multisig address:", config.multisigAddress);

  // Get any signer (just for contract factory creation, not for transaction signing)
  const [deployer] = await ethers.getSigners();
  
  try {
    // Check proxy admin
    const proxyAdminAddress = await checkProxyAdmin(config.proxyAddress, config.multisigAddress);

    // Deploy new implementation first (this doesn't require admin permissions)
    console.log("Deploying new implementation...");
    const ReceiverContractV2 = await getReceiverContractFactory(deployer);
    const newImplementationAddress = await upgrades.deployImplementation(ReceiverContractV2) as string;
    console.log("New implementation deployed at:", newImplementationAddress);

    // Verify the new implementation on block explorer
    await verifyImplementation(newImplementationAddress);

    // Get the ProxyAdmin contract
    const ProxyAdmin = await ethers.getContractAt("ProxyAdmin", proxyAdminAddress);
    
    // Prepare the upgrade transaction data
    const upgradeCalldata = ProxyAdmin.interface.encodeFunctionData("upgrade", [
      config.proxyAddress,
      newImplementationAddress
    ]);

    console.log("\n=== Transaction Data for Multisig ===");
    console.log("To:", proxyAdminAddress);
    console.log("Value:", "0");
    console.log("Data:", upgradeCalldata);
    
    console.log("\n=== Instructions for Multisig Execution ===");
    console.log("1. Go to your multisig interface (e.g., Safe App)");
    console.log("2. Create a new transaction with:");
    console.log("   - To Address:", proxyAdminAddress);
    console.log("   - Value: 0 ETH");
    console.log("   - Data:", upgradeCalldata);
    console.log("3. Have the required number of signers approve the transaction");
    console.log("4. Execute the transaction");
    
    console.log("\n=== Alternative: Use upgradeAndCall ===");
    console.log("If you need to call an initialization function during upgrade:");
    
    // Generate transaction data for upgradeAndCall if needed
    const upgradeAndCallData = ProxyAdmin.interface.encodeFunctionData("upgradeAndCall", [
      config.proxyAddress,
      newImplementationAddress,
      "0x" // empty calldata, or add initialization call if needed
    ]);
    
    console.log("To:", proxyAdminAddress);
    console.log("Value:", "0");  
    console.log("Data:", upgradeAndCallData);

    return {
      proxy: config.proxyAddress,
      implementation: newImplementationAddress,
      proxyAdmin: proxyAdminAddress,
      upgradeCalldata,
      multisig: config.multisigAddress
    };
  } catch (error) {
    console.log("Additional multisig troubleshooting:");
    console.log("- Verify multisig address is correct");
    console.log("- Ensure multisig has sufficient ETH for gas");
    console.log("- Check that enough signers are available");
    handleUpgradeError(error);
    throw error;
  }
}

main()
  .then((result) => {
    console.log("\n=== Summary ===");
    console.log("Proxy Address:", result.proxy);
    console.log("New Implementation:", result.implementation);
    console.log("Proxy Admin:", result.proxyAdmin);
    console.log("Multisig Address:", result.multisig);
    console.log("\nReady for multisig execution!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 