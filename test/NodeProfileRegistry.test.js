const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NodeProfileRegistry", function () {
  let nodeProfileRegistry;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const NodeProfileRegistry = await ethers.getContractFactory("NodeProfileRegistry");
    nodeProfileRegistry = await NodeProfileRegistry.deploy();
    await nodeProfileRegistry.waitForDeployment();
  });

  describe("Node Registration", function () {
    it("Should register a node with correct profile data", async function () {
      const maxRAM = ethers.parseUnits("16", "gwei"); // 16 GB
      const maxVRAM = ethers.parseUnits("8", "gwei");  // 8 GB
      const maxCPUPercent = 80;

      await nodeProfileRegistry.connect(addr1).registerNode(maxRAM, maxVRAM, maxCPUPercent);

      const profile = await nodeProfileRegistry.profiles(addr1.address);
      expect(profile.nodeAddress).to.equal(addr1.address);
      expect(profile.maxRAM).to.equal(maxRAM);
      expect(profile.maxVRAM).to.equal(maxVRAM);
      expect(profile.maxCPUPercent).to.equal(maxCPUPercent);
      expect(profile.exists).to.be.true;
    });

    it("Should allow updating node profile", async function () {
      const initialRAM = ethers.parseUnits("8", "gwei");
      const initialVRAM = ethers.parseUnits("4", "gwei");
      const initialCPU = 70;

      const updatedRAM = ethers.parseUnits("16", "gwei");
      const updatedVRAM = ethers.parseUnits("8", "gwei");
      const updatedCPU = 90;

      // Initial registration
      await nodeProfileRegistry.connect(addr1).registerNode(initialRAM, initialVRAM, initialCPU);
      
      let profile = await nodeProfileRegistry.profiles(addr1.address);
      expect(profile.maxRAM).to.equal(initialRAM);
      expect(profile.maxCPUPercent).to.equal(initialCPU);

      // Update registration
      await nodeProfileRegistry.connect(addr1).registerNode(updatedRAM, updatedVRAM, updatedCPU);
      
      profile = await nodeProfileRegistry.profiles(addr1.address);
      expect(profile.maxRAM).to.equal(updatedRAM);
      expect(profile.maxVRAM).to.equal(updatedVRAM);
      expect(profile.maxCPUPercent).to.equal(updatedCPU);
    });

    it("Should allow multiple nodes to register", async function () {
      const maxRAM1 = ethers.parseUnits("16", "gwei");
      const maxVRAM1 = ethers.parseUnits("8", "gwei");
      const maxCPUPercent1 = 80;

      const maxRAM2 = ethers.parseUnits("32", "gwei");
      const maxVRAM2 = ethers.parseUnits("16", "gwei");
      const maxCPUPercent2 = 90;

      await nodeProfileRegistry.connect(addr1).registerNode(maxRAM1, maxVRAM1, maxCPUPercent1);
      await nodeProfileRegistry.connect(addr2).registerNode(maxRAM2, maxVRAM2, maxCPUPercent2);

      const profile1 = await nodeProfileRegistry.profiles(addr1.address);
      const profile2 = await nodeProfileRegistry.profiles(addr2.address);

      expect(profile1.nodeAddress).to.equal(addr1.address);
      expect(profile1.maxRAM).to.equal(maxRAM1);
      expect(profile1.exists).to.be.true;

      expect(profile2.nodeAddress).to.equal(addr2.address);
      expect(profile2.maxRAM).to.equal(maxRAM2);
      expect(profile2.exists).to.be.true;
    });
  });

  describe("Node Deregistration", function () {
    beforeEach(async function () {
      const maxRAM = ethers.parseUnits("16", "gwei");
      const maxVRAM = ethers.parseUnits("8", "gwei");
      const maxCPUPercent = 80;

      await nodeProfileRegistry.connect(addr1).registerNode(maxRAM, maxVRAM, maxCPUPercent);
    });

    it("Should deregister a node", async function () {
      // Verify node is registered
      let profile = await nodeProfileRegistry.profiles(addr1.address);
      expect(profile.exists).to.be.true;

      // Deregister node
      await nodeProfileRegistry.connect(addr1).deregisterNode();

      // Verify node is deregistered
      profile = await nodeProfileRegistry.profiles(addr1.address);
      expect(profile.exists).to.be.false;
      expect(profile.nodeAddress).to.equal("0x0000000000000000000000000000000000000000");
      expect(profile.maxRAM).to.equal(0);
      expect(profile.maxVRAM).to.equal(0);
      expect(profile.maxCPUPercent).to.equal(0);
    });

    it("Should only allow node owner to deregister", async function () {
      // Try to deregister from different address
      await nodeProfileRegistry.connect(addr2).deregisterNode();

      // Original node should still be registered
      const profile = await nodeProfileRegistry.profiles(addr1.address);
      expect(profile.exists).to.be.true;
    });

    it("Should allow re-registration after deregistration", async function () {
      // Deregister
      await nodeProfileRegistry.connect(addr1).deregisterNode();
      
      let profile = await nodeProfileRegistry.profiles(addr1.address);
      expect(profile.exists).to.be.false;

      // Re-register with different specs
      const newMaxRAM = ethers.parseUnits("32", "gwei");
      const newMaxVRAM = ethers.parseUnits("16", "gwei");
      const newMaxCPUPercent = 95;

      await nodeProfileRegistry.connect(addr1).registerNode(newMaxRAM, newMaxVRAM, newMaxCPUPercent);

      profile = await nodeProfileRegistry.profiles(addr1.address);
      expect(profile.exists).to.be.true;
      expect(profile.maxRAM).to.equal(newMaxRAM);
      expect(profile.maxVRAM).to.equal(newMaxVRAM);
      expect(profile.maxCPUPercent).to.equal(newMaxCPUPercent);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero values in registration", async function () {
      await nodeProfileRegistry.connect(addr1).registerNode(0, 0, 0);

      const profile = await nodeProfileRegistry.profiles(addr1.address);
      expect(profile.maxRAM).to.equal(0);
      expect(profile.maxVRAM).to.equal(0);
      expect(profile.maxCPUPercent).to.equal(0);
      expect(profile.exists).to.be.true;
    });

    it("Should handle maximum values in registration", async function () {
      const maxUint256 = ethers.MaxUint256;
      
      await nodeProfileRegistry.connect(addr1).registerNode(maxUint256, maxUint256, 100);

      const profile = await nodeProfileRegistry.profiles(addr1.address);
      expect(profile.maxRAM).to.equal(maxUint256);
      expect(profile.maxVRAM).to.equal(maxUint256);
      expect(profile.maxCPUPercent).to.equal(100);
    });
  });
});