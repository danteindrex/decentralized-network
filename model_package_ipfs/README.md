# DeepSeek R1 1.5B Model Usage

## Quick Start
```python
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

# Load model and tokenizer
tokenizer = AutoTokenizer.from_pretrained("./")
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    "./",
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True
)

# Generate text
prompt = "Hello, how can I help you today?"
inputs = tokenizer.encode(prompt, return_tensors="pt")

with torch.no_grad():
    outputs = model.generate(
        inputs,
        max_length=inputs.shape[1] + 100,
        temperature=0.7,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id
    )

response = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(response)
```

## Model Information
- **Name**: DeepSeek R1 1.5B
- **Parameters**: 1.5 billion
- **Type**: Causal Language Model
- **Framework**: Transformers (PyTorch)
- **License**: MIT

## Capabilities
- Conversational AI
- Text generation
- Question answering
- Creative writing
- Code assistance

## Requirements
- Python 3.8+
- PyTorch
- Transformers
- At least 4GB RAM
- Optional: CUDA-compatible GPU
