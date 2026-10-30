FROM python:3.12-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY pyproject.toml README.md ./
COPY eduexam_mcp ./eduexam_mcp
RUN python -m pip install --upgrade pip && python -m pip install .

# Che do HTTP: khong luu tai khoan nao; moi request mang ma truy cap rieng cua nguoi dung.
ENV EDUEXAM_MCP_TRANSPORT=http \
    EDUEXAM_MCP_HOST=0.0.0.0 \
    EDUEXAM_MCP_PORT=8765

EXPOSE 8765
USER nobody
CMD ["python", "-m", "eduexam_mcp"]
