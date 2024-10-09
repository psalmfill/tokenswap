// contracts/HoneypotTokenMock.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract HoneypotTokenMock is ERC20 {
    constructor() ERC20("Honeypot Token", "HPT") {
        _mint(msg.sender, 1000000 * (10 ** uint256(decimals())));
    }

    // Override transfer function to simulate a honeypot
    function transfer(address recipient, uint256 amount) public override returns (bool) {
        // Only allow transfers when buying (i.e., from address zero or contract)
        if (recipient == address(0) || recipient == address(this)) {
            return super.transfer(recipient, amount);
        } else {
            revert("Token is honeypot: selling not allowed");
        }
    }
}
