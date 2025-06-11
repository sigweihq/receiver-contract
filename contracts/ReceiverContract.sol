// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ReceiverContract
 * @dev Upgradeable contract that allows the owner to withdraw ETH and tokens
 * 
 * @notice REENTRANCY PROTECTION NOT NEEDED
 * This contract deliberately does not use ReentrancyGuard because:
 * 1. No internal state variables - contract is stateless
 * 2. Only reads external state (address(this).balance, token.balanceOf()) 
 * 3. External state updates immediately upon transfer
 * 4. Subsequent reentrant calls would see reduced balance and fail require() checks
 * 5. All functions are onlyOwner, limiting attack surface
 * 
 * Traditional reentrancy attacks rely on corrupting internal state between
 * external calls, but this contract has no internal state to corrupt.
 */
contract ReceiverContract is Initializable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    // Events
    event EthWithdrawn(address indexed owner, uint256 amount);
    event TokenWithdrawn(address indexed owner, address indexed token, uint256 amount);
    event EthReceived(address indexed sender, uint256 amount);
    event MultipleTokensWithdrawn(address indexed owner, address[] tokens, uint256[] amounts);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with the owner
     * @param _owner The address to set as the owner
     */
    function initialize(address _owner) public initializer {
        require(_owner != address(0), "Owner cannot be zero address");
        
        __Ownable_init(_owner);
    }

    /**
     * @dev Allows the contract to receive ETH
     */
    receive() external payable {
        emit EthReceived(msg.sender, msg.value);
    }

    /**
     * @dev Allows the contract to receive ETH via fallback
     */
    fallback() external payable {
        emit EthReceived(msg.sender, msg.value);
    }

    /**
     * @dev Allows the owner to withdraw all ETH from the contract
     * @notice No reentrancy protection needed - see contract-level documentation
     */
    function withdrawEth() external onlyOwner {
        withdrawEth(address(this).balance);
    }

    /**
     * @dev Allows the owner to withdraw a specific amount of ETH
     * @param amount The amount of ETH to withdraw
     * @notice No reentrancy protection needed - see contract-level documentation
     */
    function withdrawEth(uint256 amount) public onlyOwner {
        require(amount > 0, "No ETH to withdraw");
        require(address(this).balance >= amount, "Insufficient ETH balance");

        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "ETH transfer failed");

        emit EthWithdrawn(owner(), amount);
    }

    /**
     * @dev Allows the owner to withdraw all tokens of a specific type
     * @param token The address of the token contract
     */
    function withdrawToken(address token) external onlyOwner {
        withdrawToken(token, getTokenBalance(token));
    }

    /**
     * @dev Allows the owner to withdraw a specific amount of tokens
     * @param token The address of the token contract
     * @param amount The amount of tokens to withdraw
     * @notice No reentrancy protection needed - see contract-level documentation
     */
    function withdrawToken(address token, uint256 amount) public onlyOwner {
        require(token != address(0), "Token address cannot be zero");
        require(amount > 0, "No tokens to withdraw");
        
        IERC20 tokenContract = IERC20(token);
        require(tokenContract.balanceOf(address(this)) >= amount, "Insufficient token balance");

        tokenContract.safeTransfer(owner(), amount);

        emit TokenWithdrawn(owner(), token, amount);
    }

    /**
     * @dev Allows the owner to withdraw all tokens of multiple types
     * @param tokens Array of token contract addresses
     * @notice No reentrancy protection needed - see contract-level documentation
     * @notice Reuses getMultipleTokenBalances and withdrawToken for code efficiency
     */
    function withdrawMultipleTokens(address[] calldata tokens) external onlyOwner {
        require(tokens.length > 0, "Tokens array cannot be empty");
        require(tokens.length <= 50, "Too many tokens (max 50)");

        // Get all balances at once using existing function
        uint256[] memory amounts = this.getMultipleTokenBalances(tokens);
        
        // Withdraw each token with non-zero balance using existing function
        for (uint256 i = 0; i < tokens.length; i++) {
            if (amounts[i] > 0) {
                withdrawToken(tokens[i], amounts[i]);
            }
        }

        emit MultipleTokensWithdrawn(owner(), tokens, amounts);
    }

    /**
     * @dev Allows the owner to withdraw specific amounts of multiple tokens
     * @param tokens Array of token contract addresses
     * @param amounts Array of amounts to withdraw for each token
     * @notice No reentrancy protection needed - see contract-level documentation
     * @notice Reuses withdrawToken for code efficiency and consistency
     */
    function withdrawMultipleTokens(address[] calldata tokens, uint256[] calldata amounts) external onlyOwner {
        require(tokens.length > 0, "Tokens array cannot be empty");
        require(tokens.length == amounts.length, "Arrays length mismatch");
        require(tokens.length <= 50, "Too many tokens (max 50)");

        // Use existing withdrawToken function for each token
        for (uint256 i = 0; i < tokens.length; i++) {
            withdrawToken(tokens[i], amounts[i]);
        }

        emit MultipleTokensWithdrawn(owner(), tokens, amounts);
    }

    /**
     * @dev Returns the current ETH balance of the contract
     */
    function getEthBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Returns the current token balance of the contract
     * @param token The address of the token contract
     */
    function getTokenBalance(address token) public view returns (uint256) {
        require(token != address(0), "Token address cannot be zero");
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @dev Returns the current token balances for multiple tokens
     * @param tokens Array of token contract addresses
     */
    function getMultipleTokenBalances(address[] calldata tokens) external view returns (uint256[] memory) {
        require(tokens.length > 0, "Tokens array cannot be empty");
        require(tokens.length <= 50, "Too many tokens (max 50)");

        uint256[] memory balances = new uint256[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Token address cannot be zero");
            balances[i] = IERC20(tokens[i]).balanceOf(address(this));
        }
        
        return balances;
    }
} 