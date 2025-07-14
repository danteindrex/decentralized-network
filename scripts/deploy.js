const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy NodeProfileRegistry
  const NodeProfileRegistry = await ethers.getContractFactory("NodeProfileRegistry");
  const nodeProfileRegistry = await NodeProfileRegistry.deploy();
  await nodeProfileRegistry.waitForDeployment();

  console.log("NodeProfileRegistry deployed to:", await nodeProfileRegistry.getAddress());

  // Deploy ModelRegistry
  const ModelRegistry = await ethers.getContractFactory("ModelRegistry");
  const modelRegistry = await ModelRegistry.deploy();
  await modelRegistry.waitForDeployment();

  console.log("ModelRegistry deployed to:", await modelRegistry.getAddress());

  // Deploy InferenceCoordinator with ModelRegistry address
  const InferenceCoordinator = await ethers.getContractFactory("InferenceCoordinator");
  const inferenceCoordinator = await InferenceCoordinator.deploy(await modelRegistry.getAddress());
  await inferenceCoordinator.waitForDeployment();

  console.log("InferenceCoordinator deployed to:", await inferenceCoordinator.getAddress());

  // Save deployment info
  const deploymentInfo = {
    network: "localhost",
    deployer: deployer.address,
    nodeProfileRegistry: await nodeProfileRegistry.getAddress(),
    modelRegistry: await modelRegistry.getAddress(),
    inferenceCoordinator: await inferenceCoordinator.getAddress()
  };

  // Save to deployment.json
  const deploymentPath = path.join(__dirname, '../deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  // Save ABIs
  const abiDir = path.join(__dirname, '../orchestrator/abis');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(abiDir, 'NodeProfileRegistry.json'),
    JSON.stringify(NodeProfileRegistry.interface.fragments.map(f => f.format('json')), null, 2)
  );

  fs.writeFileSync(
    path.join(abiDir, 'ModelRegistry.json'),
    JSON.stringify(ModelRegistry.interface.fragments.map(f => f.format('json')), null, 2)
  );

  fs.writeFileSync(
    path.join(abiDir, 'InferenceCoordinator.json'),
    JSON.stringify(InferenceCoordinator.interface.fragments.map(f => f.format('json')), null, 2)
  );

  console.log("\nDeployment Summary:");
  console.log("==================");
  console.log("NodeProfileRegistry:", await nodeProfileRegistry.getAddress());
  console.log("ModelRegistry:", await modelRegistry.getAddress());
  console.log("InferenceCoordinator:", await inferenceCoordinator.getAddress());
  console.log("Owner:", deployer.address);
  
  console.log("\n📁 Files created:");
  console.log("- deployment.json");
  console.log("- orchestrator/abis/*.json");
  
  console.log("\n🔧 Next steps:");
  console.log("1. Update orchestrator/config.yaml with contract addresses");
  console.log("2. Use owner tools to register models:");
  console.log("   npx hardhat run scripts/owner_tools.js register <modelId> <modelCID> <name> <description>");
  console.log("3. Or use the Python upload tool:");
  console.log("   cd orchestrator && python owner_upload.py --model <model_name> --model-id <id> --name <name> --description <desc>");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });