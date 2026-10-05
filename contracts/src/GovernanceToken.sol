// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract GovernanceToken is ERC20, ERC20Permit, ERC20Votes, Ownable {
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    event TokensDistributed(address indexed recipient, uint256 amount);

    constructor(address initialOwner)
        ERC20("Simple DAO Token", "SDT")
        ERC20Permit("Simple DAO Token")
        Ownable(initialOwner)
    {
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    function distribute(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount must be greater than zero");

        _mint(recipient, amount);
        emit TokensDistributed(recipient, amount);
    }

    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, amount);
        if (to != address(0) && delegates(to) == address(0)) {
            _delegate(to, to);
        }
    }

    function nonces(address account)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(account);
    }
}