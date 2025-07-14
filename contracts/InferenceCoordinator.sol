// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IModelRegistry {
    function getModel(string calldata modelId) external view returns (
        string memory modelCID,
        string memory name,
        string memory description,
        uint256 timestamp,
        bool isActive
    );
}

contract InferenceCoordinator {
    uint public nextJobId = 1;
    address public modelRegistry;
    address public owner;

    event InferenceRequested(
        uint indexed jobId,
        address indexed controller,
        string promptCID,
        string modelId,
        string modelCID
    );

    event InferenceCompleted(
        uint indexed jobId,
        address indexed worker,
        string responseCID
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor(address _modelRegistry) {
        modelRegistry = _modelRegistry;
        owner = msg.sender;
    }

    function submitPrompt(string calldata promptCID, string calldata modelId) external payable returns (uint) {
        // Get model CID from registry
        (string memory modelCID, , , , bool isActive) = IModelRegistry(modelRegistry).getModel(modelId);
        require(isActive, "Model is not active");
        
        uint jobId = nextJobId++;
        emit InferenceRequested(jobId, msg.sender, promptCID, modelId, modelCID);
        return jobId;
    }

    function submitPromptWithCID(string calldata promptCID, string calldata modelCID) external payable returns (uint) {
        // Direct CID submission (for backward compatibility)
        uint jobId = nextJobId++;
        emit InferenceRequested(jobId, msg.sender, promptCID, "", modelCID);
        return jobId;
    }

    function submitResponse(uint jobId, string calldata responseCID) external {
        emit InferenceCompleted(jobId, msg.sender, responseCID);
    }

    function setModelRegistry(address _modelRegistry) external onlyOwner {
        modelRegistry = _modelRegistry;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
}