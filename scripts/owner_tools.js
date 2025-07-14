const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

class OwnerTools {
    constructor() {
        this.modelRegistry = null;
        this.inferenceCoordinator = null;
        this.owner = null;
    }

    async initialize() {
        [this.owner] = await ethers.getSigners();
        
        // Get deployed contract addresses (you'll need to update these after deployment)
        const deploymentPath = path.join(__dirname, '../deployment.json');
        if (fs.existsSync(deploymentPath)) {
            const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
            
            this.modelRegistry = await ethers.getContractAt("ModelRegistry", deployment.modelRegistry);
            this.inferenceCoordinator = await ethers.getContractAt("InferenceCoordinator", deployment.inferenceCoordinator);
        } else {
            console.log("Deployment file not found. Please deploy contracts first.");
            return false;
        }
        
        console.log("Owner tools initialized for:", this.owner.address);
        return true;
    }

    async registerModel(modelId, modelCID, name, description) {
        try {
            console.log(`Registering model: ${modelId}`);
            console.log(`CID: ${modelCID}`);
            console.log(`Name: ${name}`);
            
            const tx = await this.modelRegistry.registerModel(modelId, modelCID, name, description);
            await tx.wait();
            
            console.log(`✓ Model registered successfully!`);
            console.log(`Transaction hash: ${tx.hash}`);
            return tx.hash;
        } catch (error) {
            console.error(`✗ Failed to register model: ${error.message}`);
            return null;
        }
    }

    async updateModel(modelId, newModelCID) {
        try {
            console.log(`Updating model: ${modelId}`);
            console.log(`New CID: ${newModelCID}`);
            
            const tx = await this.modelRegistry.updateModel(modelId, newModelCID);
            await tx.wait();
            
            console.log(`✓ Model updated successfully!`);
            console.log(`Transaction hash: ${tx.hash}`);
            return tx.hash;
        } catch (error) {
            console.error(`✗ Failed to update model: ${error.message}`);
            return null;
        }
    }

    async deactivateModel(modelId) {
        try {
            console.log(`Deactivating model: ${modelId}`);
            
            const tx = await this.modelRegistry.deactivateModel(modelId);
            await tx.wait();
            
            console.log(`✓ Model deactivated successfully!`);
            console.log(`Transaction hash: ${tx.hash}`);
            return tx.hash;
        } catch (error) {
            console.error(`✗ Failed to deactivate model: ${error.message}`);
            return null;
        }
    }

    async listModels() {
        try {
            const activeModels = await this.modelRegistry.getActiveModels();
            
            console.log("\n📋 Active Models:");
            console.log("=" * 50);
            
            for (const modelId of activeModels) {
                const model = await this.modelRegistry.getModel(modelId);
                console.log(`\nModel ID: ${modelId}`);
                console.log(`Name: ${model.name}`);
                console.log(`Description: ${model.description}`);
                console.log(`CID: ${model.modelCID}`);
                console.log(`Registered: ${new Date(model.timestamp * 1000).toLocaleString()}`);
                console.log("-".repeat(30));
            }
            
            return activeModels;
        } catch (error) {
            console.error(`✗ Failed to list models: ${error.message}`);
            return [];
        }
    }

    async getModel(modelId) {
        try {
            const model = await this.modelRegistry.getModel(modelId);
            
            console.log(`\n📄 Model Details: ${modelId}`);
            console.log("=" * 30);
            console.log(`Name: ${model.name}`);
            console.log(`Description: ${model.description}`);
            console.log(`CID: ${model.modelCID}`);
            console.log(`Registered: ${new Date(model.timestamp * 1000).toLocaleString()}`);
            console.log(`Active: ${model.isActive}`);
            
            return model;
        } catch (error) {
            console.error(`✗ Failed to get model: ${error.message}`);
            return null;
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const tools = new OwnerTools();
    const initialized = await tools.initialize();
    
    if (!initialized) {
        process.exit(1);
    }
    
    switch (command) {
        case 'register':
            if (args.length < 5) {
                console.log("Usage: register <modelId> <modelCID> <name> <description>");
                process.exit(1);
            }
            await tools.registerModel(args[1], args[2], args[3], args[4]);
            break;
            
        case 'update':
            if (args.length < 3) {
                console.log("Usage: update <modelId> <newModelCID>");
                process.exit(1);
            }
            await tools.updateModel(args[1], args[2]);
            break;
            
        case 'deactivate':
            if (args.length < 2) {
                console.log("Usage: deactivate <modelId>");
                process.exit(1);
            }
            await tools.deactivateModel(args[1]);
            break;
            
        case 'list':
            await tools.listModels();
            break;
            
        case 'get':
            if (args.length < 2) {
                console.log("Usage: get <modelId>");
                process.exit(1);
            }
            await tools.getModel(args[1]);
            break;
            
        default:
            console.log("Available commands:");
            console.log("  register <modelId> <modelCID> <name> <description>");
            console.log("  update <modelId> <newModelCID>");
            console.log("  deactivate <modelId>");
            console.log("  list");
            console.log("  get <modelId>");
            break;
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { OwnerTools };