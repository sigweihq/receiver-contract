import { ethers, upgrades } from "hardhat";

async function main() {
  // Check if DEPLOYER_PRIVATE_KEY is set
  const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error("Please set DEPLOYER_PRIVATE_KEY environment variable");
  }

  // Create deployer wallet from private key
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, ethers.provider);

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Check if OWNER_ACCOUNT is set
  const OWNER_ACCOUNT = process.env.OWNER_ACCOUNT;
  if (!OWNER_ACCOUNT) {
    throw new Error("Please set OWNER_ACCOUNT environment variable");
  }
  
  console.log("Target owner account:", OWNER_ACCOUNT);

  // Deploy the upgradeable ReceiverContract
  const ReceiverContract = await ethers.getContractFactory("ReceiverContract", deployer);
  
  console.log("Deploying ReceiverContract...");
  const receiverContract = await upgrades.deployProxy(
    ReceiverContract,
    [deployer.address], // Initialize with deployer as owner temporarily
    { initializer: "initialize" }
  );

  await receiverContract.waitForDeployment();
  const contractAddress = await receiverContract.getAddress();

  console.log("ReceiverContract deployed to:", contractAddress);
  
  // Wait for Base Sepolia network propagation before checking proxy data
  console.log("⏳ Waiting for network propagation...");
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
  
  // Get the implementation and admin addresses with retry logic
  let implementationAddress: string = "";
  let adminAddress: string = "";
  
  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    try {
      implementationAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
      adminAddress = await upgrades.erc1967.getAdminAddress(contractAddress);
      console.log("✅ Proxy data retrieved successfully");
      break;
    } catch (error: any) {
      retries++;
      console.log(`⚠️  Retry ${retries}/${maxRetries} - Network propagation still in progress...`);
      
      if (retries >= maxRetries) {
        console.log("⚠️  Proxy verification failed, but deployment likely succeeded");
        console.log("⚠️  You can verify the deployment manually later");
        
        // Try to get the addresses one more time for logging
        try {
          implementationAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
          adminAddress = await upgrades.erc1967.getAdminAddress(contractAddress);
        } catch {
          // If we still can't get them, we'll skip the ownership transfer part
          console.log("❌ Cannot retrieve proxy addresses - skipping ownership transfer");
          console.log("✅ Contract deployed but ownership transfer needs to be done manually");
          
          return {
            proxy: contractAddress,
            implementation: "Unknown - check manually",
            admin: "Unknown - check manually",
            finalOwner: "Manual transfer required",
          };
        }
      } else {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  
  console.log("Implementation address:", implementationAddress);
  console.log("ProxyAdmin address:", adminAddress);
  
  // Verify the contract is properly initialized
  const initialOwner = await receiverContract.owner();
  console.log("Initial contract owner:", initialOwner);
  console.log("Expected initial owner (deployer):", deployer.address);
  
  if (initialOwner === deployer.address) {
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
  if (newOwner === OWNER_ACCOUNT) {
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
    implementation: implementationAddress,
    admin: adminAddress,
    finalOwner: OWNER_ACCOUNT,
  };
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then((addresses) => {
    console.log("\n=== Deployment Summary ===");
    console.log("Proxy Address:", addresses.proxy);
    console.log("Implementation Address:", addresses.implementation);
    console.log("ProxyAdmin Address:", addresses.admin);
    console.log("Final Owner (ReceiverContract + ProxyAdmin):", addresses.finalOwner);
    console.log("\n🎉 Deployment completed successfully!");
    console.log("📋 Next steps:");
    console.log("1. Verify contracts on BaseScan");
    console.log("2. Test functionality with the new owner account");
    console.log("3. Update documentation with deployed addresses");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 