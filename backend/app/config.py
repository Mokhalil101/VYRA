import os
from pathlib import Path

PORT = int(os.getenv("PORT", "8000"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", "/tmp/vyra_downloads")).resolve()
MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT_DOWNLOADS", "2"))
MAX_DOWNLOAD_SIZE = int(os.getenv("MAX_DOWNLOAD_SIZE", str(500 * 1024 * 1024)))
RETENTION_SECONDS = float(os.getenv("JOB_RETENTION_HOURS", "1")) * 3600
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
