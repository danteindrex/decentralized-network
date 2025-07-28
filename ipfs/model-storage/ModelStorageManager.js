const fs = require('fs');
const path = require('path');
// const { create } = require('ipfs-http-client/src');  // Removed due to Node.js compatibility
const axios = require('axios');
const FormData = require('form-data');
const { ethers } = require('ethers');

class ModelStorageManager {
  constructor(ipfsConfig = {}, blockchainConfig = {}) {
    // IPFS client configuration (using HTTP API for compatibility)
    this.ipfsConfig = ipfsConfig.url || { host: 'localhost', port: 5001, protocol: 'http' };
    this.ipfsBaseUrl = `${this.ipfsConfig.protocol}://${this.ipfsConfig.host}:${this.ipfsConfig.port}/api/v0`;
    
    // Blockchain configuration
    this.provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl || 'http://localhost:8545');
    this.wallet = blockchainConfig.privateKey ? 
      new ethers.Wallet(blockchainConfig.privateKey, this.provider) : null;
    
    // Contract configuration
    this.contractAddress = blockchainConfig.contractAddress;
    this.contractABI = blockchainConfig.contractABI || this.getDefaultABI();
    this.contract = this.wallet && this.contractAddress ? 
      new ethers.Contract(this.contractAddress, this.contractABI, this.wallet) : null;
    
    // Storage configuration
    this.chunkSize = 1024 * 1024; // 1MB chunks
    this.tempDir = './temp';
    this.ensureTempDir();
  }

  // Internal utility methods to replace external dependencies
  _hashFile(filePath) {
    const crypto = require('crypto');
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return `0x${hashSum.digest('hex')}`;
  }

  _hashChunks(chunks) {
    return chunks.map(chunk => {
      const hash = this._hashFile(chunk.path);
      return { ...chunk, hash };
    });
  }

  _chunkFile(filePath, chunkSize, outputDir) {
    const chunks = [];
    const fd = fs.openSync(filePath, 'r');
    const stats = fs.fstatSync(fd);
    const totalSize = stats.size;
    let chunkIndex = 0;
    const buffer = Buffer.alloc(chunkSize);

    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, offset);
      const chunkSlice = buffer.slice(0, bytesRead);
      const chunkName = `chunk_${chunkIndex}`;
      const chunkPath = path.join(outputDir, chunkName);
      fs.writeFileSync(chunkPath, chunkSlice);
      chunks.push({
        name: chunkName,
        path: chunkPath,
        size: chunkSlice.length,
        index: chunkIndex
      });
      chunkIndex++;
    }

    fs.closeSync(fd);
    return chunks;
  }

  getDefaultABI() {
    return [
      "function registerChunkedModel(string modelId, string manifestCID, string name, string description, uint256 totalSize, uint256 chunkCount) external",
      "function addModelChunk(string modelId, uint256 chunkIndex, string chunkCID, string sha256Hash, uint256 size) external",
      "function getModel(string modelId) external view returns (string manifestCID, string name, string description, uint256 timestamp, uint256 totalSize, uint256 chunkCount, bool isActive)",
      "function getAllModelChunks(string modelId) external view returns (string[] cids, string[] hashes, uint256[] sizes)",
      "event ModelRegistered(string indexed modelId, string manifestCID, string name, uint256 totalSize, uint256 chunkCount, address indexed owner)",
      "event ModelChunkAdded(string indexed modelId, uint256 indexed chunkIndex, string chunkCID, string sha256Hash, uint256 size)"
    ];
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Upload data to IPFS using HTTP API
   * @param {Buffer} data - Data to upload
   * @returns {Promise<string>} IPFS CID
   */
  async uploadToIPFS(data) {
    try {
      const form = new FormData();
      form.append('file', data, { filename: 'chunk' });
      
      const response = await axios.post(`${this.ipfsBaseUrl}/add`, form, {
        headers: form.getHeaders(),
        timeout: 60000
      });
      
      return response.data.Hash;
    } catch (error) {
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  /**
   * Upload JSON to IPFS using HTTP API
   * @param {Object} jsonData - JSON data to upload
   * @returns {Promise<string>} IPFS CID
   */
  async uploadJSONToIPFS(jsonData) {
    try {
      const jsonString = JSON.stringify(jsonData, null, 2);
      const form = new FormData();
      form.append('file', Buffer.from(jsonString), { filename: 'manifest.json' });
      
      const response = await axios.post(`${this.ipfsBaseUrl}/add`, form, {
        headers: form.getHeaders(),
        timeout: 30000
      });
      
      return response.data.Hash;
    } catch (error) {
      throw new Error(`IPFS JSON upload failed: ${error.message}`);
    }
  }

  /**
   * Download data from IPFS using HTTP API
   * @param {string} cid - IPFS CID
   * @returns {Promise<Buffer>} Downloaded data
   */
  async downloadFromIPFS(cid) {
    try {
      const response = await axios.post(`${this.ipfsBaseUrl}/cat`, null, {
        params: { arg: cid },
        responseType: 'arraybuffer',
        timeout: 60000
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`IPFS download failed: ${error.message}`);
    }
  }

  /**
   * Store a model file with chunking and blockchain registration
   * @param {string} modelPath - Path to the model file/directory
   * @param {string} modelId - Unique identifier for the model
   * @param {string} name - Human-readable model name
   * @param {string} description - Model description
   * @returns {Promise<Object>} Storage result with manifest CID and transaction hash
   */
  async storeModel(modelPath, modelId, name, description) {
    try {
      console.log(`📦 Starting model storage for: ${modelId}`);
      
      // Step 1: Validate model path
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Model path does not exist: ${modelPath}`);
      }

      // Step 2: Create archive if it's a directory
      const archivePath = await this.createModelArchive(modelPath, modelId);
      const modelStats = fs.statSync(archivePath);
      
      console.log(`📊 Model size: ${(modelStats.size / 1024 / 1024).toFixed(2)} MB`);

      // Step 3: Chunk the model file
      console.log('🔪 Chunking model file...');
      const tempChunkDir = path.join(this.tempDir, `chunks_${modelId}`);
      if (!fs.existsSync(tempChunkDir)) {
        fs.mkdirSync(tempChunkDir, { recursive: true });
      }
      
      const rawChunks = this._chunkFile(archivePath, this.chunkSize, tempChunkDir);
      const hashedChunks = this._hashChunks(rawChunks);

      console.log(`📦 Created ${hashedChunks.length} chunks`);

      // Step 4: Upload chunks to IPFS
      console.log('📤 Uploading chunks to IPFS...');
      const chunkResults = [];
      
      for (let i = 0; i < hashedChunks.length; i++) {
        const chunk = hashedChunks[i];
        const chunkPath = chunk.path || path.join(tempChunkDir, chunk.name);
        const chunkData = fs.readFileSync(chunkPath);
        
        const result = await this.uploadToIPFS(chunkData);
        console.log(`✅ Uploaded chunk ${i + 1}/${hashedChunks.length} -> ${result}`);

        chunkResults.push({
          index: i,
          name: chunk.name,
          cid: result,
          size: chunk.size,
          sha256: chunk.hash,
        });

        // Cleanup local chunk file
        if (fs.existsSync(chunkPath)) {
          fs.unlinkSync(chunkPath);
        }
      }
      
      // Cleanup temp chunk directory
      if (fs.existsSync(tempChunkDir)) {
        fs.rmSync(tempChunkDir, { recursive: true, force: true });
      }

      // Step 5: Create and upload manifest
      const manifest = {
        modelId,
        name,
        description,
        originalFile: path.basename(archivePath),
        totalSize: modelStats.size,
        chunkCount: chunkResults.length,
        chunks: chunkResults,
        timestamp: new Date().toISOString(),
        version: "1.0"
      };

      const manifestResult = await this.uploadJSONToIPFS(manifest);
      console.log(`📝 Manifest uploaded to IPFS: ${manifestResult}`);

      // Step 6: Register on blockchain
      let txHash = null;
      if (this.contract) {
        console.log('⛓️ Registering model on blockchain...');
        
        // Register the model
        const registerTx = await this.contract.registerChunkedModel(
          modelId,
          manifestResult,
          name,
          description,
          modelStats.size,
          chunkResults.length
        );
        
        console.log(`📝 Model registration transaction: ${registerTx.hash}`);
        await registerTx.wait();

        // Add each chunk to the blockchain
        for (const chunk of chunkResults) {
          const chunkTx = await this.contract.addModelChunk(
            modelId,
            chunk.index,
            chunk.cid,
            chunk.sha256,
            chunk.size
          );
          
          console.log(`📝 Chunk ${chunk.index} registered: ${chunkTx.hash}`);
          await chunkTx.wait();
        }

        txHash = registerTx.hash;
        console.log('✅ Model successfully registered on blockchain');
      }

      // Step 7: Cleanup (only if we created an archive, not for original files)
      if (archivePath !== modelPath && fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
      }

      // Step 8: Save local manifest for reference
      const localManifestPath = path.join(this.tempDir, `${modelId}_manifest.json`);
      fs.writeFileSync(localManifestPath, JSON.stringify(manifest, null, 2));

      return {
        success: true,
        modelId,
        manifestCID: manifestResult,
        chunkCount: chunkResults.length,
        totalSize: modelStats.size,
        transactionHash: txHash,
        chunks: chunkResults,
        localManifest: localManifestPath
      };

    } catch (error) {
      console.error(`❌ Error storing model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve a model from IPFS and blockchain
   * @param {string} modelId - Model identifier
   * @param {string} outputPath - Where to save the reconstructed model
   * @returns {Promise<Object>} Retrieval result
   */
  async retrieveModel(modelId, outputPath) {
    try {
      console.log(`📥 Retrieving model: ${modelId}`);

      // Step 1: Get model info from blockchain
      let manifest;
      if (this.contract) {
        console.log('⛓️ Fetching model info from blockchain...');
        const modelInfo = await this.contract.getModel(modelId);
        
        // Download manifest from IPFS
        const manifestData = await this.downloadFromIPFS(modelInfo.manifestCID);
        manifest = JSON.parse(manifestData.toString());
        
        console.log(`📋 Model: ${manifest.name} (${manifest.chunkCount} chunks)`);
      } else {
        // Fallback: try to load from local manifest
        const localManifestPath = path.join(this.tempDir, `${modelId}_manifest.json`);
        if (!fs.existsSync(localManifestPath)) {
          throw new Error(`No blockchain connection and no local manifest found for ${modelId}`);
        }
        manifest = JSON.parse(fs.readFileSync(localManifestPath, 'utf8'));
      }

      // Step 2: Download and verify chunks
      console.log('📥 Downloading chunks from IPFS...');
      const tempChunks = [];
      
      for (let i = 0; i < manifest.chunks.length; i++) {
        const chunk = manifest.chunks[i];
        console.log(`📥 Downloading chunk ${i + 1}/${manifest.chunks.length}...`);
        
        const chunkData = await this.downloadFromIPFS(chunk.cid);
        const chunkPath = path.join(this.tempDir, `${modelId}_chunk_${i}`);
        fs.writeFileSync(chunkPath, chunkData);
        
        // Verify chunk integrity
        const downloadedHash = this._hashFile(chunkPath);
        if (downloadedHash !== chunk.sha256) {
          throw new Error(`Chunk ${i} integrity check failed`);
        }
        
        tempChunks.push(chunkPath);
        console.log(`✅ Chunk ${i + 1} verified`);
      }

      // Step 3: Reassemble the model
      console.log('⚙️ Reassembling model...');
      const outputStream = fs.createWriteStream(outputPath);
      
      for (const chunkPath of tempChunks) {
        const chunkData = fs.readFileSync(chunkPath);
        outputStream.write(chunkData);
        fs.unlinkSync(chunkPath); // Cleanup temp chunk
      }
      outputStream.end();

      console.log(`✅ Model retrieved and saved to: ${outputPath}`);

      return {
        success: true,
        modelId,
        outputPath,
        manifest,
        totalSize: manifest.totalSize,
        chunkCount: manifest.chunkCount
      };

    } catch (error) {
      console.error(`❌ Error retrieving model: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all models from blockchain
   * @returns {Promise<Array>} List of model information
   */
  async listModels() {
    if (!this.contract) {
      throw new Error('Blockchain connection required to list models');
    }

    try {
      console.log('📋 Fetching model list from blockchain...');
      const modelIds = await this.contract.getActiveModels();
      const models = [];

      for (const modelId of modelIds) {
        const modelInfo = await this.contract.getModel(modelId);
        models.push({
          modelId,
          manifestCID: modelInfo.manifestCID,
          name: modelInfo.name,
          description: modelInfo.description,
          totalSize: modelInfo.totalSize.toString(),
          chunkCount: modelInfo.chunkCount.toString(),
          timestamp: new Date(Number(modelInfo.timestamp) * 1000).toISOString()
        });
      }

      return models;
    } catch (error) {
      console.error(`❌ Error listing models: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create an archive from a model directory
   * @param {string} modelPath - Path to model file or directory
   * @param {string} modelId - Model identifier
   * @returns {Promise<string>} Path to created archive
   */
  async createModelArchive(modelPath, modelId) {
    const stats = fs.statSync(modelPath);
    
    if (stats.isFile()) {
      // For single files, especially large ones, just return the original path
      // No need to copy or create an archive for single files
      console.log(`📁 Using original file: ${modelPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return modelPath;
    }

    // Create archive from directory only if it's actually a directory
    const archiver = require('archiver');
    const archivePath = path.join(this.tempDir, `${modelId}.tar.gz`);
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('tar', { 
        gzip: true,
        gzipOptions: {
          level: 1, // Fastest compression for large files
          chunkSize: 1024 * 1024 // 1MB chunks
        }
      });

      output.on('close', () => {
        console.log(`📦 Archive created: ${archive.pointer()} bytes`);
        resolve(archivePath);
      });

      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(modelPath, false);
      archive.finalize();
    });
  }

  /**
   * Verify model integrity
   * @param {string} modelId - Model identifier
   * @returns {Promise<Object>} Verification result
   */
  async verifyModel(modelId) {
    try {
      console.log(`🔍 Verifying model integrity: ${modelId}`);

      if (!this.contract) {
        throw new Error('Blockchain connection required for verification');
      }

      // Get chunk information from blockchain
      const chunkInfo = await this.contract.getAllModelChunks(modelId);
      const { cids, hashes, sizes } = chunkInfo;

      const verificationResults = [];
      let allValid = true;

      for (let i = 0; i < cids.length; i++) {
        console.log(`🔍 Verifying chunk ${i + 1}/${cids.length}...`);
        
        try {
          // Download chunk from IPFS
          const chunkData = await this.downloadFromIPFS(cids[i]);
          const chunkPath = path.join(this.tempDir, `verify_chunk_${i}`);
          fs.writeFileSync(chunkPath, chunkData);

          // Verify hash
          const actualHash = this._hashFile(chunkPath);
          const expectedHash = hashes[i];
          const isValid = actualHash === expectedHash;

          verificationResults.push({
            chunkIndex: i,
            cid: cids[i],
            expectedHash,
            actualHash,
            expectedSize: sizes[i].toString(),
            actualSize: fs.statSync(chunkPath).size,
            isValid
          });

          if (!isValid) {
            allValid = false;
            console.log(`❌ Chunk ${i} verification failed`);
          } else {
            console.log(`✅ Chunk ${i} verified`);
          }

          // Cleanup
          fs.unlinkSync(chunkPath);

        } catch (error) {
          console.log(`❌ Error verifying chunk ${i}: ${error.message}`);
          verificationResults.push({
            chunkIndex: i,
            cid: cids[i],
            error: error.message,
            isValid: false
          });
          allValid = false;
        }
      }

      // Update blockchain verification status
      await this.contract.verifyModelIntegrity(modelId);

      return {
        modelId,
        isValid: allValid,
        chunkResults: verificationResults,
        totalChunks: cids.length,
        validChunks: verificationResults.filter(r => r.isValid).length
      };

    } catch (error) {
      console.error(`❌ Error verifying model: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { ModelStorageManager };
