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
- Infisical CLI (for environment management)

## Installation

```bash
# Install dependencies
pnpm install

# Compile contracts
pnpm run compile
```

## Environment Setup

This project uses Infisical for environment variable management. Set up your `.env` variables through Infisical:

Required environment variables:
- `DEPLOYER_PRIVATE_KEY`: Private key of the account that will deploy contracts
- `OWNER_ACCOUNT`: Address that will own the ReceiverContract and ProxyAdmin
- `ALCHEMY_API_KEY`: Alchemy API key for Base networks
- `BASESCAN_API_KEY`: BaseScan API key for contract verification

Example infisical setup:
```bash
# Initialize infisical in your project
infisical init

# Set environment variables
infisical secrets set DEPLOYER_PRIVATE_KEY "your_private_key_here"
infisical secrets set OWNER_ACCOUNT "0x..." # Address that will control the contracts
infisical secrets set ALCHEMY_API_KEY "your_alchemy_key_here"
infisical secrets set BASESCAN_API_KEY "your_basescan_key_here"
```

## Deployment

### Local Deployment (Hardhat Network)
```bash
pnpm run deploy
```

### Base Sepolia Testnet
```bash
infisical run -- pnpm run deploy:baseSepolia
```

### Base Mainnet
```bash
infisical run -- pnpm run deploy:base
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

### Upgrade Process
1. Deploy new implementation
2. Use ProxyAdmin to upgrade

```bash
# Set the proxy address from initial deployment
export PROXY_ADDRESS="0x..."

# Run upgrade script (must be run by OWNER_ACCOUNT or authorized account)
infisical run -- pnpm run upgrade:baseSepolia

# Verify ownership structure
PROXY_ADDRESS="0x..." pnpm run verify-ownership
```

### Upgrade Script Usage
```typescript
// scripts/upgrade.ts handles the upgrade process
// Set PROXY_ADDRESS environment variable before running
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
infisical run -- pnpm run verify --network baseSepolia 0x... # contract address

# For mainnet
infisical run -- pnpm run verify --network base 0x... # contract address
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

### 2. Environment variables not loaded
- Ensure infisical is properly configured
- Run commands with `infisical run --`

### 3. Contract verification fails
- Ensure correct network configuration
- Check that BaseScan API key is set correctly
