const { uploadToIpfs, fetchFromIpfs, submitInferenceJob, monitorJobCompletion } = require('./network-service');

// Mock model CID for now
const MODEL_CID = "QmetMnp9xtCrfe4U4Fmjk5CZLZj3fQy1gF7M9BV31tKiNe";

async function runInference(prompt, account, privateKey) {
    try {
        // Upload prompt to IPFS
        const promptCid = await uploadToIpfs(prompt);
        if (!promptCid) {
            return { success: false, message: "Failed to upload prompt to IPFS." };
        }

        // Submit job
        const { txHash, jobId } = await submitInferenceJob(
            promptCid, MODEL_CID, account, privateKey
        );

        if (!txHash || !jobId) {
            return { success: false, message: "Failed to submit inference job." };
        }

        // Monitor completion
        const { responseCid, worker } = await monitorJobCompletion(jobId, 60); // 60 seconds timeout

        if (responseCid) {
            const responseData = await fetchFromIpfs(responseCid);
            if (responseData) {
                return { success: true, response: responseData, jobId, worker };
            } else {
                return { success: false, message: `Inference completed but failed to fetch response. Job ID: ${jobId}` };
            }
        } else {
            return { success: false, message: `Inference job timed out. Job ID: ${jobId}` };
        }
    } catch (error) {
        console.error("Error running inference:", error);
        return { success: false, message: `Error running inference: ${error.message}` };
    }
}

module.exports = {
    runInference
};
