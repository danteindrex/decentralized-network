FROM python:3.10-slim

WORKDIR /app

COPY orchestrator/requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

RUN apt-get update && apt-get install -y ipfs ray-core git \
    && rm -rf /var/lib/apt/lists/*

COPY orchestrator/ ./orchestrator/

WORKDIR /app/orchestrator

CMD ["python", "main.py"]