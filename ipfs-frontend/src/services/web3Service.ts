import Web3 from 'web3';

export interface Config {
  ethNodeUrl: string;
  defaultAccount: string;
  privateKey: string;
  contractAddress: string;
  modelRegistryAddress?: string;
  ipfsHost: string;
  ipfsPort: number;
}

export interface InferenceJob {
  jobId: number;
  prompt: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
  duration?: number;
  worker?: string;
  response?: string;
  txHash?: string;
}

// Simplified contract ABI for inference coordinator
const CONTRACT_ABI = [
  {
    inputs: [
      { name: "promptCID", type: "string" },
      { name: "modelCID", type: "string" }
    ],
    name: "submitPromptWithCID",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "responseCID", type: "string" }
    ],
    name: "submitResponse",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "jobId", type: "uint256" }],
    name: "releasePayment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "controller", type: "address" },
      { name: "promptCID", type: "string" },
      { name: "modelId", type: "string" },
      { name: "modelCID", type: "string" },
      { name: "payment", type: "uint256" }
    ],
    name: "InferenceRequested",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "worker", type: "address" },
      { name: "responseCID", type: "string" }
    ],
    name: "InferenceCompleted",
    type: "event"
  }
];

export class Web3Service {
  private web3: Web3;
  private contract: any;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.ethNodeUrl));
    this.contract = new this.web3.eth.Contract(
      CONTRACT_ABI,
      config.contractAddress
    );
  }

  async getBlockNumber(): Promise<number> {
    return await this.web3.eth.getBlockNumber();
  }

  async getBalance(address?: string): Promise<string> {
    const account = address || this.config.defaultAccount;
    const balance = await this.web3.eth.getBalance(account);
    return this.web3.utils.fromWei(balance, 'ether');
  }

  async submitInferenceJob(promptCID: string, modelCID: string): Promise<{ txHash: string; jobId: number }> {
    const account = this.web3.eth.accounts.privateKeyToAccount(this.config.privateKey);
    
    const tx = this.contract.methods.submitPromptWithCID(promptCID, modelCID);
    const gas = await tx.estimateGas({ from: this.config.defaultAccount });
    const gasPrice = await this.web3.eth.getGasPrice();
    
    const txData = {
      from: this.config.defaultAccount,
      gas: gas.toString(),
      gasPrice: gasPrice.toString(),
      value: '0', // No payment required for basic jobs
      data: tx.encodeABI(),
      to: this.config.contractAddress
    };

    const signedTx = await account.signTransaction(txData);
    const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction!);
    
    // Extract job ID from logs
    let jobId = 0;
    if (receipt.logs && receipt.logs.length > 0) {
      try {
        const decodedLog = this.web3.eth.abi.decodeLog(
          [
            { indexed: true, name: "jobId", type: "uint256" },
            { indexed: true, name: "controller", type: "address" },
            { name: "promptCID", type: "string" },
            { name: "modelId", type: "string" },
            { name: "modelCID", type: "string" },
            { name: "payment", type: "uint256" }
          ],
          receipt.logs[0].data,
          receipt.logs[0].topics
        );
        jobId = parseInt(decodedLog.jobId as string);
      } catch (error) {
        console.warn('Could not decode job ID from logs:', error);
      }
    }

    return {
      txHash: receipt.transactionHash as string,
      jobId
    };
  }

  async monitorJobCompletion(jobId: number, timeout: number = 300000): Promise<{ responseCID?: string; worker?: string }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkCompletion = async () => {
        if (Date.now() - startTime > timeout) {
          resolve({});
          return;
        }

        try {
          // In a real implementation, you would listen for events
          // For now, we'll simulate completion after a delay
          setTimeout(() => {
            resolve({
              responseCID: `QmMock${jobId}ResponseCID`,
              worker: '0x1234...abcd'
            });
          }, 10000); // Simulate 10 second processing
          
        } catch (error) {
          console.error('Error monitoring job:', error);
          setTimeout(checkCompletion, 2000);
        }
      };

      checkCompletion();
    });
  }

  async releasePayment(jobId: number): Promise<string> {
    const account = this.web3.eth.accounts.privateKeyToAccount(this.config.privateKey);
    
    const tx = this.contract.methods.releasePayment(jobId);
    const gas = await tx.estimateGas({ from: this.config.defaultAccount });
    const gasPrice = await this.web3.eth.getGasPrice();
    
    const txData = {
      from: this.config.defaultAccount,
      gas: gas.toString(),
      gasPrice: gasPrice.toString(),
      data: tx.encodeABI(),
      to: this.config.contractAddress
    };

    const signedTx = await account.signTransaction(txData);
    const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction!);
    
    return receipt.transactionHash as string;
  }
}
