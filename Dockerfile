# Dockerfile
FROM python:3.11-slim as builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-spa \
    tesseract-ocr-fra \
    tesseract-ocr-deu \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Final stage
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH=/root/.local/bin:$PATH

WORKDIR /app

# Create non-root user
RUN addgroup --system app && \
    adduser --system --group app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local

# Create necessary directories
RUN mkdir -p /app/static /app/logs /app/uploads

# Copy application code (excluding files via .dockerignore)
COPY --chown=app:app . .

# Ensure static directory has at least a placeholder index.html
RUN if [ ! -f /app/static/index.html ]; then \
        echo '<!DOCTYPE html><html><head><title>EC Action Tracker API</title><style>body{font-family:Arial;text-align:center;padding:50px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;justify-content:center;align-items:center}.card{background:white;border-radius:20px;padding:40px;box-shadow:0 20px 40px rgba(0,0,0,0.1)}h1{color:#4F46E5}a{display:inline-block;margin:10px;padding:12px 24px;background:#4F46E5;color:white;text-decoration:none;border-radius:8px}</style></head><body><div class="card"><h1>🚀 EC Action Tracker API</h1><p>Backend is running!</p><a href="/docs">📚 API Documentation</a><a href="/health">❤️ Health Check</a></div></body></html>' > /app/static/index.html && \
        chown app:app /app/static/index.html; \
    fi

# Set permissions
RUN chown -R app:app /app/static /app/logs /app/uploads

# Switch to non-root user
USER app

# Expose port
EXPOSE 8006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8006/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8006"]