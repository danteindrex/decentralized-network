// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NodeProfileRegistry {
    struct Profile {
        address nodeAddress;
        uint256 maxRAM;
        uint256 maxVRAM;
        uint256 maxCPUPercent;
        bool exists;
    }

    mapping(address => Profile) public profiles;

    function registerNode(
        uint256 maxRAM,
        uint256 maxVRAM,
        uint256 maxCPUPercent
    ) external {
        profiles[msg.sender] = Profile({
            nodeAddress: msg.sender,
            maxRAM: maxRAM,
            maxVRAM: maxVRAM,
            maxCPUPercent: maxCPUPercent,
            exists: true
        });
    }

    function deregisterNode() external {
        delete profiles[msg.sender];
    }
}