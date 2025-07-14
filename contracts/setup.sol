// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

contract firstContract { // Assuming firstContract is the name, or it might be setupContract if setup.sol
    string public name;

    function get() public view returns (string memory) {
        return name;
    }
    function set(string memory _name) public {
        name= _name;
    }
}