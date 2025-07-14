const { OwnerTools } = require('./scripts/owner_tools.js');

async function testOwnerTools() {
    console.log("🧪 Testing Owner Tools...");
    
    const tools = new OwnerTools();
    const initialized = await tools.initialize();
    
    if (!initialized) {
        console.log("❌ Failed to initialize owner tools");
        return;
    }
    
    // Test registering a model
    console.log("\n1. Registering a test model...");
    await tools.registerModel(
        "test-model-1", 
        "QmTestModelCID123", 
        "Test Model 1", 
        "A test model for demonstration"
    );
    
    // Test listing models
    console.log("\n2. Listing all models...");
    await tools.listModels();
    
    // Test getting a specific model
    console.log("\n3. Getting model details...");
    await tools.getModel("test-model-1");
    
    // Test registering another model
    console.log("\n4. Registering another model...");
    await tools.registerModel(
        "gpt2-small", 
        "QmGPT2SmallCID456", 
        "GPT-2 Small", 
        "OpenAI GPT-2 small model"
    );
    
    // Test updating a model
    console.log("\n5. Updating model CID...");
    await tools.updateModel("test-model-1", "QmUpdatedModelCID789");
    
    // Test final listing
    console.log("\n6. Final model listing...");
    await tools.listModels();
    
    console.log("\n✅ Owner tools test completed!");
}

testOwnerTools()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });