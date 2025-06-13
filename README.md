# ReceiverContract - Upgradeable ETH & Token Recovery Contract

An OpenZeppelin-based upgradeable smart contract that allows the owner to recover ETH and ERC20 tokens sent to the contract.

## Features

- **Upgradeable**: Uses OpenZeppelin's proxy pattern for upgradeability
- **Owner-only withdrawals**: Only the contract owner can withdraw funds
- **ETH Recovery**: Withdraw all or specific amounts of ETH
- **Token Recovery**: Withdraw all or specific amounts of any ERC20 token
- **Batch Operations**: Withdraw multiple tokens in a single transaction for gas efficiency
- **Natural Reentrancy Protection**: Stateless design provides inherent protection against reentrancy attacks
- **Event Logging**: Comprehensive event logging for transparency

## Smart Contract Architecture

- **Implementation**: `ReceiverContract.sol` - The main logic contract
- **Proxy Pattern**: Uses OpenZeppelin's TransparentUpgradeableProxy
- **ProxyAdmin**: Manages upgrade permissions

### Ownership Structure

After deployment, the `OWNER_ACCOUNT` will have complete control over:
1. **ReceiverContract Business Logic**: Can withdraw ETH and tokens
2. **Upgrade Process**: Can upgrade the implementation contract via ProxyAdmin

This ensures a single account controls both the operational functionality and the upgrade mechanism.

## Prerequisites

- Node.js (v18+)
- pnpm

## Installation

```bash
# Install dependencies
pnpm install

# Compile contracts
pnpm run compile
```

## Environment Setup

Required environment variables:
- `DEPLOYER_PRIVATE_KEY`: Private key of the account that will deploy contracts (not needed for Ledger)
- `OWNER_ACCOUNT`: Address that will own the ReceiverContract and ProxyAdmin
- `ALCHEMY_API_KEY`: Alchemy API key for Base networks
- `BASESCAN_API_KEY`: BaseScan API key for contract verification

Optional (for Ledger hardware wallet):
- `USE_LEDGER`: Set to "true" to enable Ledger support

## Deployment

### Local Deployment (Hardhat Network)
```bash
pnpm run deploy
```

### Base Sepolia Testnet
```bash
pnpm run deploy:baseSepolia
```

### Base Mainnet
```bash
pnpm run deploy:base
```

## Usage

### Contract Functions

#### ETH Withdrawal
```solidity
// Withdraw all ETH
function withdrawEth() external onlyOwner

// Withdraw specific amount
function withdrawEth(uint256 amount) external onlyOwner
```

#### Token Withdrawal
```solidity
// Withdraw all tokens of a specific type
function withdrawToken(address token) external onlyOwner

// Withdraw specific amount of tokens
function withdrawToken(address token, uint256 amount) external onlyOwner

// Withdraw all balances of multiple tokens (batch operation)
function withdrawMultipleTokens(address[] calldata tokens) external onlyOwner

// Withdraw specific amounts of multiple tokens (batch operation)
function withdrawMultipleTokens(address[] calldata tokens, uint256[] calldata amounts) external onlyOwner
```

#### View Functions
```solidity
// Get ETH balance
function getEthBalance() external view returns (uint256)

// Get token balance
function getTokenBalance(address token) external view returns (uint256)

// Get balances of multiple tokens (batch operation)
function getMultipleTokenBalances(address[] calldata tokens) external view returns (uint256[] memory)
```

### JavaScript/TypeScript Usage

```typescript
import { ethers } from "hardhat";

// Connect to deployed contract
const receiverContract = await ethers.getContractAt(
  "ReceiverContract", 
  "0x..." // deployed proxy address
);

// Withdraw all ETH
await receiverContract.withdrawEth();

// Withdraw specific amount of ETH (1 ETH)
await receiverContract["withdrawEth(uint256)"](ethers.parseEther("1"));

// Withdraw all tokens
await receiverContract.withdrawToken("0x..."); // token address

// Withdraw specific amount of tokens
await receiverContract["withdrawToken(address,uint256)"](
  "0x...", // token address
  ethers.parseEther("100") // amount
);

// Batch withdraw all balances of multiple tokens
await receiverContract.withdrawMultipleTokens([
  "0x...", // token1 address
  "0x...", // token2 address
  "0x..."  // token3 address
]);

// Batch withdraw specific amounts of multiple tokens
await receiverContract["withdrawMultipleTokens(address[],uint256[])"](
  ["0x...", "0x...", "0x..."], // token addresses
  [ethers.parseEther("100"), ethers.parseEther("200"), ethers.parseEther("50")] // amounts
);

// Get multiple token balances at once
const balances = await receiverContract.getMultipleTokenBalances([
  "0x...", // token1 address
  "0x...", // token2 address
]);
```

## Contract Upgrades

There are three upgrade scripts depending on your admin setup. Each script automatically deploys the new implementation contract and either upgrades the proxy or provides transaction data for manual execution.

### 1. Private Key Admin (Standard)
For when the proxy admin is controlled by a private key:

```bash
# Set required environment variables
export PROXY_ADDRESS="0x..."  # From initial deployment
export DEPLOYER_PRIVATE_KEY="0x..."  # Admin's private key

# Run upgrade
pnpm hardhat run scripts/upgrade.ts --network baseSepolia
```

### 2. Hardware Wallet Admin
For when the proxy admin is a hardware wallet (Ledger, Trezor, etc.):

```bash
# Install hardware wallet plugin (required for Ledger support)
pnpm add --save-dev @nomicfoundation/hardhat-ledger

# Configure environment variables for Ledger
export USE_LEDGER=true
export PROXY_ADDRESS="0x..."
export OWNER_ACCOUNT="0x..."  # This should be your Ledger address

# Option 1: Use explicit Ledger networks (only available when plugin is installed)
pnpm hardhat run scripts/upgrade-hardware.ts --network baseSepoliaLedger

# Option 2: Use regular networks with USE_LEDGER=true
pnpm hardhat run scripts/upgrade-hardware.ts --network baseSepolia
```

**Note:** The Ledger plugin is optional. Tests and basic functionality work without it. Only install if you need hardware wallet support.

The script will automatically:
- Deploy the new implementation contract
- Find the correct signer matching the proxy admin address
- Prompt you to confirm both transactions on your hardware wallet
- Handle hardware wallet-specific error cases

### 3. Multisig Admin
For when the proxy admin is a multisig wallet (Safe, etc.):

```bash
# Set required environment variables
export PROXY_ADDRESS="0x..."
export MULTISIG_ADDRESS="0x..."  # Your multisig address

# Generate transaction data for multisig execution
pnpm hardhat run scripts/upgrade-multisig.ts --network baseSepolia
```

This script will:
1. Deploy the new implementation contract
2. Generate the exact transaction data needed for your multisig
3. Provide step-by-step instructions for multisig execution

Then execute through your multisig interface:
1. Go to your multisig (e.g., Safe App)
2. Create a new transaction with the provided data
3. Have required signers approve and execute

### Post-Upgrade Verification

```bash
# Verify ownership structure after upgrade
PROXY_ADDRESS="0x..." pnpm run verify-ownership

# Verify the new implementation is active
pnpm hardhat run scripts/verify-upgrade.ts --network baseSepolia
```

## Testing

```bash
# Run all tests
pnpm run test

# Run with gas reporting
pnpm run gas-report

# Run coverage
pnpm run coverage

# Verify ownership structure (after deployment)
PROXY_ADDRESS="0x..." pnpm run verify-ownership
```

### Test Coverage

The test suite covers:
- ✅ Contract deployment and initialization
- ✅ ETH receiving and withdrawal
- ✅ Token withdrawal functionality
- ✅ Batch token operations (withdraw multiple tokens)
- ✅ Access control (owner-only functions)
- ✅ Edge cases and error conditions
- ✅ Upgradeability
- ✅ Natural reentrancy protection (stateless design)

## Contract Verification

After deployment, verify your contracts:

```bash
# Verify on BaseScan
pnpm run verify --network baseSepolia 0x... # contract address

# For mainnet
pnpm run verify --network base 0x... # contract address
```

## Security Features

1. **OpenZeppelin Contracts**: Uses battle-tested OpenZeppelin libraries
2. **Access Control**: Only owner can withdraw funds
3. **Natural Reentrancy Protection**: Stateless design makes reentrancy attacks impossible
4. **Input Validation**: Comprehensive input validation
5. **Safe Transfers**: Uses SafeERC20 for token transfers
6. **Upgrade Safety**: Follows OpenZeppelin's upgradeable patterns
7. **Integer Overflow Protection**: Solidity 0.8.24 built-in protection

### Why No ReentrancyGuard?

This contract deliberately **does not use** OpenZeppelin's ReentrancyGuard because:

- ✅ **No internal state variables** - The contract is completely stateless
- ✅ **External state only** - Only reads `address(this).balance` and `token.balanceOf(address(this))`
- ✅ **Immediate updates** - External state updates immediately upon transfer
- ✅ **Natural protection** - Subsequent reentrant calls see reduced balance and fail `require()` checks
- ✅ **Gas efficiency** - Saves ~2,300 gas per function call

Traditional reentrancy attacks rely on corrupting internal state between external calls, but this contract has no internal state to corrupt.

## Network Configuration

### Base Mainnet
- Chain ID: 8453
- RPC: `https://mainnet.base.org`
- Explorer: `https://basescan.org`

### Base Sepolia
- Chain ID: 84532
- RPC: `https://sepolia.base.org`  
- Explorer: `https://sepolia.basescan.org`

## Events

The contract emits the following events:

```solidity
event EthWithdrawn(address indexed owner, uint256 amount);
event TokenWithdrawn(address indexed owner, address indexed token, uint256 amount);
event EthReceived(address indexed sender, uint256 amount);
event MultipleTokensWithdrawn(address indexed owner, address[] tokens, uint256[] amounts);
```

## Common Issues & Solutions

### 1. "Insufficient funds" error
- Ensure the deployer account has enough ETH for gas fees
- Check account balance: `pnpm hardhat run scripts/check-balance.ts`

### 2. Contract verification fails
- Ensure correct network configuration
- Check that BaseScan API key is set correctly
