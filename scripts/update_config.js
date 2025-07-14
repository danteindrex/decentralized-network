const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function updateConfig() {
  // Get contract artifacts
  const InferenceCoordinator = await ethers.getContractFactory("InferenceCoordinator");
  const NodeProfileRegistry = await ethers.getContractFactory("NodeProfileRegistry");
  
  // Read current config
  const configPath = path.join(__dirname, '../orchestrator/config.yaml');
  let configContent = fs.readFileSync(configPath, 'utf8');
  
  // Extract ABIs
  const inferenceABI = JSON.stringify(InferenceCoordinator.interface.format('json'));
  const registryABI = JSON.stringify(NodeProfileRegistry.interface.format('json'));
  
  // For demo purposes, we'll use the InferenceCoordinator ABI in the config
  // In a real deployment, you'd replace the contract addresses with actual deployed addresses
  configContent = configContent.replace(
    /contract_abi: \|-\s*\[\s*\/\*[^*]*\*\/\s*\]/,
    `contract_abi: |-\n  ${inferenceABI}`
  );
  
  // Write updated config
  fs.writeFileSync(configPath, configContent);
  
  console.log("Config updated with contract ABIs");
  console.log("InferenceCoordinator ABI length:", inferenceABI.length);
  console.log("NodeProfileRegistry ABI length:", registryABI.length);
  
  // Also save ABIs to separate files for reference
  const abiDir = path.join(__dirname, '../orchestrator/abis');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(abiDir, 'InferenceCoordinator.json'),
    JSON.stringify(JSON.parse(inferenceABI), null, 2)
  );
  
  fs.writeFileSync(
    path.join(abiDir, 'NodeProfileRegistry.json'),
    JSON.stringify(JSON.parse(registryABI), null, 2)
  );
  
  console.log("ABIs saved to orchestrator/abis/ directory");
}

updateConfig()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });