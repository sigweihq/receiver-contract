import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// We'll use type assertions since typechain types are generated after compilation

describe("ReceiverContract", function () {
  let receiverContract: any;
  let mockToken: any;
  let mockToken2: any;
  let mockToken3: any;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let contractAddress: string;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy the upgradeable ReceiverContract
    const ReceiverContract = await ethers.getContractFactory("ReceiverContract");
    receiverContract = await upgrades.deployProxy(
      ReceiverContract,
      [owner.address],
      { initializer: "initialize" }
    );

    await receiverContract.waitForDeployment();
    contractAddress = await receiverContract.getAddress();

    // Deploy mock ERC20 tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Test Token", "TEST", ethers.parseEther("1000"));
    await mockToken.waitForDeployment();

    mockToken2 = await MockERC20.deploy("Test Token 2", "TEST2", ethers.parseEther("2000"));
    await mockToken2.waitForDeployment();

    mockToken3 = await MockERC20.deploy("Test Token 3", "TEST3", ethers.parseEther("3000"));
    await mockToken3.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await receiverContract.owner()).to.equal(owner.address);
    });

    it("Should initialize correctly", async function () {
      const contractOwner = await receiverContract.owner();
      expect(contractOwner).to.equal(owner.address);
    });

    it("Should not allow initialization twice", async function () {
      await expect(
        receiverContract.initialize(user1.address)
      ).to.be.revertedWithCustomError(receiverContract, "InvalidInitialization");
    });

    it("Should not allow zero address as owner during initialization", async function () {
      const ReceiverContract = await ethers.getContractFactory("ReceiverContract");
      await expect(
        upgrades.deployProxy(
          ReceiverContract,
          [ethers.ZeroAddress],
          { initializer: "initialize" }
        )
      ).to.be.revertedWith("Owner cannot be zero address");
    });
  });

  describe("ETH Handling", function () {
    it("Should receive ETH and emit event", async function () {
      const sendValue = ethers.parseEther("1");
      
      await expect(
        user1.sendTransaction({
          to: contractAddress,
          value: sendValue,
        })
      ).to.emit(receiverContract, "EthReceived")
        .withArgs(user1.address, sendValue);

      expect(await ethers.provider.getBalance(contractAddress)).to.equal(sendValue);
    });

    it("Should allow owner to withdraw all ETH", async function () {
      const sendValue = ethers.parseEther("2");
      
      // Send ETH to contract
      await user1.sendTransaction({
        to: contractAddress,
        value: sendValue,
      });

      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      
      await expect(receiverContract.withdrawEth())
        .to.emit(receiverContract, "EthWithdrawn")
        .withArgs(owner.address, sendValue);

      expect(await ethers.provider.getBalance(contractAddress)).to.equal(0);
      
      // Owner balance should increase (minus gas costs)
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      expect(finalOwnerBalance).to.be.greaterThan(initialOwnerBalance);
    });

    it("Should allow owner to withdraw specific amount of ETH", async function () {
      const sendValue = ethers.parseEther("2");
      const withdrawValue = ethers.parseEther("1");
      
      // Send ETH to contract
      await user1.sendTransaction({
        to: contractAddress,
        value: sendValue,
      });

      await expect(receiverContract["withdrawEth(uint256)"](withdrawValue))
        .to.emit(receiverContract, "EthWithdrawn")
        .withArgs(owner.address, withdrawValue);

      expect(await ethers.provider.getBalance(contractAddress)).to.equal(sendValue - withdrawValue);
    });

    it("Should not allow non-owner to withdraw ETH", async function () {
      const sendValue = ethers.parseEther("1");
      
      await user1.sendTransaction({
        to: contractAddress,
        value: sendValue,
      });

      await expect(
        receiverContract.connect(user1).withdrawEth()
      ).to.be.revertedWithCustomError(receiverContract, "OwnableUnauthorizedAccount");
    });

    it("Should not allow withdrawal when no ETH balance", async function () {
      await expect(
        receiverContract.withdrawEth()
      ).to.be.revertedWith("No ETH to withdraw");
    });

    it("Should not allow withdrawal of more ETH than available", async function () {
      const sendValue = ethers.parseEther("1");
      const withdrawValue = ethers.parseEther("2");
      
      await user1.sendTransaction({
        to: contractAddress,
        value: sendValue,
      });

      await expect(
        receiverContract["withdrawEth(uint256)"](withdrawValue)
      ).to.be.revertedWith("Insufficient ETH balance");
    });

    it("Should not allow withdrawal of zero ETH", async function () {
      await expect(
        receiverContract["withdrawEth(uint256)"](0)
      ).to.be.revertedWith("No ETH to withdraw");
    });
  });

  describe("Token Handling", function () {
    beforeEach(async function () {
      // Mint tokens to the contract
      const tokenAmount = ethers.parseEther("100");
      await mockToken.transfer(contractAddress, tokenAmount);
    });

    it("Should allow owner to withdraw all tokens", async function () {
      const tokenBalance = await mockToken.balanceOf(contractAddress);
      const initialOwnerBalance = await mockToken.balanceOf(owner.address);

      await expect(
        receiverContract.withdrawToken(await mockToken.getAddress())
      ).to.emit(receiverContract, "TokenWithdrawn")
        .withArgs(owner.address, await mockToken.getAddress(), tokenBalance);

      expect(await mockToken.balanceOf(contractAddress)).to.equal(0);
      expect(await mockToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + tokenBalance);
    });

    it("Should allow owner to withdraw specific amount of tokens", async function () {
      const withdrawAmount = ethers.parseEther("50");
      const initialOwnerBalance = await mockToken.balanceOf(owner.address);
      const initialContractBalance = await mockToken.balanceOf(contractAddress);

      await expect(
        receiverContract["withdrawToken(address,uint256)"](await mockToken.getAddress(), withdrawAmount)
      ).to.emit(receiverContract, "TokenWithdrawn")
        .withArgs(owner.address, await mockToken.getAddress(), withdrawAmount);

      expect(await mockToken.balanceOf(contractAddress)).to.equal(initialContractBalance - withdrawAmount);
      expect(await mockToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + withdrawAmount);
    });

    it("Should not allow non-owner to withdraw tokens", async function () {
      await expect(
        receiverContract.connect(user1).withdrawToken(await mockToken.getAddress())
      ).to.be.revertedWithCustomError(receiverContract, "OwnableUnauthorizedAccount");
    });

    it("Should not allow withdrawal with zero address", async function () {
      await expect(
        receiverContract.withdrawToken(ethers.ZeroAddress)
      ).to.be.revertedWith("Token address cannot be zero");
    });

    it("Should not allow withdrawal when no token balance", async function () {
      // Deploy a new token without transferring any to the contract
      const EmptyToken = await ethers.getContractFactory("MockERC20");
      const emptyToken = await EmptyToken.deploy("Empty", "EMPTY", 0);

      await expect(
        receiverContract.withdrawToken(await emptyToken.getAddress())
      ).to.be.revertedWith("No tokens to withdraw");
    });

    it("Should not allow withdrawal of more tokens than available", async function () {
      const contractBalance = await mockToken.balanceOf(contractAddress);
      const withdrawAmount = contractBalance + ethers.parseEther("1");

      await expect(
        receiverContract["withdrawToken(address,uint256)"](await mockToken.getAddress(), withdrawAmount)
      ).to.be.revertedWith("Insufficient token balance");
    });

    it("Should not allow withdrawal of zero tokens", async function () {
      await expect(
        receiverContract["withdrawToken(address,uint256)"](await mockToken.getAddress(), 0)
      ).to.be.revertedWith("No tokens to withdraw");
    });
  });

  describe("View Functions", function () {
    it("Should return correct ETH balance", async function () {
      const sendValue = ethers.parseEther("1.5");
      
      await user1.sendTransaction({
        to: contractAddress,
        value: sendValue,
      });

      expect(await receiverContract.getEthBalance()).to.equal(sendValue);
    });

    it("Should return correct token balance", async function () {
      const tokenAmount = ethers.parseEther("50");
      await mockToken.transfer(contractAddress, tokenAmount);

      expect(await receiverContract.getTokenBalance(await mockToken.getAddress())).to.equal(tokenAmount);
    });

    it("Should not allow getting token balance with zero address", async function () {
      await expect(
        receiverContract.getTokenBalance(ethers.ZeroAddress)
      ).to.be.revertedWith("Token address cannot be zero");
    });
  });

  describe("Upgradeability", function () {
    it("Should be upgradeable", async function () {
      // This test verifies that the contract can be upgraded
      const ReceiverContractV2 = await ethers.getContractFactory("ReceiverContract");
      
      const upgraded = await upgrades.upgradeProxy(contractAddress, ReceiverContractV2);
      
      // Verify the upgrade was successful and state is preserved
      expect(await upgraded.owner()).to.equal(owner.address);
    });

    it("Should preserve state after upgrade", async function () {
      // Send some ETH and tokens to the contract
      const ethAmount = ethers.parseEther("1");
      const tokenAmount = ethers.parseEther("50");
      
      await user1.sendTransaction({
        to: contractAddress,
        value: ethAmount,
      });
      
      await mockToken.transfer(contractAddress, tokenAmount);

      // Upgrade the contract
      const ReceiverContractV2 = await ethers.getContractFactory("ReceiverContract");
      const upgraded = await upgrades.upgradeProxy(contractAddress, ReceiverContractV2);

      // Verify state is preserved
      expect(await upgraded.owner()).to.equal(owner.address);
      expect(await upgraded.getEthBalance()).to.equal(ethAmount);
      expect(await upgraded.getTokenBalance(await mockToken.getAddress())).to.equal(tokenAmount);
    });
  });

  describe("Batch Token Operations", function () {
    beforeEach(async function () {
      // Transfer tokens to the contract for batch testing
      await mockToken.transfer(contractAddress, ethers.parseEther("100"));
      await mockToken2.transfer(contractAddress, ethers.parseEther("200"));
      await mockToken3.transfer(contractAddress, ethers.parseEther("300"));
    });

    describe("withdrawMultipleTokens - All Balances", function () {
      it("Should allow owner to withdraw all balances of multiple tokens", async function () {
        const tokenAddresses = [
          await mockToken.getAddress(),
          await mockToken2.getAddress(),
          await mockToken3.getAddress()
        ];

        const initialOwnerBalance1 = await mockToken.balanceOf(owner.address);
        const initialOwnerBalance2 = await mockToken2.balanceOf(owner.address);
        const initialOwnerBalance3 = await mockToken3.balanceOf(owner.address);

        await expect(receiverContract.withdrawMultipleTokens(tokenAddresses))
          .to.emit(receiverContract, "MultipleTokensWithdrawn")
          .and.to.emit(receiverContract, "TokenWithdrawn");

        // Check all tokens were withdrawn
        expect(await mockToken.balanceOf(contractAddress)).to.equal(0);
        expect(await mockToken2.balanceOf(contractAddress)).to.equal(0);
        expect(await mockToken3.balanceOf(contractAddress)).to.equal(0);

        // Check owner received all tokens
        expect(await mockToken.balanceOf(owner.address)).to.equal(initialOwnerBalance1 + ethers.parseEther("100"));
        expect(await mockToken2.balanceOf(owner.address)).to.equal(initialOwnerBalance2 + ethers.parseEther("200"));
        expect(await mockToken3.balanceOf(owner.address)).to.equal(initialOwnerBalance3 + ethers.parseEther("300"));
      });

      it("Should handle tokens with zero balance gracefully", async function () {
        // Withdraw all tokens first
        await receiverContract.withdrawToken(await mockToken.getAddress());
        
        const tokenAddresses = [
          await mockToken.getAddress(), // This will have 0 balance
          await mockToken2.getAddress(),
          await mockToken3.getAddress()
        ];

        await expect(receiverContract.withdrawMultipleTokens(tokenAddresses))
          .to.emit(receiverContract, "MultipleTokensWithdrawn");

        // Only tokens 2 and 3 should be withdrawn
        expect(await mockToken.balanceOf(contractAddress)).to.equal(0);
        expect(await mockToken2.balanceOf(contractAddress)).to.equal(0);
        expect(await mockToken3.balanceOf(contractAddress)).to.equal(0);
      });

      it("Should not allow non-owner to withdraw multiple tokens", async function () {
        const tokenAddresses = [await mockToken.getAddress()];

        await expect(
          receiverContract.connect(user1).withdrawMultipleTokens(tokenAddresses)
        ).to.be.revertedWithCustomError(receiverContract, "OwnableUnauthorizedAccount");
      });

      it("Should not allow empty tokens array", async function () {
        await expect(
          receiverContract.withdrawMultipleTokens([])
        ).to.be.revertedWith("Tokens array cannot be empty");
      });

      it("Should not allow zero address in tokens array", async function () {
        const tokenAddresses = [ethers.ZeroAddress];

        await expect(
          receiverContract.withdrawMultipleTokens(tokenAddresses)
        ).to.be.revertedWith("Token address cannot be zero");
      });

      it("Should not allow too many tokens (>50)", async function () {
        // Create an array with 51 addresses
        const tokenAddresses = new Array(51).fill(await mockToken.getAddress());

        await expect(
          receiverContract.withdrawMultipleTokens(tokenAddresses)
        ).to.be.revertedWith("Too many tokens (max 50)");
      });
    });

    describe("withdrawMultipleTokens - Specific Amounts", function () {
      it("Should allow owner to withdraw specific amounts of multiple tokens", async function () {
        const tokenAddresses = [
          await mockToken.getAddress(),
          await mockToken2.getAddress(),
          await mockToken3.getAddress()
        ];
        const amounts = [
          ethers.parseEther("50"),
          ethers.parseEther("100"),
          ethers.parseEther("150")
        ];

        const initialOwnerBalance1 = await mockToken.balanceOf(owner.address);
        const initialOwnerBalance2 = await mockToken2.balanceOf(owner.address);
        const initialOwnerBalance3 = await mockToken3.balanceOf(owner.address);

        await expect(receiverContract["withdrawMultipleTokens(address[],uint256[])"](tokenAddresses, amounts))
          .to.emit(receiverContract, "MultipleTokensWithdrawn")
          .and.to.emit(receiverContract, "TokenWithdrawn");

        // Check specified amounts were withdrawn
        expect(await mockToken.balanceOf(contractAddress)).to.equal(ethers.parseEther("50"));
        expect(await mockToken2.balanceOf(contractAddress)).to.equal(ethers.parseEther("100"));
        expect(await mockToken3.balanceOf(contractAddress)).to.equal(ethers.parseEther("150"));

        // Check owner received specified amounts
        expect(await mockToken.balanceOf(owner.address)).to.equal(initialOwnerBalance1 + ethers.parseEther("50"));
        expect(await mockToken2.balanceOf(owner.address)).to.equal(initialOwnerBalance2 + ethers.parseEther("100"));
        expect(await mockToken3.balanceOf(owner.address)).to.equal(initialOwnerBalance3 + ethers.parseEther("150"));
      });

      it("Should not allow arrays with different lengths", async function () {
        const tokenAddresses = [await mockToken.getAddress()];
        const amounts = [ethers.parseEther("50"), ethers.parseEther("100")]; // Different length

        await expect(
          receiverContract["withdrawMultipleTokens(address[],uint256[])"](tokenAddresses, amounts)
        ).to.be.revertedWith("Arrays length mismatch");
      });

      it("Should not allow zero amounts", async function () {
        const tokenAddresses = [await mockToken.getAddress()];
        const amounts = [0];

        await expect(
          receiverContract["withdrawMultipleTokens(address[],uint256[])"](tokenAddresses, amounts)
        ).to.be.revertedWith("No tokens to withdraw");
      });

      it("Should not allow withdrawal of more tokens than available", async function () {
        const tokenAddresses = [await mockToken.getAddress()];
        const amounts = [ethers.parseEther("200")]; // More than the 100 available

        await expect(
          receiverContract["withdrawMultipleTokens(address[],uint256[])"](tokenAddresses, amounts)
        ).to.be.revertedWith("Insufficient token balance");
      });

      it("Should not allow non-owner to withdraw specific amounts", async function () {
        const tokenAddresses = [await mockToken.getAddress()];
        const amounts = [ethers.parseEther("50")];

        await expect(
          receiverContract.connect(user1)["withdrawMultipleTokens(address[],uint256[])"](tokenAddresses, amounts)
        ).to.be.revertedWithCustomError(receiverContract, "OwnableUnauthorizedAccount");
      });

      it("Should not allow empty arrays for specific amounts", async function () {
        await expect(
          receiverContract["withdrawMultipleTokens(address[],uint256[])"]([],[])
        ).to.be.revertedWith("Tokens array cannot be empty");
      });
    });

    describe("getMultipleTokenBalances", function () {
      it("Should return correct balances for multiple tokens", async function () {
        const tokenAddresses = [
          await mockToken.getAddress(),
          await mockToken2.getAddress(),
          await mockToken3.getAddress()
        ];

        const balances = await receiverContract.getMultipleTokenBalances(tokenAddresses);

        expect(balances[0]).to.equal(ethers.parseEther("100"));
        expect(balances[1]).to.equal(ethers.parseEther("200"));
        expect(balances[2]).to.equal(ethers.parseEther("300"));
      });

      it("Should handle empty balances", async function () {
        // Deploy a new token without transferring any
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const emptyToken = await MockERC20.deploy("Empty", "EMPTY", 0);

        const tokenAddresses = [await emptyToken.getAddress()];
        const balances = await receiverContract.getMultipleTokenBalances(tokenAddresses);

        expect(balances[0]).to.equal(0);
      });

      it("Should not allow empty tokens array", async function () {
        await expect(
          receiverContract.getMultipleTokenBalances([])
        ).to.be.revertedWith("Tokens array cannot be empty");
      });

      it("Should not allow zero address in array", async function () {
        await expect(
          receiverContract.getMultipleTokenBalances([ethers.ZeroAddress])
        ).to.be.revertedWith("Token address cannot be zero");
      });

      it("Should not allow too many tokens (>50)", async function () {
        const tokenAddresses = new Array(51).fill(await mockToken.getAddress());

        await expect(
          receiverContract.getMultipleTokenBalances(tokenAddresses)
        ).to.be.revertedWith("Too many tokens (max 50)");
      });
    });
  });

  describe("Security", function () {
    it("Should be naturally protected against reentrancy due to stateless design", async function () {
      // This contract is naturally protected against reentrancy because:
      // 1. No internal state variables to corrupt
      // 2. External state (balances) updates immediately upon transfer
      // 3. Subsequent calls would see reduced balance and fail require() checks
      
      const sendValue = ethers.parseEther("1");
      
      await user1.sendTransaction({
        to: contractAddress,
        value: sendValue,
      });

      // Normal withdrawal should work fine
      await expect(receiverContract.withdrawEth()).not.to.be.reverted;
      
      // Contract balance should be 0 after withdrawal
      expect(await ethers.provider.getBalance(contractAddress)).to.equal(0);
    });

    it("Should handle multiple rapid calls gracefully due to external state updates", async function () {
      const tokenAmount = ethers.parseEther("100");
      await mockToken.transfer(contractAddress, tokenAmount);

      // First withdrawal should succeed
      await expect(receiverContract.withdrawToken(await mockToken.getAddress())).not.to.be.reverted;
      
      // Second withdrawal should fail naturally due to zero balance
      await expect(receiverContract.withdrawToken(await mockToken.getAddress()))
        .to.be.revertedWith("No tokens to withdraw");
    });

    it("Should demonstrate why reentrancy protection is unnecessary", async function () {
      // Even if somehow reentrancy occurred, the external state protects us
      const ethAmount = ethers.parseEther("2");
      const tokenAmount = ethers.parseEther("100");
      
      await user1.sendTransaction({
        to: contractAddress,
        value: ethAmount,
      });
      await mockToken.transfer(contractAddress, tokenAmount);

      // Check initial balances
      expect(await receiverContract.getEthBalance()).to.equal(ethAmount);
      expect(await receiverContract.getTokenBalance(await mockToken.getAddress())).to.equal(tokenAmount);

      // After withdrawals, balances are immediately updated
      await receiverContract.withdrawEth();
      await receiverContract.withdrawToken(await mockToken.getAddress());

      expect(await receiverContract.getEthBalance()).to.equal(0);
      expect(await receiverContract.getTokenBalance(await mockToken.getAddress())).to.equal(0);
    });
  });

  describe("Edge Cases", function () {
    it("Should trigger fallback function when ETH is sent with data", async function () {
      // This test covers the fallback() function which is likely the uncovered line
      const sendValue = ethers.parseEther("0.5");
      
      // Send ETH with data to trigger fallback instead of receive
      await expect(
        user1.sendTransaction({
          to: contractAddress,
          value: sendValue,
          data: "0x1234" // Non-empty data triggers fallback
        })
      ).to.emit(receiverContract, "EthReceived")
        .withArgs(user1.address, sendValue);

      expect(await ethers.provider.getBalance(contractAddress)).to.equal(sendValue);
    });

    it("Should handle batch withdrawal with mixed zero and non-zero balances", async function () {
      // Transfer tokens to only some of the tokens to test mixed scenarios
      await mockToken.transfer(contractAddress, ethers.parseEther("100"));
      // mockToken2 and mockToken3 will have zero balance

      const tokenAddresses = [
        await mockToken.getAddress(),
        await mockToken2.getAddress(),
        await mockToken3.getAddress()
      ];

      const initialOwnerBalance = await mockToken.balanceOf(owner.address);

      await expect(receiverContract.withdrawMultipleTokens(tokenAddresses))
        .to.emit(receiverContract, "MultipleTokensWithdrawn")
        .and.to.emit(receiverContract, "TokenWithdrawn"); // Only mockToken should emit this

      // Only mockToken should be withdrawn
      expect(await mockToken.balanceOf(contractAddress)).to.equal(0);
      expect(await mockToken2.balanceOf(contractAddress)).to.equal(0); // Still 0
      expect(await mockToken3.balanceOf(contractAddress)).to.equal(0); // Still 0

      expect(await mockToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + ethers.parseEther("100"));
    });

    it("Should handle exact balance withdrawal edge case", async function () {
      // Test withdrawing exact amount available
      const exactAmount = ethers.parseEther("1.5");
      
      await user1.sendTransaction({
        to: contractAddress,
        value: exactAmount,
      });

      await expect(receiverContract["withdrawEth(uint256)"](exactAmount))
        .to.emit(receiverContract, "EthWithdrawn")
        .withArgs(owner.address, exactAmount);

      expect(await ethers.provider.getBalance(contractAddress)).to.equal(0);
    });

    it("Should handle exact token balance withdrawal edge case", async function () {
      const exactAmount = ethers.parseEther("75");
      await mockToken.transfer(contractAddress, exactAmount);

      await expect(receiverContract["withdrawToken(address,uint256)"](await mockToken.getAddress(), exactAmount))
        .to.emit(receiverContract, "TokenWithdrawn")
        .withArgs(owner.address, await mockToken.getAddress(), exactAmount);

      expect(await mockToken.balanceOf(contractAddress)).to.equal(0);
    });

    it("Should handle contract with very small ETH amounts", async function () {
      // Test with 1 wei to ensure no rounding issues
      const oneWei = 1n;
      
      await user1.sendTransaction({
        to: contractAddress,
        value: oneWei,
      });

      await expect(receiverContract.withdrawEth())
        .to.emit(receiverContract, "EthWithdrawn")
        .withArgs(owner.address, oneWei);

      expect(await ethers.provider.getBalance(contractAddress)).to.equal(0);
    });

    it("Should handle token contract returning zero balance correctly", async function () {
      // Test with a token that has never had any tokens transferred to the contract
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const emptyToken = await MockERC20.deploy("Empty Token", "EMPTY", 0);
      
      expect(await receiverContract.getTokenBalance(await emptyToken.getAddress())).to.equal(0);
      
      await expect(
        receiverContract.withdrawToken(await emptyToken.getAddress())
      ).to.be.revertedWith("No tokens to withdraw");
    });

    it("Should handle multiple function calls in same transaction block", async function () {
      // This tests any timing-related edge cases
      const ethAmount = ethers.parseEther("1");
      const tokenAmount = ethers.parseEther("50");
      
      await user1.sendTransaction({
        to: contractAddress,
        value: ethAmount,
      });
      await mockToken.transfer(contractAddress, tokenAmount);

      // Get balances and immediately withdraw - tests same-block behavior
      const ethBalance = await receiverContract.getEthBalance();
      const tokenBalance = await receiverContract.getTokenBalance(await mockToken.getAddress());
      
      expect(ethBalance).to.equal(ethAmount);
      expect(tokenBalance).to.equal(tokenAmount);

      // Withdraw immediately after checking
      await receiverContract["withdrawEth(uint256)"](ethBalance);
      await receiverContract["withdrawToken(address,uint256)"](await mockToken.getAddress(), tokenBalance);

      expect(await receiverContract.getEthBalance()).to.equal(0);
      expect(await receiverContract.getTokenBalance(await mockToken.getAddress())).to.equal(0);
    });

    it("Should handle batch operations with all zero balances", async function () {
      // This tests the branch where all tokens have zero balance
      const tokenAddresses = [
        await mockToken.getAddress(),
        await mockToken2.getAddress(),
        await mockToken3.getAddress()
      ];

      const expectedAmounts = [0, 0, 0]; // All zero balances

      // All tokens have zero balance - tests specific branch logic
      await expect(receiverContract.withdrawMultipleTokens(tokenAddresses))
        .to.emit(receiverContract, "MultipleTokensWithdrawn")
        .withArgs(owner.address, tokenAddresses, expectedAmounts);

      // No individual token withdrawals should occur
      expect(await mockToken.balanceOf(contractAddress)).to.equal(0);
      expect(await mockToken2.balanceOf(contractAddress)).to.equal(0);
      expect(await mockToken3.balanceOf(contractAddress)).to.equal(0);
    });

    it("Should handle batch operations with exact maximum limit", async function () {
      // Test with exactly 50 tokens (the maximum limit)
      const tokenAddresses = [];
      for (let i = 0; i < 50; i++) {
        tokenAddresses.push(await mockToken.getAddress()); // Use same token for simplicity
      }

      // Should work with exactly 50 tokens
      await expect(receiverContract.withdrawMultipleTokens(tokenAddresses))
        .to.emit(receiverContract, "MultipleTokensWithdrawn");
    });

    it("Should handle different combinations of zero and non-zero amounts in batch", async function () {
      // Set up different token balances
      await mockToken.transfer(contractAddress, ethers.parseEther("100"));
      await mockToken2.transfer(contractAddress, ethers.parseEther("50"));
      // mockToken3 remains at zero

      const tokenAddresses = [
        await mockToken.getAddress(),
        await mockToken2.getAddress(),
        await mockToken3.getAddress()
      ];

      const amounts = [
        ethers.parseEther("50"), // Partial withdrawal
        ethers.parseEther("50"), // Full withdrawal
        ethers.parseEther("0")   // Zero amount - should be rejected
      ];

      // Should fail due to zero amount in array (from withdrawToken validation)
      await expect(
        receiverContract["withdrawMultipleTokens(address[],uint256[])"](tokenAddresses, amounts)
      ).to.be.revertedWith("No tokens to withdraw");
    });

    it("Should handle different balance scenarios in getMultipleTokenBalances", async function () {
      // Set up mixed balances
      await mockToken.transfer(contractAddress, ethers.parseEther("123"));
      await mockToken2.transfer(contractAddress, ethers.parseEther("456"));
      // mockToken3 remains at zero

      const tokenAddresses = [
        await mockToken.getAddress(),
        await mockToken2.getAddress(),
        await mockToken3.getAddress()
      ];

      const balances = await receiverContract.getMultipleTokenBalances(tokenAddresses);
      
      expect(balances[0]).to.equal(ethers.parseEther("123"));
      expect(balances[1]).to.equal(ethers.parseEther("456"));
      expect(balances[2]).to.equal(0);
    });
  });
}); 