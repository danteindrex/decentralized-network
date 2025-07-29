const hre = require("hardhat");

async function main() {
    console.log("💰 Funding accounts...");
    
    const [deployer] = await hre.ethers.getSigners();
    const targetAccount = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    
    // Send 10 ETH to the target account
    const tx = await deployer.sendTransaction({
        to: targetAccount,
        value: hre.ethers.parseEther("10.0")
    });
    
    await tx.wait();
    
    const balance = await hre.ethers.provider.getBalance(targetAccount);
    console.log(`✅ Account ${targetAccount} funded with ${hre.ethers.formatEther(balance)} ETH`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });