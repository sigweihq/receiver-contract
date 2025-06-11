// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @dev Mock ERC20 token for testing purposes only
 * @notice DO NOT DEPLOY TO PRODUCTION - Contains unrestricted minting
 */
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint256 initialSupply) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev Unrestricted minting function for testing purposes only
     * @notice This allows anyone to mint tokens - only for testing!
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
} 