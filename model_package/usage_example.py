
# Example usage for this model
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

# Load model and tokenizer
tokenizer = AutoTokenizer.from_pretrained("./")
model = AutoModelForCausalLM.from_pretrained("./", torch_dtype=torch.float16)

# Generate text
prompt = "Hello, how can I help you?"
inputs = tokenizer.encode(prompt, return_tensors="pt")
outputs = model.generate(inputs, max_length=100, temperature=0.7)
response = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(response)
