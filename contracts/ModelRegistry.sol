// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ModelRegistry {
    address public owner;
    
    struct ModelInfo {
        string modelCID;
        string name;
        string description;
        uint256 timestamp;
        bool isActive;
    }
    
    mapping(string => ModelInfo) public models; // modelId => ModelInfo
    string[] public modelIds;
    
    event ModelRegistered(
        string indexed modelId,
        string modelCID,
        string name,
        address indexed owner
    );
    
    event ModelUpdated(
        string indexed modelId,
        string newModelCID,
        address indexed owner
    );
    
    event ModelDeactivated(
        string indexed modelId,
        address indexed owner
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function registerModel(
        string calldata modelId,
        string calldata modelCID,
        string calldata name,
        string calldata description
    ) external onlyOwner {
        require(bytes(modelId).length > 0, "Model ID cannot be empty");
        require(bytes(modelCID).length > 0, "Model CID cannot be empty");
        require(!models[modelId].isActive, "Model already exists");
        
        models[modelId] = ModelInfo({
            modelCID: modelCID,
            name: name,
            description: description,
            timestamp: block.timestamp,
            isActive: true
        });
        
        modelIds.push(modelId);
        
        emit ModelRegistered(modelId, modelCID, name, owner);
    }
    
    function updateModel(
        string calldata modelId,
        string calldata newModelCID
    ) external onlyOwner {
        require(models[modelId].isActive, "Model does not exist");
        require(bytes(newModelCID).length > 0, "Model CID cannot be empty");
        
        models[modelId].modelCID = newModelCID;
        models[modelId].timestamp = block.timestamp;
        
        emit ModelUpdated(modelId, newModelCID, owner);
    }
    
    function deactivateModel(string calldata modelId) external onlyOwner {
        require(models[modelId].isActive, "Model does not exist");
        
        models[modelId].isActive = false;
        
        emit ModelDeactivated(modelId, owner);
    }
    
    function getModel(string calldata modelId) external view returns (ModelInfo memory) {
        require(models[modelId].isActive, "Model does not exist or is inactive");
        return models[modelId];
    }
    
    function getAllModels() external view returns (string[] memory) {
        return modelIds;
    }
    
    function getActiveModels() external view returns (string[] memory) {
        uint256 activeCount = 0;
        
        // Count active models
        for (uint256 i = 0; i < modelIds.length; i++) {
            if (models[modelIds[i]].isActive) {
                activeCount++;
            }
        }
        
        // Create array of active model IDs
        string[] memory activeModels = new string[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < modelIds.length; i++) {
            if (models[modelIds[i]].isActive) {
                activeModels[index] = modelIds[i];
                index++;
            }
        }
        
        return activeModels;
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
}