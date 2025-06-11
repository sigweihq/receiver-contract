import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

export interface UpgradeConfig {
  proxyAddress: string;
  multisigAddress?: string;
  ownerAccount?: string;
}

export interface UpgradeResult {
  proxy: string;
  implementation: string;
  proxyAdmin?: string;
  upgradeCalldata?: string;
  multisig?: string;
}

/**
 * Validates required environment variables and returns upgrade configuration
 */
export function getUpgradeConfig(): UpgradeConfig {
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;
  if (!PROXY_ADDRESS) {
    throw new Error("Please set PROXY_ADDRESS environment variable");
  }

  return {
    proxyAddress: PROXY_ADDRESS,
    multisigAddress: process.env.MULTISIG_ADDRESS,
    ownerAccount: process.env.OWNER_ACCOUNT,
  };
}

/**
 * Checks and logs proxy admin information
 */
export async function checkProxyAdmin(proxyAddress: string, expectedAdmin?: string): Promise<string> {
  try {
    const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    console.log("Proxy admin address:", proxyAdminAddress);
    
    if (expectedAdmin) {
      if (proxyAdminAddress.toLowerCase() !== expectedAdmin.toLowerCase()) {
        console.log("⚠️  Warning: Expected admin does not match actual admin!");
        console.log("Expected:", expectedAdmin);
        console.log("Actual:", proxyAdminAddress);
      } else {
        console.log("✅ Admin verification passed");
      }
    }
    
    return proxyAdminAddress;
  } catch (error) {
    console.log("Could not fetch proxy admin address:", error);
    throw error;
  }
}

/**
 * Creates the contract factory for ReceiverContract
 */
export async function getReceiverContractFactory(signer?: any) {
  return await ethers.getContractFactory("ReceiverContract", signer);
}

/**
 * Logs upgrade summary information
 */
export function logUpgradeSummary(result: UpgradeResult) {
  console.log("\n=== Upgrade Summary ===");
  console.log("Proxy Address:", result.proxy);
  console.log("Implementation Address:", result.implementation);
  
  if (result.proxyAdmin) {
    console.log("Proxy Admin:", result.proxyAdmin);
  }
  
  if (result.multisig) {
    console.log("Multisig Address:", result.multisig);
  }
}

/**
 * Logs common troubleshooting information
 */
export function logTroubleshooting() {
  console.log("\nTroubleshooting:");
  console.log("1. Verify the deployer/signer has the necessary permissions");
  console.log("2. Check that you have sufficient gas fees");
  console.log("3. Ensure the proxy address is correct");
  console.log("4. Verify network configuration");
}

/**
 * Verifies upgrade success by checking owner
 */
export async function verifyUpgrade(proxyAddress: string, expectedOwner: string): Promise<boolean> {
  try {
    const contract = await ethers.getContractAt("ReceiverContract", proxyAddress);
    const owner = await contract.owner();
    
    console.log("Contract owner after upgrade:", owner);
    console.log("Expected owner:", expectedOwner);
    
    const success = owner.toLowerCase() === expectedOwner.toLowerCase();
    
    if (success) {
      console.log("✅ Contract upgraded successfully!");
    } else {
      console.log("❌ Contract upgrade verification failed!");
    }
    
    return success;
  } catch (error) {
    console.log("Could not verify upgrade:", error);
    return false;
  }
}

/**
 * Gets the new implementation address after upgrade
 */
export async function getImplementationAddress(proxyAddress: string): Promise<string> {
  return await upgrades.erc1967.getImplementationAddress(proxyAddress);
}

/**
 * Common error handler for upgrade scripts
 */
export function handleUpgradeError(error: any) {
  console.error("Upgrade failed:", error);
  logTroubleshooting();
  throw error;
}

/**
 * Verifies a newly deployed implementation contract on the block explorer
 */
export async function verifyImplementation(implementationAddress: string, contractName: string = "ReceiverContract"): Promise<void> {
  try {
    console.log(`Verifying ${contractName} implementation on block explorer...`);
    
    // Use hardhat's verify task
    await hre.run("verify:verify", {
      address: implementationAddress,
      constructorArguments: [], // Implementation contracts typically have no constructor args
    });
    
    console.log(`✅ ${contractName} implementation verified successfully!`);
    console.log(`📋 View on explorer: ${getExplorerUrl(implementationAddress)}`);
  } catch (error: any) {
    if (error.message?.includes("Already Verified")) {
      console.log(`✅ ${contractName} implementation already verified`);
    } else if (error.message?.includes("Contract source code already verified")) {
      console.log(`✅ ${contractName} implementation already verified`);
    } else {
      console.log(`⚠️  Could not verify ${contractName} implementation:`, error.message);
      console.log(`📋 Manual verification: npx hardhat verify ${implementationAddress} --network ${hre.network.name}`);
    }
  }
}

/**
 * Gets the block explorer URL for the current network
 */
function getExplorerUrl(address: string): string {
  const networkName = hre.network.name;
  
  switch (networkName) {
    case 'base':
      return `https://basescan.org/address/${address}`;
    case 'baseSepolia':
      return `https://sepolia.basescan.org/address/${address}`;
    case 'mainnet':
      return `https://etherscan.io/address/${address}`;
    case 'sepolia':
      return `https://sepolia.etherscan.io/address/${address}`;
    default:
      return `Explorer link not configured for network: ${networkName}`;
  }
} 