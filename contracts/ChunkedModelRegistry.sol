// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ChunkedModelRegistry {
    address public owner;
    
    struct ChunkInfo {
        string cid;
        string sha256Hash;
        uint256 size;
        uint256 index;
    }
    
    struct ModelInfo {
        string manifestCID;      // IPFS CID of the manifest file
        string name;
        string description;
        uint256 timestamp;
        uint256 totalSize;
        uint256 chunkCount;
        bool isActive;
        mapping(uint256 => ChunkInfo) chunks; // chunk index => ChunkInfo
    }
    
    mapping(string => ModelInfo) public models; // modelId => ModelInfo
    string[] public modelIds;
    
    event ModelRegistered(
        string indexed modelId,
        string manifestCID,
        string name,
        uint256 totalSize,
        uint256 chunkCount,
        address indexed owner
    );
    
    event ModelChunkAdded(
        string indexed modelId,
        uint256 indexed chunkIndex,
        string chunkCID,
        string sha256Hash,
        uint256 size
    );
    
    event ModelUpdated(
        string indexed modelId,
        string newManifestCID,
        address indexed owner
    );
    
    event ModelDeactivated(
        string indexed modelId,
        address indexed owner
    );
    
    event ModelVerified(
        string indexed modelId,
        bool isValid,
        address indexed verifier
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function registerChunkedModel(
        string calldata modelId,
        string calldata manifestCID,
        string calldata name,
        string calldata description,
        uint256 totalSize,
        uint256 chunkCount
    ) external onlyOwner {
        require(bytes(modelId).length > 0, "Model ID cannot be empty");
        require(bytes(manifestCID).length > 0, "Manifest CID cannot be empty");
        require(!models[modelId].isActive, "Model already exists");
        require(chunkCount > 0, "Chunk count must be greater than 0");
        
        ModelInfo storage model = models[modelId];
        model.manifestCID = manifestCID;
        model.name = name;
        model.description = description;
        model.timestamp = block.timestamp;
        model.totalSize = totalSize;
        model.chunkCount = chunkCount;
        model.isActive = true;
        
        modelIds.push(modelId);
        
        emit ModelRegistered(modelId, manifestCID, name, totalSize, chunkCount, owner);
    }
    
    function addModelChunk(
        string calldata modelId,
        uint256 chunkIndex,
        string calldata chunkCID,
        string calldata sha256Hash,
        uint256 size
    ) external onlyOwner {
        require(models[modelId].isActive, "Model does not exist");
        require(chunkIndex < models[modelId].chunkCount, "Invalid chunk index");
        require(bytes(chunkCID).length > 0, "Chunk CID cannot be empty");
        require(bytes(sha256Hash).length > 0, "Hash cannot be empty");
        
        ModelInfo storage model = models[modelId];
        model.chunks[chunkIndex] = ChunkInfo({
            cid: chunkCID,
            sha256Hash: sha256Hash,
            size: size,
            index: chunkIndex
        });
        
        emit ModelChunkAdded(modelId, chunkIndex, chunkCID, sha256Hash, size);
    }
    
    function updateModel(
        string calldata modelId,
        string calldata newManifestCID
    ) external onlyOwner {
        require(models[modelId].isActive, "Model does not exist");
        require(bytes(newManifestCID).length > 0, "Manifest CID cannot be empty");
        
        models[modelId].manifestCID = newManifestCID;
        models[modelId].timestamp = block.timestamp;
        
        emit ModelUpdated(modelId, newManifestCID, owner);
    }
    
    function deactivateModel(string calldata modelId) external onlyOwner {
        require(models[modelId].isActive, "Model does not exist");
        
        models[modelId].isActive = false;
        
        emit ModelDeactivated(modelId, owner);
    }
    
    function getModel(string calldata modelId) external view returns (
        string memory manifestCID,
        string memory name,
        string memory description,
        uint256 timestamp,
        uint256 totalSize,
        uint256 chunkCount,
        bool isActive
    ) {
        require(models[modelId].isActive, "Model does not exist or is inactive");
        ModelInfo storage model = models[modelId];
        
        return (
            model.manifestCID,
            model.name,
            model.description,
            model.timestamp,
            model.totalSize,
            model.chunkCount,
            model.isActive
        );
    }
    
    function getModelChunk(string calldata modelId, uint256 chunkIndex) external view returns (
        string memory cid,
        string memory sha256Hash,
        uint256 size,
        uint256 index
    ) {
        require(models[modelId].isActive, "Model does not exist or is inactive");
        require(chunkIndex < models[modelId].chunkCount, "Invalid chunk index");
        
        ChunkInfo storage chunk = models[modelId].chunks[chunkIndex];
        return (chunk.cid, chunk.sha256Hash, chunk.size, chunk.index);
    }
    
    function getAllModelChunks(string calldata modelId) external view returns (
        string[] memory cids,
        string[] memory hashes,
        uint256[] memory sizes
    ) {
        require(models[modelId].isActive, "Model does not exist or is inactive");
        
        uint256 chunkCount = models[modelId].chunkCount;
        cids = new string[](chunkCount);
        hashes = new string[](chunkCount);
        sizes = new uint256[](chunkCount);
        
        for (uint256 i = 0; i < chunkCount; i++) {
            ChunkInfo storage chunk = models[modelId].chunks[i];
            cids[i] = chunk.cid;
            hashes[i] = chunk.sha256Hash;
            sizes[i] = chunk.size;
        }
        
        return (cids, hashes, sizes);
    }
    
    function verifyModelIntegrity(string calldata modelId) external returns (bool) {
        require(models[modelId].isActive, "Model does not exist or is inactive");
        
        // This would typically involve downloading chunks and verifying hashes
        // For now, we'll emit an event and return true
        // In a real implementation, this could be done by oracles or off-chain workers
        
        emit ModelVerified(modelId, true, msg.sender);
        return true;
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