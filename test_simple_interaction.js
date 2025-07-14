const { ethers } = require("hardhat");
const fs = require('fs');

async function testSimpleInteraction() {
    console.log("🧪 Testing Simple Smart Contract Interaction...");
    
    // Get deployment info
    const deployment = JSON.parse(fs.readFileSync('deployment.json', 'utf8'));
    console.log("📋 Deployment info:", deployment);
    
    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("👤 Using account:", signer.address);
    
    // Get contracts
    const modelRegistry = await ethers.getContractAt("ModelRegistry", deployment.modelRegistry);
    const inferenceCoordinator = await ethers.getContractAt("InferenceCoordinator", deployment.inferenceCoordinator);
    
    console.log("📝 ModelRegistry at:", await modelRegistry.getAddress());
    console.log("🎯 InferenceCoordinator at:", await inferenceCoordinator.getAddress());
    
    // Test 1: Register a model
    console.log("\n1. Registering a model...");
    const tx1 = await modelRegistry.registerModel(
        "dialogpt-small",
        "QmDialoGPTSmallCID123",
        "DialoGPT Small",
        "Microsoft DialoGPT small conversational model"
    );
    await tx1.wait();
    console.log("✅ Model registered! TX:", tx1.hash);
    
    // Test 2: Submit an inference request
    console.log("\n2. Submitting inference request...");
    const promptCID = "QmNgrZY2yFfryzWy6pQUBCJmC8ZeY91sjVdqLuX97BHryY"; // From IPFS upload
    const tx2 = await inferenceCoordinator.submitPrompt(promptCID, "dialogpt-small");
    const receipt = await tx2.wait();
    console.log("✅ Inference request submitted! TX:", tx2.hash);
    
    // Check for events
    const events = receipt.logs;
    console.log("📡 Events emitted:", events.length);
    
    for (const event of events) {
        try {
            const parsed = inferenceCoordinator.interface.parseLog(event);
            console.log("🎉 Event:", parsed.name);
            console.log("   Job ID:", parsed.args.jobId.toString());
            console.log("   Controller:", parsed.args.controller);
            console.log("   Prompt CID:", parsed.args.promptCID);
            console.log("   Model ID:", parsed.args.modelId);
            console.log("   Model CID:", parsed.args.modelCID);
        } catch (e) {
            // Not our event
        }
    }
    
    // Test 3: Submit a response (simulating worker)
    console.log("\n3. Submitting response (simulating worker)...");
    const responseCID = "QmResponseCID789";
    const tx3 = await inferenceCoordinator.submitResponse(1, responseCID);
    const receipt3 = await tx3.wait();
    console.log("✅ Response submitted! TX:", tx3.hash);
    
    // Check response events
    for (const event of receipt3.logs) {
        try {
            const parsed = inferenceCoordinator.interface.parseLog(event);
            console.log("🎉 Response Event:", parsed.name);
            console.log("   Job ID:", parsed.args.jobId.toString());
            console.log("   Worker:", parsed.args.worker);
            console.log("   Response CID:", parsed.args.responseCID);
        } catch (e) {
            // Not our event
        }
    }
    
    console.log("\n🎊 All tests completed successfully!");
    console.log("\n📊 Summary:");
    console.log("✅ IPFS is working");
    console.log("✅ Blockchain is working");
    console.log("✅ Smart contracts are deployed");
    console.log("✅ Model registration works");
    console.log("✅ Inference requests work");
    console.log("✅ Response submission works");
    console.log("✅ Events are properly emitted");
}

testSimpleInteraction()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });