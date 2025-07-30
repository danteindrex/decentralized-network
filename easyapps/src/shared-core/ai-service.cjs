const { uploadToIpfs, fetchFromIpfs, submitInferenceJob, monitorJobCompletion } = require('./network-service.cjs');

// Mock model CID for now - in production this would be discovered from network
const MODEL_CID = "QmetMnp9xtCrfe4U4Fmjk5CZLZj3fQy1gF7M9BV31tKiNe";

async function runInference(prompt, account, privateKey) {
    try {
        console.log('🤖 Starting AI inference for prompt:', prompt.substring(0, 50) + '...');
        
        // Check if we have valid configuration
        if (!account || !privateKey || account === '0xYourDefaultAccountAddress') {
            throw new Error('No valid account configured. Please set up your wallet to use tensor parallelism inference.');
        }
        
        // Upload prompt to IPFS
        console.log('📤 Uploading prompt to IPFS...');
        const promptCid = await uploadToIpfs(prompt, 'prompt.txt');
        if (!promptCid) {
            throw new Error('Failed to upload prompt to IPFS. Please check your IPFS connection.');
        }
        console.log('✅ Prompt uploaded to IPFS:', promptCid);

        // Submit job to blockchain
        console.log('📝 Submitting inference job to blockchain...');
        const { txHash, jobId, error } = await submitInferenceJob(
            promptCid, MODEL_CID, account, privateKey
        );

        if (error || !txHash || !jobId) {
            throw new Error(`Blockchain submission failed: ${error || 'Unknown error'}`);
        }
        console.log('✅ Job submitted. TX Hash:', txHash, 'Job ID:', jobId);

        // Monitor completion
        console.log('⏳ Monitoring job completion...');
        const { responseCid, worker, timeout } = await monitorJobCompletion(jobId, 60); // 60 seconds timeout

        if (timeout) {
            return { 
                success: false, 
                message: `Inference job timed out after 60 seconds. Job ID: ${jobId}. The job may still complete later.`,
                jobId,
                txHash
            };
        }

        if (responseCid) {
            console.log('📥 Fetching response from IPFS:', responseCid);
            const responseData = await fetchFromIpfs(responseCid);
            if (responseData) {
                console.log('✅ Inference completed successfully');
                return { 
                    success: true, 
                    response: responseData, 
                    jobId, 
                    worker,
                    txHash,
                    promptCid,
                    responseCid
                };
            } else {
                return { 
                    success: false, 
                    message: `Inference completed but failed to fetch response. Job ID: ${jobId}`,
                    jobId,
                    txHash,
                    responseCid
                };
            }
        } else {
            return { 
                success: false, 
                message: `Inference job failed or was not picked up by workers. Job ID: ${jobId}`,
                jobId,
                txHash
            };
        }
    } catch (error) {
        console.error("❌ Error running tensor parallelism inference:", error);
        throw error;
    }
}


module.exports = {
    runInference
};