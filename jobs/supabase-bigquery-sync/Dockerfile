# syntax=docker/dockerfile:1
FROM python:3.12-slim

# No interactive prompts
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY sql/ ./sql/

# Cloud Run Jobs expect the container to exit 0 on success
CMD ["python", "main.py"]
