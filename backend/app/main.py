import mimetypes
import re
import threading
from typing import Literal, Optional

import yt_dlp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, model_validator

from . import config
from .downloader import fetch_info, run_job
from .jobs import manager
from .validation import parse_time, validate_public_url

app = FastAPI(title="VYRA API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type"])
threading.Thread(target=manager.cleanup_loop, daemon=True).start()


class InfoRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    mode: Literal["video", "audio"] = "video"
    quality: Literal["360", "480", "720", "1080", "1440", "best"] = "best"
    audio_format: Literal["mp3", "wav", "aac", "flac", "ogg", "m4a"] = "mp3"
    trim_enabled: bool = False
    trim_start: Optional[str] = None
    trim_end: Optional[str] = None
    subtitles: bool = False
    subtitle_lang: str = Field("en", pattern=r"^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$")
    subtitle_format: Literal["srt", "vtt"] = "srt"
    playlist_mode: Literal["single", "all", "range"] = "single"
    playlist_start: int = Field(1, ge=1, le=5000)
    playlist_end: int = Field(1, ge=1, le=5000)

    @model_validator(mode="after")
    def check(self):
        self.url = validate_public_url(self.url)
        if self.playlist_mode == "range" and self.playlist_end < self.playlist_start:
            raise ValueError("Playlist end must be greater than or equal to start.")
        if self.trim_enabled:
            if not self.trim_start:
                raise ValueError("Enter a start time for trimming.")
            s = parse_time(self.trim_start)
            if self.trim_end:
                e = parse_time(self.trim_end)
                if e <= s:
                    raise ValueError("Trim end time must be greater than start time.")
        return self


def _job_json(j):
    return {"id": j.id, "status": j.status, "percent": j.percent, "speed": j.speed, "eta": j.eta,
            "downloaded_bytes": j.downloaded_bytes, "filename": j.filename, "item_index": j.item_index,
            "item_total": j.item_total, "completed_items": j.completed_items, "failed_items": j.failed_items,
            "actual_quality": j.actual_quality, "requested": {k: v for k, v in j.settings.items() if k not in ("trim_start", "trim_end") or j.settings["trim_enabled"]},
            "notes": j.notes, "error": j.error, "file_size": j.file_size, "created_at": j.created_at,
            "finished_at": j.finished_at, "file_ready": j.status == "completed" and bool(j.file_path and j.file_path.exists())}


def _get(job_id: str):
    if not re.fullmatch(r"[0-9a-f]{32}", job_id):
        raise HTTPException(404, "Job not found.")
    j = manager.get(job_id)
    if not j:
        raise HTTPException(404, "Job not found or expired.")
    return j


@app.get("/health")
def health():
    import shutil
    return {"status": "ok", "ffmpeg": shutil.which("ffmpeg") is not None, "yt_dlp": yt_dlp.version.__version__}


@app.post("/api/info")
def info(req: InfoRequest):
    try:
        url = validate_public_url(req.url)
    except ValueError as e:
        raise HTTPException(422, str(e))
    try:
        return fetch_info(url)
    except Exception:
        raise HTTPException(400, "Could not read this link. It may be unsupported, private, or unavailable.")


@app.post("/api/download", status_code=202)
def create_download(req: DownloadRequest):
    active = sum(1 for j in manager.list() if j.status not in ("completed", "failed", "cancelled"))
    if active >= config.MAX_CONCURRENT * 4:
        raise HTTPException(429, "The server is busy. Please try again shortly.")
    s = req.model_dump(exclude={"url"})
    s["trim_start"] = parse_time(req.trim_start) if req.trim_enabled else None
    s["trim_end"] = parse_time(req.trim_end) if req.trim_enabled and req.trim_end else None
    job = manager.create(req.url, s)
    manager.pool.submit(run_job, job)
    return {"job_id": job.id, "status": job.status}


@app.get("/api/jobs")
def list_jobs():
    return [_job_json(j) for j in manager.list()]


@app.get("/api/jobs/{job_id}")
def job_details(job_id: str):
    return _job_json(_get(job_id))


@app.get("/api/jobs/{job_id}/progress")
def job_progress(job_id: str):
    return _job_json(_get(job_id))


@app.get("/api/jobs/{job_id}/file")
def job_file(job_id: str):
    j = _get(job_id)
    if j.status != "completed":
        raise HTTPException(409, "File is not ready yet.")
    if not j.file_path or not j.file_path.exists():
        raise HTTPException(410, "This file has expired and was deleted from the server.")
    mime = mimetypes.guess_type(j.file_path.name)[0] or "application/octet-stream"
    return FileResponse(j.file_path, media_type=mime, filename=j.file_path.name)  # streamed from disk


@app.delete("/api/jobs/{job_id}")
def cancel_job(job_id: str):
    j = _get(job_id)
    j.cancel.set()
    if j.status in ("completed", "failed", "cancelled"):
        manager.remove(job_id)
    return {"id": job_id, "status": "cancelling" if j.status not in ("completed", "failed", "cancelled") else "removed"}
