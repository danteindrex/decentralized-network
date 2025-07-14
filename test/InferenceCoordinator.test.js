const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InferenceCoordinator", function () {
  let inferenceCoordinator;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const InferenceCoordinator = await ethers.getContractFactory("InferenceCoordinator");
    inferenceCoordinator = await InferenceCoordinator.deploy();
    await inferenceCoordinator.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the initial job ID to 1", async function () {
      expect(await inferenceCoordinator.nextJobId()).to.equal(1);
    });
  });

  describe("Submit Prompt", function () {
    it("Should submit a prompt and emit InferenceRequested event", async function () {
      const promptCID = "QmPromptHash123";
      const modelCID = "QmModelHash456";

      await expect(inferenceCoordinator.submitPrompt(promptCID, modelCID))
        .to.emit(inferenceCoordinator, "InferenceRequested")
        .withArgs(1, owner.address, promptCID, modelCID);
    });

    it("Should increment job ID after each submission", async function () {
      const promptCID1 = "QmPromptHash123";
      const modelCID1 = "QmModelHash456";
      const promptCID2 = "QmPromptHash789";
      const modelCID2 = "QmModelHash101";

      await inferenceCoordinator.submitPrompt(promptCID1, modelCID1);
      expect(await inferenceCoordinator.nextJobId()).to.equal(2);

      await inferenceCoordinator.submitPrompt(promptCID2, modelCID2);
      expect(await inferenceCoordinator.nextJobId()).to.equal(3);
    });

    it("Should return the correct job ID", async function () {
      const promptCID = "QmPromptHash123";
      const modelCID = "QmModelHash456";

      const tx = await inferenceCoordinator.submitPrompt(promptCID, modelCID);
      const receipt = await tx.wait();
      
      // Check the returned job ID from the transaction
      expect(await inferenceCoordinator.nextJobId()).to.equal(2);
    });

    it("Should accept payment with the prompt submission", async function () {
      const promptCID = "QmPromptHash123";
      const modelCID = "QmModelHash456";
      const paymentAmount = ethers.parseEther("0.1");

      await expect(
        inferenceCoordinator.submitPrompt(promptCID, modelCID, { value: paymentAmount })
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
      const modelCID = "QmModelHash456";
      const responseCID = "QmResponseHash789";

      // Submit prompt
      const submitTx = await inferenceCoordinator.connect(owner).submitPrompt(promptCID, modelCID);
      await expect(submitTx)
        .to.emit(inferenceCoordinator, "InferenceRequested")
        .withArgs(1, owner.address, promptCID, modelCID);

      // Submit response from worker
      const responseTx = await inferenceCoordinator.connect(addr1).submitResponse(1, responseCID);
      await expect(responseTx)
        .to.emit(inferenceCoordinator, "InferenceCompleted")
        .withArgs(1, addr1.address, responseCID);
    });
  });
});