import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

// Conditionally import Ledger plugin only if it's installed
try {
  require("@nomicfoundation/hardhat-ledger");
} catch (error) {
  // Ledger plugin not installed - that's fine for basic usage
}

// Environment variables will be injected by infisical
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const OWNER_ACCOUNT = process.env.OWNER_ACCOUNT || "";
const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

// Ledger configuration - use OWNER_ACCOUNT as the Ledger address
const USE_LEDGER = process.env.USE_LEDGER === "true";

// Check if Ledger plugin is available
let isLedgerAvailable = false;
try {
  require.resolve("@nomicfoundation/hardhat-ledger");
  isLedgerAvailable = true;
} catch (error) {
  if (USE_LEDGER) {
    console.warn("⚠️  USE_LEDGER=true but @nomicfoundation/hardhat-ledger is not installed.");
    console.warn("Install it with: pnpm add --save-dev @nomicfoundation/hardhat-ledger");
  }
}

// Helper to determine if we should use Ledger for this network
const shouldUseLedger = USE_LEDGER && isLedgerAvailable && OWNER_ACCOUNT;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Base Mainnet
    base: {
      url: ALCHEMY_API_KEY 
        ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : "https://mainnet.base.org",
      ...(shouldUseLedger 
        ? { ledgerAccounts: [OWNER_ACCOUNT] }
        : (DEPLOYER_PRIVATE_KEY ? { accounts: [DEPLOYER_PRIVATE_KEY] } : {})
      ),
      chainId: 8453,
      gasPrice: "auto",
    },
    // Base Sepolia Testnet
    baseSepolia: {
      url: ALCHEMY_API_KEY 
        ? `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : "https://sepolia.base.org",
      ...(shouldUseLedger 
        ? { ledgerAccounts: [OWNER_ACCOUNT] }
        : (DEPLOYER_PRIVATE_KEY ? { accounts: [DEPLOYER_PRIVATE_KEY] } : {})
      ),
      chainId: 84532,
      gasPrice: "auto",
    },
    // Base Mainnet with Ledger (explicit)
    ...(isLedgerAvailable && OWNER_ACCOUNT ? {
      baseLedger: {
        url: ALCHEMY_API_KEY 
          ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
          : "https://mainnet.base.org",
        ...{ ledgerAccounts: [OWNER_ACCOUNT] },
        chainId: 8453,
        gasPrice: "auto",
      },
      // Base Sepolia with Ledger (explicit)
      baseSepoliaLedger: {
        url: ALCHEMY_API_KEY 
          ? `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
          : "https://sepolia.base.org",
        ...{ ledgerAccounts: [OWNER_ACCOUNT] },
        chainId: 84532,
        gasPrice: "auto",
      },
    } : {}),
    // Local hardhat network
    hardhat: {
      chainId: 1337,
    },
  },
  etherscan: {
    apiKey: {
      base: BASESCAN_API_KEY,
      baseSepolia: BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

export default config;
