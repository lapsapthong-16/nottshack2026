// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ValidusStaking {
    mapping(address => uint256) public credits;
    mapping(address => uint256) public stakes;

    event TopUp(address indexed user, uint256 amount);
    event Staked(address indexed user, uint256 amount);
    event Slashed(address indexed user, uint256 amount);
    event Burned(address indexed user, uint256 amount);

    function topUp() external payable {
        require(msg.value > 0, "Send tDCAI");
        credits[msg.sender] += msg.value;
        emit TopUp(msg.sender, msg.value);
    }

    function stake() external payable {
        require(msg.value > 0, "Send tDCAI");
        stakes[msg.sender] += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    function slash(address user, uint256 amount) external {
        require(stakes[user] >= amount, "Not enough stake");
        stakes[user] -= amount;
        emit Slashed(user, amount);
    }

    function slashAll(address user) external {
        uint256 amount = stakes[user];
        require(amount > 0, "Nothing to slash");
        stakes[user] = 0;
        emit Slashed(user, amount);
    }

    function burn(uint256 amount) external {
        require(credits[msg.sender] >= amount, "Not enough credits");
        credits[msg.sender] -= amount;
        emit Burned(msg.sender, amount);
    }

    function getCredits(address user) external view returns (uint256) {
        return credits[user];
    }

    function getStake(address user) external view returns (uint256) {
        return stakes[user];
    }
}
