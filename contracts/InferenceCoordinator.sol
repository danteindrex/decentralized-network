// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IModelRegistry {
    struct ModelInfo {
        string modelCID;
        string name;
        string description;
        uint256 timestamp;
        bool isActive;
    }
    
    function getModel(string calldata modelId) external view returns (ModelInfo memory);
}

contract InferenceCoordinator {
    uint public nextJobId = 1;
    address public modelRegistry;
    address public owner;

    // Job tracking for security
    mapping(uint => address) public jobToController;
    mapping(uint => bool) public jobCompleted;
    mapping(uint => uint256) public jobPayments;
    mapping(uint => address) public jobWorker;
    
    // Payment settings
    uint256 public minimumPayment = 0 ether;
    uint256 public platformFee = 100; // 1% in basis points (100/10000)

    event InferenceRequested(
        uint indexed jobId,
        address indexed controller,
        string promptCID,
        string modelId,
        string modelCID,
        uint256 payment
    );

    event InferenceCompleted(
        uint indexed jobId,
        address indexed worker,
        string responseCID
    );

    event PaymentReleased(
        uint indexed jobId,
        address indexed worker,
        uint256 amount,
        uint256 platformFee
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyJobController(uint jobId) {
        require(msg.sender == jobToController[jobId], "Only job controller can perform this action");
        _;
    }

    modifier jobNotCompleted(uint jobId) {
        require(!jobCompleted[jobId], "Job already completed");
        _;
    }

    modifier validJobId(uint jobId) {
        require(jobId > 0 && jobId < nextJobId, "Invalid job ID");
        _;
    }

    constructor(address _modelRegistry) {
        modelRegistry = _modelRegistry;
        owner = msg.sender;
    }

    function submitPrompt(string calldata promptCID, string calldata modelId) external payable returns (uint) {
        require(msg.value >= minimumPayment, "Payment below minimum");
        require(bytes(promptCID).length > 0, "Prompt CID cannot be empty");
        
        // Get model info from registry
        IModelRegistry.ModelInfo memory model = IModelRegistry(modelRegistry).getModel(modelId);
        require(model.isActive, "Model is not active");
        
        uint jobId = nextJobId++;
        
        // Store job details securely
        jobToController[jobId] = msg.sender;
        jobPayments[jobId] = msg.value;
        jobCompleted[jobId] = false;
        
        emit InferenceRequested(jobId, msg.sender, promptCID, modelId, model.modelCID, msg.value);
        return jobId;
    }

    function submitPromptWithCID(string calldata promptCID, string calldata modelCID) external payable returns (uint) {
        require(msg.value >= minimumPayment, "Payment below minimum");
        require(bytes(promptCID).length > 0, "Prompt CID cannot be empty");
        require(bytes(modelCID).length > 0, "Model CID cannot be empty");
        
        uint jobId = nextJobId++;
        
        // Store job details securely
        jobToController[jobId] = msg.sender;
        jobPayments[jobId] = msg.value;
        jobCompleted[jobId] = false;
        
        emit InferenceRequested(jobId, msg.sender, promptCID, "", modelCID, msg.value);
        return jobId;
    }

    function submitResponse(uint jobId, string calldata responseCID) external validJobId(jobId) jobNotCompleted(jobId) {
        require(bytes(responseCID).length > 0, "Response CID cannot be empty");
        
        // Mark job as completed and record worker
        jobCompleted[jobId] = true;
        jobWorker[jobId] = msg.sender;
        
        emit InferenceCompleted(jobId, msg.sender, responseCID);
    }

    function releasePayment(uint jobId) external validJobId(jobId) onlyJobController(jobId) {
        require(jobCompleted[jobId], "Job not completed");
        require(jobPayments[jobId] > 0, "Payment already released");
        
        address worker = jobWorker[jobId];
        require(worker != address(0), "No worker assigned");
        
        uint256 totalPayment = jobPayments[jobId];
        uint256 feeAmount = (totalPayment * platformFee) / 10000;
        uint256 workerPayment = totalPayment - feeAmount;
        
        // Reset payment to prevent double-spending
        jobPayments[jobId] = 0;
        
        // Transfer payments
        if (feeAmount > 0) {
            payable(owner).transfer(feeAmount);
        }
        payable(worker).transfer(workerPayment);
        
        emit PaymentReleased(jobId, worker, workerPayment, feeAmount);
    }

    // Emergency function to refund if job fails
    function refundJob(uint jobId) external validJobId(jobId) onlyJobController(jobId) {
        require(!jobCompleted[jobId], "Cannot refund completed job");
        require(jobPayments[jobId] > 0, "No payment to refund");
        
        uint256 refundAmount = jobPayments[jobId];
        jobPayments[jobId] = 0;
        
        payable(msg.sender).transfer(refundAmount);
    }

    function setModelRegistry(address _modelRegistry) external onlyOwner {
        require(_modelRegistry != address(0), "Model registry cannot be zero address");
        modelRegistry = _modelRegistry;
    }

    function setMinimumPayment(uint256 _minimumPayment) external onlyOwner {
        minimumPayment = _minimumPayment;
    }

    function setPlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee <= 1000, "Platform fee cannot exceed 10%"); // 1000 basis points = 10%
        platformFee = _platformFee;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }

    // View functions for job details
    function getJobDetails(uint jobId) external view validJobId(jobId) returns (
        address controller,
        bool completed,
        uint256 payment,
        address worker
    ) {
        return (
            jobToController[jobId],
            jobCompleted[jobId],
            jobPayments[jobId],
            jobWorker[jobId]
        );
    }

    // Emergency withdrawal function (only for contract owner)
    function emergencyWithdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}