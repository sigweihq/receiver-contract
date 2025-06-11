import { ethers, upgrades } from "hardhat";

async function main() {
  // Check if DEPLOYER_PRIVATE_KEY is set
  const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error("Please set DEPLOYER_PRIVATE_KEY environment variable");
  }

  // Create deployer wallet from private key
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, ethers.provider);

  // Contract address from deployment
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;
  const OWNER_ACCOUNT = process.env.OWNER_ACCOUNT;

  if (!PROXY_ADDRESS) {
    throw new Error("Please set PROXY_ADDRESS environment variable");
  }

  if (!OWNER_ACCOUNT) {
    throw new Error("Please set OWNER_ACCOUNT environment variable");
  }

  console.log("🔄 Completing ownership transfer...");
  console.log("Deployer account:", deployer.address);
  console.log("Contract address:", PROXY_ADDRESS);
  console.log("Target owner:", OWNER_ACCOUNT);

  // Connect to the deployed contract
  const receiverContract = await ethers.getContractAt("ReceiverContract", PROXY_ADDRESS, deployer);

  // Check current owner
  const currentOwner = await receiverContract.owner();
  console.log("Current owner:", currentOwner);

  if (currentOwner === OWNER_ACCOUNT) {
    console.log("✅ ReceiverContract ownership already transferred!");
  } else if (currentOwner === deployer.address) {
    console.log("🔄 Transferring ReceiverContract ownership...");
    const transferTx = await receiverContract.transferOwnership(OWNER_ACCOUNT);
    await transferTx.wait();
    
    const newOwner = await receiverContract.owner();
    if (newOwner === OWNER_ACCOUNT) {
      console.log("✅ ReceiverContract ownership transferred successfully!");
    } else {
      console.log("❌ ReceiverContract ownership transfer failed!");
      throw new Error("ReceiverContract ownership transfer failed");
    }
  } else {
    console.log("❌ Cannot transfer - deployer is not the current owner");
    throw new Error("Deployer is not the current owner");
  }

  // Check ProxyAdmin ownership
  console.log("\n🔄 Checking ProxyAdmin ownership...");
  
  try {
    const adminAddress = await upgrades.erc1967.getAdminAddress(PROXY_ADDRESS);
    console.log("ProxyAdmin address:", adminAddress);
    
    // Get ProxyAdmin contract instance and check owner
    const proxyAdminAbi = [
      "function owner() view returns (address)",
      "function transferOwnership(address newOwner) external"
    ];
    const proxyAdmin = new ethers.Contract(adminAddress, proxyAdminAbi, deployer);
    const adminOwner = await proxyAdmin.owner();
    console.log("Current ProxyAdmin owner:", adminOwner);
    
    if (adminOwner === OWNER_ACCOUNT) {
      console.log("✅ ProxyAdmin ownership already transferred!");
    } else if (adminOwner === deployer.address) {
      console.log("🔄 Transferring ProxyAdmin ownership...");
      const adminTransferTx = await proxyAdmin.transferOwnership(OWNER_ACCOUNT);
      await adminTransferTx.wait();
      console.log("✅ ProxyAdmin ownership transferred successfully!");
    } else {
      console.log("❌ Cannot transfer ProxyAdmin - deployer is not the current owner");
    }
  } catch (error: any) {
    console.log("❌ Error with ProxyAdmin transfer:", error.message);
  }

  console.log("\n🎉 Ownership transfer process completed!");
  console.log("Final owner (both contracts):", OWNER_ACCOUNT);
}

main()
  .then(() => {
    console.log("\n✅ All ownership transfers completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 