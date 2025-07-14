const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InferenceCoordinator", function () {
  let inferenceCoordinator;
  let modelRegistry;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    // Deploy ModelRegistry first
    const ModelRegistry = await ethers.getContractFactory("ModelRegistry");
    modelRegistry = await ModelRegistry.deploy();
    await modelRegistry.waitForDeployment();
    
    // Deploy InferenceCoordinator with ModelRegistry address
    const InferenceCoordinator = await ethers.getContractFactory("InferenceCoordinator");
    inferenceCoordinator = await InferenceCoordinator.deploy(await modelRegistry.getAddress());
    await inferenceCoordinator.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the initial job ID to 1", async function () {
      expect(await inferenceCoordinator.nextJobId()).to.equal(1);
    });
  });

  describe("Submit Prompt", function () {
    beforeEach(async function () {
      // Register a test model first
      await modelRegistry.registerModel("test-model", "QmModelHash456", "Test Model", "A test model");
    });

    it("Should submit a prompt with model ID and emit InferenceRequested event", async function () {
      const promptCID = "QmPromptHash123";
      const modelId = "test-model";
      const modelCID = "QmModelHash456";

      await expect(inferenceCoordinator.submitPrompt(promptCID, modelId))
        .to.emit(inferenceCoordinator, "InferenceRequested")
        .withArgs(1, owner.address, promptCID, modelId, modelCID);
    });

    it("Should submit a prompt with direct CID using submitPromptWithCID", async function () {
      const promptCID = "QmPromptHash123";
      const modelCID = "QmModelHash456";

      await expect(inferenceCoordinator.submitPromptWithCID(promptCID, modelCID))
        .to.emit(inferenceCoordinator, "InferenceRequested")
        .withArgs(1, owner.address, promptCID, "", modelCID);
    });

    it("Should increment job ID after each submission", async function () {
      const promptCID1 = "QmPromptHash123";
      const promptCID2 = "QmPromptHash789";
      const modelId = "test-model";

      await inferenceCoordinator.submitPrompt(promptCID1, modelId);
      expect(await inferenceCoordinator.nextJobId()).to.equal(2);

      await inferenceCoordinator.submitPrompt(promptCID2, modelId);
      expect(await inferenceCoordinator.nextJobId()).to.equal(3);
    });

    it("Should reject submission with non-existent model ID", async function () {
      const promptCID = "QmPromptHash123";
      const nonExistentModelId = "non-existent-model";

      await expect(
        inferenceCoordinator.submitPrompt(promptCID, nonExistentModelId)
      ).to.be.revertedWith("Model does not exist or is inactive");
    });

    it("Should accept payment with the prompt submission", async function () {
      const promptCID = "QmPromptHash123";
      const modelId = "test-model";
      const paymentAmount = ethers.parseEther("0.1");

      await expect(
        inferenceCoordinator.submitPrompt(promptCID, modelId, { value: paymentAmount })
      ).to.not.be.reverted;
    });
  });

  describe("Submit Response", function () {
    it("Should submit a response and emit InferenceCompleted event", async function () {
      const jobId = 1;
      const responseCID = "QmResponseHash789";

      await expect(inferenceCoordinator.connect(addr1).submitResponse(jobId, responseCID))
        .to.emit(inferenceCoordinator, "InferenceCompleted")
        .withArgs(jobId, addr1.address, responseCID);
    });

    it("Should allow any address to submit a response", async function () {
      const jobId = 1;
      const responseCID = "QmResponseHash789";

      // Different addresses can submit responses
      await expect(inferenceCoordinator.connect(addr1).submitResponse(jobId, responseCID))
        .to.not.be.reverted;
      
      await expect(inferenceCoordinator.connect(addr2).submitResponse(jobId + 1, responseCID))
        .to.not.be.reverted;
    });
  });

  describe("Integration Test", function () {
    it("Should handle complete inference workflow", async function () {
      const promptCID = "QmPromptHash123";
      const modelId = "test-model";
      const modelCID = "QmModelHash456";
      const responseCID = "QmResponseHash789";

      // Register model first
      await modelRegistry.registerModel(modelId, modelCID, "Test Model", "A test model");

      // Submit prompt
      const submitTx = await inferenceCoordinator.connect(owner).submitPrompt(promptCID, modelId);
      await expect(submitTx)
        .to.emit(inferenceCoordinator, "InferenceRequested")
        .withArgs(1, owner.address, promptCID, modelId, modelCID);

      // Submit response from worker
      const responseTx = await inferenceCoordinator.connect(addr1).submitResponse(1, responseCID);
      await expect(responseTx)
        .to.emit(inferenceCoordinator, "InferenceCompleted")
        .withArgs(1, addr1.address, responseCID);
    });
  });
});