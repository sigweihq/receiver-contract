import { ethers } from "hardhat";
import { getReceiverContractFactory } from "./upgrade-utils";

export interface DeployerConfig {
  privateKey?: string;
  ownerAccount?: string;
  useLedger?: boolean;
}

export interface DeploymentResult {
  proxy?: string;
  implementation: string;
  admin?: string;
  finalOwner?: string;
  deployer: string;
  txHash?: string;
}

/**
 * Smart signer selection that finds the correct signer based on target address
 */
export async function findMatchingSigner(targetAddresses: string[]): Promise<any> {
  const signers = await ethers.getSigners();
  const signerAddresses = await Promise.all(signers.map(s => s.getAddress()));
  console.log("Available signers:", signerAddresses);

  // Try to find matching signer for each target address
  for (const targetAddress of targetAddresses) {
    if (!targetAddress) continue;
    
    for (let i = 0; i < signers.length; i++) {
      const signerAddress = signerAddresses[i];
      if (signerAddress.toLowerCase() === targetAddress.toLowerCase()) {
        console.log(`✅ Found matching signer for ${targetAddress}`);
        return signers[i];
      }
    }
  }

  // No match found, return first signer with warning
  console.log("⚠️  Warning: Could not find signer matching any target addresses!");
  console.log("Using first available signer. Make sure this address has the necessary permissions.");
  return signers[0];
}

/**
 * Sets up and validates the deployer signer
 */
export async function setupDeployer(requirePrivateKey: boolean = false, targetAddresses: string[] = []): Promise<any> {
  const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  const USE_LEDGER = process.env.USE_LEDGER === "true";

  let deployer: any;

  if (USE_LEDGER) {
    // Use hardware wallet with smart signer selection
    deployer = await findMatchingSigner(targetAddresses);
    const deployerAddress = await deployer.getAddress();
    console.log("Using hardware wallet address:", deployerAddress);
  } else {
    // Use private key
    if (!DEPLOYER_PRIVATE_KEY) {
      if (requirePrivateKey) {
        throw new Error("Please set DEPLOYER_PRIVATE_KEY environment variable or use USE_LEDGER=true");
      } else {
        // Fallback to smart signer selection for implementation-only deployments
        deployer = await findMatchingSigner(targetAddresses);
        const deployerAddress = await deployer.getAddress();
        console.log("Using default signer:", deployerAddress);
      }
    } else {
      deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, ethers.provider);
      console.log("Using private key signer:", deployer.address);
    }
  }

  return deployer;
}

/**
 * Checks and logs deployer account balance with warnings
 */
export async function checkDeployerBalance(deployer: any, minBalance: string = "0.01"): Promise<void> {
  const deployerAddress = deployer.address || await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);
  const balanceEth = ethers.formatEther(balance);
  
  console.log("Account balance:", balanceEth, "ETH");
  
  const minBalanceWei = ethers.parseEther(minBalance);
  if (balance < minBalanceWei) {
    console.log(`⚠️  Warning: Low balance. Recommended minimum: ${minBalance} ETH for gas fees.`);
  }
}

/**
 * Validates owner account configuration
 */
export function validateOwnerAccount(): string {
  const OWNER_ACCOUNT = process.env.OWNER_ACCOUNT;
  if (!OWNER_ACCOUNT) {
    throw new Error("Please set OWNER_ACCOUNT environment variable");
  }
  
  if (!ethers.isAddress(OWNER_ACCOUNT)) {
    throw new Error("OWNER_ACCOUNT must be a valid Ethereum address");
  }
  
  console.log("Target owner account:", OWNER_ACCOUNT);
  return OWNER_ACCOUNT;
}

/**
 * Deploys the ReceiverContract implementation
 */
export async function deployImplementation(deployer: any): Promise<{ address: string; txHash?: string }> {
  console.log("Deploying ReceiverContract implementation...");
  
  const ReceiverContract = await getReceiverContractFactory(deployer);
  const implementation = await ReceiverContract.deploy();
  await implementation.waitForDeployment();
  
  const implementationAddress = await implementation.getAddress();
  const deploymentTx = implementation.deploymentTransaction();
  
  console.log("✅ Implementation deployed at:", implementationAddress);
  
  if (deploymentTx) {
    console.log("Transaction hash:", deploymentTx.hash);
    console.log("Gas used:", deploymentTx.gasLimit.toString());
  }
  
  return {
    address: implementationAddress,
    txHash: deploymentTx?.hash,
  };
}

/**
 * Waits for network propagation with retry logic
 */
export async function waitForNetworkPropagation(delayMs: number = 5000): Promise<void> {
  console.log("⏳ Waiting for network propagation...");
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Gets proxy information with retry logic
 */
export async function getProxyInfo(
  proxyAddress: string,
  maxRetries: number = 3
): Promise<{ implementation: string; admin: string }> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const { upgrades } = await import("hardhat");
      const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
      
      console.log("✅ Proxy data retrieved successfully");
      return {
        implementation: implementationAddress,
        admin: adminAddress,
      };
    } catch (error: any) {
      retries++;
      console.log(`⚠️  Retry ${retries}/${maxRetries} - Network propagation still in progress...`);
      
      if (retries >= maxRetries) {
        console.log("⚠️  Proxy verification failed, but deployment likely succeeded");
        throw new Error("Cannot retrieve proxy addresses after maximum retries");
      } else {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  
  throw new Error("Failed to retrieve proxy information");
}

/**
 * Logs deployment summary
 */
export function logDeploymentSummary(result: DeploymentResult, isUpgradeable: boolean = true) {
  console.log("\n=== Deployment Summary ===");
  console.log("Proxy Address:", result.proxy);
  console.log("Implementation Address:", result.implementation);
  
  if (isUpgradeable) {
    console.log("ProxyAdmin Address:", result.admin);
    console.log("Final Owner:", result.finalOwner);
    console.log("Deployer Address:", result.deployer);
  }

  console.log("\n=== Next Steps ===");
  console.log("1. Verify contracts on BaseScan");
  console.log("2. Test contract functionality");
  console.log("3. Save addresses for future upgrades");
  
  if (isUpgradeable) {
    console.log("4. Use upgrade scripts for future versions:");
    console.log("   - For private key upgrade: use upgrade.ts");
    console.log("   - For hardware wallet: use upgrade-hardware.ts");
    console.log("   - For multisig: use upgrade-multisig.ts");
  }
}

/**
 * Common error handler for deployment scripts
 */
export function handleDeploymentError(error: any, context: string = "Deployment") {
  console.error(`❌ ${context} failed:`, error);
  console.log("\nTroubleshooting:");
  console.log("1. Verify the contract on the explorer");
  console.log("2. Check your network configuration");
  console.log("3. Verify your account has enough ETH");
  console.log("4. Check environment variables are set correctly");
  console.log("5. If verification fails, use: npx hardhat verify <address> --network <network>");
  
  // Don't throw here - let the calling function handle the error
} 