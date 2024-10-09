const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const WETH9 = require("../WETH9.json");
const factoryArtifact = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerArtifact = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");
const pairArtifact = require("@uniswap/v2-periphery/build/IUniswapV2Pair.json");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { Contract, ContractFactory } = require("ethers");

describe("TokenSwap contract", function () {
  // We define a fixture to reuse the same setup in every test. We use
  // loadFixture to run this setup once, snapshot that state, and reset Hardhat
  // Network to that snapshot in every test.

  const totalSupply = ethers.parseEther("10000000000");

  async function deployTokenFixture() {
    // Get the Signers here.
    const [owner, addr1, addr2] = await ethers.getSigners();

    // 2. Initialize a new contract factory for the Uniswap V2 Factory.
    // This factory requires the ABI and bytecode from the factoryArtifact.
    const Factory = new ContractFactory(
      factoryArtifact.abi,
      factoryArtifact.bytecode,
      owner
    );

    const Router = new ContractFactory(
      routerArtifact.abi,
      routerArtifact.bytecode,
      owner
    );

    // 3. Use the initialized factory to deploy a new Factory contract.
    // The deployment is signed by the owner.
    const factory = await Factory.deploy(owner.address);

    // 4. After deployment, retrieve the address of the newly deployed Factory contract.
    const factoryAddress = await factory.getAddress();
    console.log(`Factory deployed to ${factoryAddress}`);

    // 18. Initialize a new contract factory for the WETH9 contract.
    const WETH = new ContractFactory(WETH9.abi, WETH9.bytecode, owner);
    const weth = await WETH.deploy();
    const wethAddress = await weth.getAddress();
    console.log(`WETH deployed to ${wethAddress}`);

    // 20. Deploy the Router contract using the above-initialized factory.
    const router = await Router.deploy(factoryAddress, wethAddress);
    const routerAddress = await router.getAddress();
    console.log(`Router deployed to ${routerAddress}`);

    // 5. Initialize a contract factory specifically for the Tether (USDT) token.
    const USDT = await ethers.getContractFactory("Tether", owner);

    // 6. Deploy the USDT contract using the above-initialized factory.
    const usdt = await USDT.deploy();

    // 7. Get the address of the deployed USDT contract.
    const usdtAddress = await usdt.getAddress();
    console.log(`USDT deployed to ${usdtAddress}`);

    // To deploy our contract, we just have to call ethers.deployContract and await
    // its waitForDeployment() method, which happens once its transaction has been
    // mined.
    const Token = await ethers.getContractFactory("ERC20Mock");
    const token = await Token.deploy("ERC", "ERC", totalSupply);

    const HoneypotToken = await ethers.getContractFactory("HoneypotTokenMock");
    const honeypotToken = await HoneypotToken.deploy();
    const honeypotTokenAddress = await honeypotToken.getAddress();

    const tokenAddress = await token.getAddress();
    console.log(`ERC deployed to ${tokenAddress}`);
    // await Promise.all(disburser.waitForDeployment, token.deploy({cap: 500000, reward: 4000}))

    const TokenSwap = await ethers.getContractFactory("TokenSwap");
    const tokenSwap = await TokenSwap.deploy(routerAddress);

    // 13. Utilizing the Factory contract, create a trading pair using the addresses of MAYO and ETH.
    const tx1 = await factory.createPair(tokenAddress, wethAddress);

    // 14. Wait for the transaction to be confirmed on the blockchain.
    await tx1.wait();

    const tx2 = await factory.createPair(honeypotTokenAddress, wethAddress);
    await tx2.wait();

    // 15. Retrieve the address of the created trading pair from the Factory contract.
    const pairAddress = await factory.getPair(tokenAddress, wethAddress);
    console.log(`Pair deployed to ${pairAddress}`);

    const pairAddress2 = await factory.getPair(
      honeypotTokenAddress,
      wethAddress
    );
    console.log(`Pair2 deployed to ${pairAddress2}`);

    // 16. Initialize a new contract instance for the trading pair using its address and ABI.
    const pair = new Contract(pairAddress, pairArtifact.abi, owner);

    const MaxUint256 =
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    await weth.deposit({ value: ethers.parseEther("500") }); // Deposit ETH to get WETH
    await weth.approve(routerAddress, MaxUint256);
    await honeypotToken.approve(routerAddress, MaxUint256);
    await token.approve(routerAddress, MaxUint256);

    await weth.connect(addr1).deposit({ value: ethers.parseEther("500") }); // Deposit ETH to get WETH
    await weth.connect(addr1).approve(routerAddress, MaxUint256);
    await honeypotToken.connect(addr1).approve(routerAddress, MaxUint256);
    await token.connect(addr1).approve(routerAddress, MaxUint256);

    // Get the current block timestamp
    const currentBlock = await ethers.provider.getBlock("latest");
    const deadline = currentBlock.timestamp + 60 * 20; // 20 minutes from now
    const amountAddedToLiquidity = 5000;
    const addLiquidityTx = await router.connect(owner).addLiquidityETH(
      tokenAddress,
      ethers.parseEther(`${amountAddedToLiquidity}`), // amountTokenDesired
      0, // amountTokenMin
      0, // amountETHMin
      owner, // to
      deadline, // deadline
      { value: ethers.parseEther("200") } // amountETH
    );

    await addLiquidityTx.wait();

    const addLiquidityTx2 = await router.connect(owner).addLiquidityETH(
      honeypotTokenAddress,
      ethers.parseEther(`${amountAddedToLiquidity}`), // amountTokenDesired
      0, // amountTokenMin
      0, // amountETHMin
      owner, // to
      deadline, // deadline
      { value: ethers.parseEther("200") } // amountETH
    );
    await addLiquidityTx2.wait();

    // Fixtures can return anything you consider useful for your tests
    return {
      owner,
      addr1,
      addr2,
      token,
      usdt,
      router,
      routerAddress,
      weth,
      wethAddress,
      factory,
      factoryAddress,
      router,
      routerAddress,
      tokenSwap,
      tokenAddress,
      honeypotTokenAddress,
    };
  }

  // You can nest describe calls to create subsections.
  describe("Deployment", function () {
    beforeEach(async function () {
      // Use the fixture to deploy the contracts with specified token names
      ({ owner, factory, router, wethAddress, token, usdt } = await loadFixture(
        deployTokenFixture
      ));
    });

    it("Should set the right total supply", async function () {
      // We use loadFixture to setup our environment, and then assert that
      // things went well
      const { token } = await loadFixture(deployTokenFixture);

      // `expect` receives a value and wraps it in an assertion object. These
      // objects have a lot of utility methods to assert values.

      // This test expects the owner variable stored in the contract to be
      // equal to our Signer's owner.
      expect(await token.totalSupply()).to.equal(
        ethers.parseEther("10000000000")
      );
    });

    // it("Should create pair", async function () {
    //   const tokenAddress = await token.getAddress();

    //   // 13. Utilizing the Factory contract, create a trading pair using the addresses of MAYO and ETH.
    //   const tx1 = await factory.createPair(tokenAddress, wethAddress);

    //   // 14. Wait for the transaction to be confirmed on the blockchain.
    //   await tx1.wait();

    //   // 15. Retrieve the address of the created trading pair from the Factory contract.
    //   const pairAddress = await factory.getPair(tokenAddress, wethAddress);
    //   console.log(`Pair deployed to ${pairAddress}`);

    //   // 16. Initialize a new contract instance for the trading pair using its address and ABI.
    //   const pair = new Contract(pairAddress, pairArtifact.abi, owner);

    //   // 17. Query the reserves of the trading pair to check liquidity.
    //   let reserves = await pair.getReserves();
    //   console.log(
    //     `Reserves: ${reserves[0].toString()}, ${reserves[1].toString()}`
    //   );

    //   expect(await pair.token0()).to.equal(tokenAddress);
    //   expect(await pair.token1()).to.equal(wethAddress);
    // });
  });

  describe("buyTokens", function () {
    it("Should allow a user to buy tokens", async function () {
      const { tokenSwap, token, tokenAddress, addr1, weth } = await loadFixture(
        deployTokenFixture
      );

      const tokenAmount = ethers.parseUnits("1", "ether");

      await expect(() =>
        tokenSwap
          .connect(addr1)
          .buyTokens(tokenAddress, 0, { value: tokenAmount })
      ).to.changeEtherBalance(addr1, -tokenAmount);
    });
  });

  describe("sellTokens", function () {
    it("Should allow a user to sell tokens for BNB", async function () {
      const { tokenSwap, token, tokenAddress, addr1 } = await loadFixture(
        deployTokenFixture
      );

      const tokenAmount = ethers.parseUnits("100", 18);

      // Transfer some tokens to addr1 for testing
      await token.transfer(addr1.address, tokenAmount);

      await token
        .connect(addr1)
        .approve(await tokenSwap.getAddress(), tokenAmount);

      await tokenSwap.connect(addr1).sellTokens(tokenAddress, tokenAmount, 0);
      console.log(
        "Waiter",
        await token.allowance(addr1.address, await tokenSwap.getAddress())
      );

      expect(await token.balanceOf(addr1.address)).to.equal(0);
    });
  });

  it("Should detect if a token is a honeypot", async function () {
    const { tokenSwap, honeypotTokenAddress, addr1 } = await loadFixture(
      deployTokenFixture
    );

    const buyAmount = ethers.parseUnits("1", "ether");

    // Listen for the event
    await new Promise((resolve, reject) => {
      tokenSwap
        .connect(addr1)
        .on("HoneypotCheckResult", (address, isHoneypot) => {
          try {
            expect(isHoneypot).to.be.true; // or true based on your honeypot logic
            resolve();
          } catch (error) {
            reject(error);
          }
        });

      // Call the isHoneypot function
      tokenSwap
        .connect(addr1)
        .isHoneypot(honeypotTokenAddress, buyAmount, 0, {
          value: buyAmount,
        })
        .catch(reject); // Reject on error
    });
  });
  it("Should detect if a token is not a honeypot", async function () {
    const { tokenSwap, tokenAddress, addr1 } = await loadFixture(
      deployTokenFixture
    );

    const buyAmount = ethers.parseUnits("1", "ether");

    // Listen for the event
    await new Promise((resolve, reject) => {
      tokenSwap
        .connect(addr1)
        .on("HoneypotCheckResult", (token, isHoneypot) => {
          try {
            expect(isHoneypot).to.be.false; // or true based on your honeypot logic
            resolve();
          } catch (error) {
            reject(error);
          }
        });

      // Call the isHoneypot function
      tokenSwap
        .connect(addr1)
        .isHoneypot(tokenAddress, buyAmount, 0, {
          value: buyAmount,
        })
        .catch(reject); // Reject on error
    });
  });

  describe("getEstimatedTokensForBNB", function () {
    it("Should return the estimated amount of tokens for BNB", async function () {
      const { tokenSwap, tokenAddress } = await loadFixture(deployTokenFixture);

      const bnbAmount = ethers.parseUnits("1", "ether");

      const estimates = await tokenSwap.getEstimatedTokensForBNB(
        tokenAddress,
        bnbAmount
      );

      expect(estimates.length).to.be.greaterThan(0);
    });
  });

  describe("getEstimatedBNBForTokens", function () {
    it("Should return the estimated amount of BNB for tokens", async function () {
      const { tokenSwap, tokenAddress } = await loadFixture(deployTokenFixture);
      const tokenAmount = ethers.parseUnits("100", 18);

      const estimates = await tokenSwap.getEstimatedBNBForTokens(
        tokenAddress,
        tokenAmount
      );

      expect(estimates.length).to.be.greaterThan(0);
    });
  });
  describe("Withdrawals", function () {
    it("should allow the owner to withdraw ETH from the contract", async function () {
      const { addr1, tokenSwap, owner } = await loadFixture(deployTokenFixture);

      // Send some ETH to the contract
      const ethAmount = ethers.parseEther("1");
      await owner.sendTransaction({
        to: await tokenSwap.getAddress(),
        value: ethAmount,
      });

      // Check the contract balance before withdrawal
      const contractBalanceBefore = await ethers.provider.getBalance(
        await tokenSwap.getAddress()
      );
      expect(contractBalanceBefore).to.equal(ethAmount);

      // Withdraw ETH as the owner
      await expect(await tokenSwap.withdrawETH(owner.address))
        .to.emit(tokenSwap, "WithdrawETH")
        .withArgs(owner.address, ethAmount);

      // Check the contract balance after withdrawal
      const contractBalanceAfter = await ethers.provider.getBalance(
        await tokenSwap.getAddress()
      );
      expect(contractBalanceAfter).to.equal(0);
    });

    it("should revert if non-owner tries to withdraw ETH", async function () {
      const { addr1, tokenSwap } = await loadFixture(deployTokenFixture);

      await expect(
        tokenSwap.connect(addr1).withdrawETH(addr1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow the owner to withdraw tokens from the contract", async function () {
      const { addr1, token, tokenSwap, tokenAddress, owner } =
        await loadFixture(deployTokenFixture);

      // Transfer some mock tokens to the contract
      const tokenAmount = ethers.parseEther("1000");
      await token.transfer(await tokenSwap.getAddress(), tokenAmount);

      // Check the contract token balance before withdrawal
      const contractTokenBalanceBefore = await token.balanceOf(
        await tokenSwap.getAddress()
      );
      expect(contractTokenBalanceBefore).to.equal(tokenAmount);

      // Withdraw tokens as the owner
      await expect(await tokenSwap.withdrawTokens(tokenAddress, owner.address))
        .to.emit(tokenSwap, "WithdrawTokens")
        .withArgs(tokenAddress, owner.address, tokenAmount);

      // Check the contract token balance after withdrawal
      const contractTokenBalanceAfter = await token.balanceOf(
        await tokenSwap.getAddress()
      );
      expect(contractTokenBalanceAfter).to.equal(0);
    });

    it("should revert if non-owner tries to withdraw tokens", async function () {
      const { addr1, tokenSwap, tokenAddress } = await loadFixture(
        deployTokenFixture
      );

      const tokenAmount = ethers.parseEther("1000");
      await token.transfer(await tokenSwap.getAddress(), tokenAmount);

      await expect(
        tokenSwap.connect(addr1).withdrawTokens(tokenAddress, addr1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
const delay = (delayInms) => {
  return new Promise((resolve) => setTimeout(resolve, delayInms));
};
