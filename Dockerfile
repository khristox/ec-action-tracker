FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Switch to root to install packages
USER root

WORKDIR /app

# Force apt to use https mirrors instead of http (avoids Fastly edge 403s)
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/*.sources 2>/dev/null || \
    sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list 2>/dev/null || true && \
    echo 'Acquire::Retries "3";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::http::Timeout "30";' >> /etc/apt/apt.conf.d/80-retries

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        jq \
        curl \
        gcc \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire application - use a single COPY command
COPY . .

# Copy .env file if it exists (use RUN with shell conditional)
RUN if [ -f .env ]; then cp .env /app/.env; fi
RUN if [ -f .env.example ]; then cp .env.example /app/.env.example; fi

# Create necessary directories
RUN mkdir -p /app/static && \
    chmod -R 755 /app/static

# List files for debugging (optional - remove in production)
RUN ls -la /app/ && ls -la /app/app/ 2>/dev/null || echo "app directory check" && \
    ls -la /app/static/ 2>/dev/null || echo "Static directory not found"

# Create a non-root user
RUN addgroup --system app && \
    adduser --system --group app && \
    chown -R app:app /app

# Switch to non-root user
USER app

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run the application using python -m for reliability
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]