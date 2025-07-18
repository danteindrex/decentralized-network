# Decentralized Inference Streamlit Frontend

A simple web interface to test the decentralized vLLM inference network with timing measurements.

## Features

- 🧠 Submit inference jobs with custom prompts
- ⏱️ Real-time timing measurements
- 📊 Job history tracking
- 🔗 IPFS integration for prompt/response storage
- 📱 Responsive web interface
- 🔍 Live job monitoring

## Prerequisites

1. **Running Infrastructure:**
   - Ethereum node (local or remote)
   - IPFS node running on localhost:5001
   - Deployed InferenceCoordinator contract
   - At least one inference worker node

2. **Configuration:**
   - `orchestrator/config.yaml` properly configured with:
     - Contract address
     - Account address and private key
     - Ethereum node URL

## Installation

1. **Install Streamlit dependencies:**
   ```bash
   pip install -r streamlit_requirements.txt
   ```

2. **Verify configuration:**
   ```bash
   # Check if config exists
   ls orchestrator/config.yaml
   
   # Verify IPFS is running
   curl http://localhost:5001/api/v0/version
   ```

## Usage

### Option 1: Streamlit Web Interface

1. **Start the Streamlit app:**
   ```bash
   streamlit run streamlit_app.py
   ```

2. **Open your browser:**
   - The app will automatically open at `http://localhost:8501`
   - Or manually navigate to the URL shown in terminal

3. **Submit inference jobs:**
   - Enter your prompt in the text area
   - Provide a model CID (IPFS hash of the model)
   - Click "Submit Inference Job"
   - Monitor real-time progress and timing

### Option 2: Command Line Testing

For quick testing without the web interface:

```bash
python test_inference_simple.py "What is the capital of France?" QmYourModelCIDHere
```

## Interface Overview

### Main Panel
- **Prompt Input:** Text area for entering your inference prompt
- **Model CID:** Input field for the IPFS hash of the model to use
- **Submit Button:** Initiates the inference job
- **Real-time Progress:** Shows upload, submission, and completion status
- **Results Display:** Shows the inference response and timing metrics

### Sidebar
- **Configuration Status:** Displays current contract and connection info
- **Connection Status:** Shows Ethereum node connectivity

### Job History Panel
- **Recent Jobs:** Table showing previous inference jobs
- **Timing Data:** Historical performance metrics
- **Clear History:** Button to reset job history

## Timing Measurements

The app tracks several timing metrics:

1. **Upload Time:** Time to upload prompt to IPFS
2. **Submit Time:** Time to submit job to smart contract
3. **Total Time:** End-to-end time from submission to response
4. **Inference Time:** Actual model inference time (from worker logs)

## Troubleshooting

### Common Issues

1. **"Config file not found"**
   ```bash
   # Copy template and configure
   cp orchestrator/config.template.yaml orchestrator/config.yaml
   # Edit with your values
   ```

2. **"Failed to connect to IPFS"**
   ```bash
   # Start IPFS daemon
   ipfs daemon
   ```

3. **"Failed to connect to Ethereum"**
   - Check if your Ethereum node is running
   - Verify the `eth_node` URL in config.yaml
   - For local development: `npx hardhat node`

4. **"Job timed out"**
   - Ensure inference worker nodes are running
   - Check if the model CID is valid and accessible
   - Verify workers have sufficient resources

### Debug Mode

Enable debug logging by setting environment variable:
```bash
export STREAMLIT_LOGGER_LEVEL=debug
streamlit run streamlit_app.py
```

## Model CID Examples

To test the system, you need valid model CIDs. Here are some examples:

```
# Small test models (if available on your IPFS network)
QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  # Example CID
```

**Note:** Replace with actual model CIDs from your network. You can upload models using the owner tools.

## Performance Tips

1. **Model Size:** Smaller models will have faster inference times
2. **Network:** Local IPFS nodes will have faster upload/download
3. **Resources:** Ensure worker nodes have adequate GPU memory
4. **Concurrency:** Multiple workers can handle jobs in parallel

## Security Notes

- Never commit your private key to version control
- Use environment variables for sensitive configuration
- Consider using a dedicated test account for development
- Monitor gas costs for contract interactions

## Development

To modify the interface:

1. **Edit the Streamlit app:**
   ```bash
   # The main app file
   streamlit_app.py
   ```

2. **Test changes:**
   ```bash
   # Streamlit auto-reloads on file changes
   streamlit run streamlit_app.py
   ```

3. **Add new features:**
   - Job cancellation
   - Model registry integration
   - Advanced timing analytics
   - Batch job submission

## API Reference

The app interacts with:

- **InferenceCoordinator Contract:** For job submission
- **IPFS API:** For content storage/retrieval
- **Web3 Provider:** For blockchain interactions

Key functions:
- `submit_inference_job()`: Submits jobs to contract
- `monitor_job_completion()`: Watches for completion events
- `upload_to_ipfs()` / `fetch_from_ipfs()`: IPFS operations