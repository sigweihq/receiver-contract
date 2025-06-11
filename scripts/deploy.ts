import { ethers, upgrades } from "hardhat";
import {
  setupDeployer,
  checkDeployerBalance,
  validateOwnerAccount,
  waitForNetworkPropagation,
  getProxyInfo,
  logDeploymentSummary,
  handleDeploymentError,
  DeploymentResult
} from "./deploy-utils";
import { getReceiverContractFactory } from "./upgrade-utils";

async function main(): Promise<DeploymentResult> {
  console.log("Deploying upgradeable ReceiverContract...");

  try {
    // Validate owner account first
    const OWNER_ACCOUNT = validateOwnerAccount();
    
    // Setup deployer (requires private key for proxy deployment)
    // Pass OWNER_ACCOUNT as target for smart signer selection
    const deployer = await setupDeployer(true, [OWNER_ACCOUNT]);
    
    // Check deployer balance
    await checkDeployerBalance(deployer);

    // Deploy the upgradeable ReceiverContract
    const ReceiverContract = await getReceiverContractFactory(deployer);
    
    console.log("Deploying ReceiverContract proxy...");
    const receiverContract = await upgrades.deployProxy(
      ReceiverContract,
      [deployer.address], // Initialize with deployer as owner temporarily
      { initializer: "initialize" }
    );

    await receiverContract.waitForDeployment();
    const contractAddress = await receiverContract.getAddress();

    console.log("ReceiverContract deployed to:", contractAddress);
    
    // Wait for network propagation
    await waitForNetworkPropagation();
    
    // Get proxy information with retry logic
    let proxyInfo;
    try {
      proxyInfo = await getProxyInfo(contractAddress);
    } catch (error) {
      console.log("⚠️  You can verify the deployment manually later");
      
      // Return partial result if proxy info retrieval fails
      const deployerAddress = deployer.address || await deployer.getAddress();
      return {
        proxy: contractAddress,
        implementation: "Unknown - check manually",
        admin: "Unknown - check manually",
        finalOwner: "Manual transfer required",
        deployer: deployerAddress,
      };
    }
    
    console.log("Implementation address:", proxyInfo.implementation);
    console.log("ProxyAdmin address:", proxyInfo.admin);
    
    // Verify the contract is properly initialized
    const initialOwner = await receiverContract.owner();
    const deployerAddress = deployer.address || await deployer.getAddress();
    
    console.log("Initial contract owner:", initialOwner);
    console.log("Expected initial owner (deployer):", deployerAddress);
    
    if (initialOwner.toLowerCase() === deployerAddress.toLowerCase()) {
      console.log("✅ Contract initialized successfully!");
    } else {
      console.log("❌ Contract initialization failed!");
      throw new Error("Contract initialization failed");
    }

    // Transfer ownership of ReceiverContract to OWNER_ACCOUNT
    console.log("\n🔄 Transferring ReceiverContract ownership...");
    const transferTx = await receiverContract.transferOwnership(OWNER_ACCOUNT);
    await transferTx.wait();
    
    const newOwner = await receiverContract.owner();
    if (newOwner.toLowerCase() === OWNER_ACCOUNT.toLowerCase()) {
      console.log("✅ ReceiverContract ownership transferred successfully!");
    } else {
      console.log("❌ ReceiverContract ownership transfer failed!");
      throw new Error("ReceiverContract ownership transfer failed");
    }

    // Transfer ownership of ProxyAdmin to OWNER_ACCOUNT
    console.log("\n🔄 Transferring ProxyAdmin ownership...");
    await upgrades.admin.transferProxyAdminOwnership(contractAddress, OWNER_ACCOUNT);
    console.log("✅ ProxyAdmin ownership transferred successfully!");

    return {
      proxy: contractAddress,
      implementation: proxyInfo.implementation,
      admin: proxyInfo.admin,
      finalOwner: OWNER_ACCOUNT,
      deployer: deployerAddress,
    };
  } catch (error) {
    handleDeploymentError(error, "Proxy deployment");
    throw error; // This won't be reached due to handleDeploymentError throwing
  }
}

main()
  .then((result) => {
    logDeploymentSummary(result, true);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 