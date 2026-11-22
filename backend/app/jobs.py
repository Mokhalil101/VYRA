import shutil
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from . import config


@dataclass
class Job:
    id: str
    url: str
    settings: dict
    status: str = "waiting"
    percent: Optional[float] = None
    speed: Optional[float] = None
    eta: Optional[int] = None
    downloaded_bytes: Optional[int] = None
    filename: Optional[str] = None
    item_index: Optional[int] = None
    item_total: Optional[int] = None
    completed_items: int = 0
    failed_items: int = 0
    actual_quality: Optional[str] = None
    notes: list = field(default_factory=list)
    error: Optional[str] = None
    file_path: Optional[Path] = None
    file_size: Optional[int] = None
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    cancel: threading.Event = field(default_factory=threading.Event)


class JobManager:
    """In-memory jobs: lost on restart. Swap this class for Redis later."""

    def __init__(self):
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=config.MAX_CONCURRENT)

    def create(self, url: str, settings: dict) -> Job:
        job = Job(id=uuid.uuid4().hex, url=url, settings=settings)
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def list(self):
        return sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)[:50]

    def job_dir(self, job_id: str) -> Path:
        d = (config.DOWNLOAD_DIR / job_id).resolve()
        if config.DOWNLOAD_DIR not in d.parents:
            raise ValueError("Unsafe path")
        return d

    def remove(self, job_id: str):
        with self._lock:
            self._jobs.pop(job_id, None)
        shutil.rmtree(self.job_dir(job_id), ignore_errors=True)

    def cleanup_loop(self):
        while True:
            time.sleep(300)
            now = time.time()
            for j in list(self._jobs.values()):
                if j.finished_at and now - j.finished_at > config.RETENTION_SECONDS:
                    self.remove(j.id)


manager = JobManager()
