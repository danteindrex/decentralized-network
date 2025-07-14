const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ModelRegistry", function () {
  let modelRegistry;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const ModelRegistry = await ethers.getContractFactory("ModelRegistry");
    modelRegistry = await ModelRegistry.deploy();
    await modelRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await modelRegistry.owner()).to.equal(owner.address);
    });
  });

  describe("Model Registration", function () {
    it("Should register a model successfully", async function () {
      const modelId = "gpt-3.5-turbo";
      const modelCID = "QmModelHash123";
      const name = "GPT-3.5 Turbo";
      const description = "OpenAI GPT-3.5 Turbo model";

      await expect(modelRegistry.registerModel(modelId, modelCID, name, description))
        .to.emit(modelRegistry, "ModelRegistered")
        .withArgs(modelId, modelCID, name, owner.address);

      const model = await modelRegistry.getModel(modelId);
      expect(model.modelCID).to.equal(modelCID);
      expect(model.name).to.equal(name);
      expect(model.description).to.equal(description);
      expect(model.isActive).to.be.true;
    });

    it("Should not allow non-owner to register models", async function () {
      const modelId = "gpt-3.5-turbo";
      const modelCID = "QmModelHash123";
      const name = "GPT-3.5 Turbo";
      const description = "OpenAI GPT-3.5 Turbo model";

      await expect(
        modelRegistry.connect(addr1).registerModel(modelId, modelCID, name, description)
      ).to.be.revertedWith("Only owner can perform this action");
    });

    it("Should not allow duplicate model IDs", async function () {
      const modelId = "gpt-3.5-turbo";
      const modelCID = "QmModelHash123";
      const name = "GPT-3.5 Turbo";
      const description = "OpenAI GPT-3.5 Turbo model";

      await modelRegistry.registerModel(modelId, modelCID, name, description);

      await expect(
        modelRegistry.registerModel(modelId, "QmDifferentHash", "Different Name", "Different Description")
      ).to.be.revertedWith("Model already exists");
    });

    it("Should not allow empty model ID or CID", async function () {
      await expect(
        modelRegistry.registerModel("", "QmModelHash123", "Name", "Description")
      ).to.be.revertedWith("Model ID cannot be empty");

      await expect(
        modelRegistry.registerModel("model-id", "", "Name", "Description")
      ).to.be.revertedWith("Model CID cannot be empty");
    });
  });

  describe("Model Updates", function () {
    beforeEach(async function () {
      await modelRegistry.registerModel("gpt-3.5-turbo", "QmModelHash123", "GPT-3.5 Turbo", "Description");
    });

    it("Should update model CID successfully", async function () {
      const newCID = "QmNewModelHash456";

      await expect(modelRegistry.updateModel("gpt-3.5-turbo", newCID))
        .to.emit(modelRegistry, "ModelUpdated")
        .withArgs("gpt-3.5-turbo", newCID, owner.address);

      const model = await modelRegistry.getModel("gpt-3.5-turbo");
      expect(model.modelCID).to.equal(newCID);
    });

    it("Should not allow non-owner to update models", async function () {
      await expect(
        modelRegistry.connect(addr1).updateModel("gpt-3.5-turbo", "QmNewHash")
      ).to.be.revertedWith("Only owner can perform this action");
    });

    it("Should not allow updating non-existent models", async function () {
      await expect(
        modelRegistry.updateModel("non-existent", "QmNewHash")
      ).to.be.revertedWith("Model does not exist");
    });
  });

  describe("Model Deactivation", function () {
    beforeEach(async function () {
      await modelRegistry.registerModel("gpt-3.5-turbo", "QmModelHash123", "GPT-3.5 Turbo", "Description");
    });

    it("Should deactivate model successfully", async function () {
      await expect(modelRegistry.deactivateModel("gpt-3.5-turbo"))
        .to.emit(modelRegistry, "ModelDeactivated")
        .withArgs("gpt-3.5-turbo", owner.address);

      await expect(
        modelRegistry.getModel("gpt-3.5-turbo")
      ).to.be.revertedWith("Model does not exist or is inactive");
    });

    it("Should not allow non-owner to deactivate models", async function () {
      await expect(
        modelRegistry.connect(addr1).deactivateModel("gpt-3.5-turbo")
      ).to.be.revertedWith("Only owner can perform this action");
    });
  });

  describe("Model Listing", function () {
    beforeEach(async function () {
      await modelRegistry.registerModel("gpt-3.5-turbo", "QmHash1", "GPT-3.5 Turbo", "Description 1");
      await modelRegistry.registerModel("gpt-4", "QmHash2", "GPT-4", "Description 2");
      await modelRegistry.registerModel("claude", "QmHash3", "Claude", "Description 3");
      
      // Deactivate one model
      await modelRegistry.deactivateModel("claude");
    });

    it("Should return all model IDs", async function () {
      const allModels = await modelRegistry.getAllModels();
      expect(allModels).to.have.lengthOf(3);
      expect(allModels).to.include("gpt-3.5-turbo");
      expect(allModels).to.include("gpt-4");
      expect(allModels).to.include("claude");
    });

    it("Should return only active models", async function () {
      const activeModels = await modelRegistry.getActiveModels();
      expect(activeModels).to.have.lengthOf(2);
      expect(activeModels).to.include("gpt-3.5-turbo");
      expect(activeModels).to.include("gpt-4");
      expect(activeModels).to.not.include("claude");
    });
  });

  describe("Ownership Transfer", function () {
    it("Should transfer ownership successfully", async function () {
      await modelRegistry.transferOwnership(addr1.address);
      expect(await modelRegistry.owner()).to.equal(addr1.address);
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        modelRegistry.connect(addr1).transferOwnership(addr2.address)
      ).to.be.revertedWith("Only owner can perform this action");
    });

    it("Should not allow transfer to zero address", async function () {
      await expect(
        modelRegistry.transferOwnership("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWith("New owner cannot be zero address");
    });
  });
});