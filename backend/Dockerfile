FROM python:3.12-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/backend

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend /app/backend

RUN python -m pip install --upgrade pip \
    && python -m pip install -e .

RUN mkdir -p /app/backend/media /app/backend/staticfiles

EXPOSE 8000
