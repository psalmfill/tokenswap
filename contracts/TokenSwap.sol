// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(
        address owner,
        address spender
    ) external returns (uint256);
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}

interface IPancakeRouter02 {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;

    function WETH() external pure returns (address);
    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts);
}

contract TokenSwap {
    address pancakeRouterAddress;
    address owner;

    IPancakeRouter02 public pancakeRouter;
    event HoneypotCheckResult(address token, bool isHoneypot);

    // Event for withdrawal
    event WithdrawETH(address indexed recipient, uint256 amount);
    event WithdrawTokens(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    constructor(address _pancakeRouterAddress) {
        pancakeRouterAddress = _pancakeRouterAddress;
        pancakeRouter = IPancakeRouter02(pancakeRouterAddress);
        owner = msg.sender;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }

    // Buy BEP20 tokens using BNB
    function buyTokens(address token, uint256 minAmountOut) external payable {
        address[] memory path = new address[](2);
        path[0] = pancakeRouter.WETH(); // WBNB
        path[1] = token;

        pancakeRouter.swapExactETHForTokensSupportingFeeOnTransferTokens{
            value: msg.value
        }(
            minAmountOut,
            path,
            msg.sender, // Send tokens to user
            block.timestamp + 300 // 5 minutes
        );
    }

    // Sell BEP20 tokens for BNB
    function sellTokens(
        address token,
        uint256 tokenAmount,
        uint256 minAmountOut
    ) external {
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount); // Transfer tokens to contract
        IERC20(token).approve(pancakeRouterAddress, tokenAmount); // Approve PancakeSwap router to spend tokens

        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = pancakeRouter.WETH(); // WBNB

        pancakeRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            minAmountOut,
            path,
            msg.sender, // Send BNB to user
            block.timestamp + 300 // 5 minutes
        );
    }

    // Function to check if a token is a honeypot
    function isHoneypot(
        address token,
        uint256 buyAmount,
        uint256 minSellAmountOut
    ) external payable returns (bool) {
        address[] memory buyPath = new address[](2);
        buyPath[0] = pancakeRouter.WETH(); // WBNB
        buyPath[1] = token;

        // Try to buy tokens with the provided amount of BNB
        try
            pancakeRouter.swapExactETHForTokensSupportingFeeOnTransferTokens{
                value: msg.value
            }(
                buyAmount,
                buyPath,
                address(this), // Tokens will stay in contract
                block.timestamp + 300 // 5 minutes
            )
        {
            // Get the token balance after purchase
            uint256 tokenBalance = IERC20(token).balanceOf(address(this));
            console.log("tokenbalance", tokenBalance);
            if (tokenBalance > 0) {
                // Approve PancakeSwap to spend the tokens
                IERC20(token).approve(pancakeRouterAddress, tokenBalance);

                address[] memory sellPath = new address[](2);
                sellPath[0] = token;
                sellPath[1] = pancakeRouter.WETH(); // WBNB

                pancakeRouter
                    .swapExactTokensForETHSupportingFeeOnTransferTokens(
                        tokenBalance,
                        minSellAmountOut,
                        sellPath,
                        msg.sender, // Send BNB to the sender
                        block.timestamp + 300 // 5 minutes
                    );
                tokenBalance = IERC20(token).balanceOf(address(this));
                if (tokenBalance == 0) {
                    emit HoneypotCheckResult(token, false); // If the sell is successful, it is a honeypot
                    console.log("jjj", token);
                    return false; // If the sell is successful, it is not a honeypot
                } else {
                    emit HoneypotCheckResult(token, true); // If the sell fails, it is a honeypot
                    console.log("qqq", token);
                    return true; // If the sell fails, it is likely a honeypot
                }
            } else {
                emit HoneypotCheckResult(token, true); // If the sell fails, it is a honeypot
                console.log("zzz", token);
                return true; // If the sell fails, it is likely a honeypot
            }
        } catch {
            emit HoneypotCheckResult(token, true); // If the buy fails, it is a honeypot
            console.log("rrr", token);
            return true; // If the sell fails, it is likely a honeypot
        }
    }

    // Function to get estimated amount of tokens for BNB input
    function getEstimatedTokensForBNB(
        address token,
        uint bnbAmount
    ) external view returns (uint[] memory) {
        address[] memory path = new address[](2);
        path[0] = pancakeRouter.WETH(); // WBNB
        path[1] = token;

        return pancakeRouter.getAmountsOut(bnbAmount, path);
    }

    // Function to get estimated amount of BNB for tokens input
    function getEstimatedBNBForTokens(
        address token,
        uint tokenAmount
    ) external view returns (uint[] memory) {
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = pancakeRouter.WETH(); // WBNB

        return pancakeRouter.getAmountsOut(tokenAmount, path);
    }

    // Withdraw ETH from the contract
    function withdrawETH(address payable recipient) external onlyOwner {
        uint256 amount = address(this).balance; // Get the contract's ETH balance
        require(amount > 0, "No ETH available to withdraw");
        require(recipient != address(0), "Invalid recipient address");
        recipient.transfer(amount); // Transfer ETH to the recipient
        emit WithdrawETH(recipient, amount); // Emit the withdrawal event
    }

    // Withdraw tokens from the contract
    function withdrawTokens(
        address token,
        address recipient
    ) external onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this)); // Get the token balance
        require(amount > 0, "No tokens available to withdraw");
        require(recipient != address(0), "Invalid recipient address");

        // Transfer tokens to the recipient
        require(IERC20(token).transfer(recipient, amount), "Transfer failed");
        emit WithdrawTokens(token, recipient, amount); // Emit the withdrawal event
    }

    receive() external payable {}
}
