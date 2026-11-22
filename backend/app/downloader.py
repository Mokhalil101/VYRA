import logging
import re
import shutil
import time
from pathlib import Path

import yt_dlp
from yt_dlp.utils import download_range_func

from . import config
from .jobs import Job, manager

log = logging.getLogger("vyra")


class Cancelled(Exception):
    pass


def _friendly(err: Exception) -> str:
    m = str(err).lower()
    if "private" in m or "sign in" in m or "login" in m:
        return "This content is private or requires sign-in. VYRA can't download it."
    if "unavailable" in m or "removed" in m or "deleted" in m:
        return "This content is unavailable or was removed."
    if "unsupported url" in m:
        return "This website or link type is not supported."
    if "ffmpeg" in m or "ffprobe" in m:
        return "Conversion failed (FFmpeg problem on the server)."
    if "larger than" in m or "max-filesize" in m:
        return "The file exceeds the server's size limit."
    return "The download failed. Check the link and try again."


def fetch_info(url: str) -> dict:
    opts = {"quiet": True, "no_warnings": True, "extract_flat": "in_playlist", "skip_download": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    is_pl = info.get("_type") == "playlist"
    heights = sorted({f["height"] for f in info.get("formats", []) if f.get("height")})
    subs = sorted(set(info.get("subtitles", {})) | set(info.get("automatic_captions", {})))
    entries = [{"index": i + 1, "title": e.get("title") or "Untitled"} for i, e in enumerate(info.get("entries") or []) if e]
    return {
        "title": info.get("title"), "thumbnail": info.get("thumbnail"), "duration": info.get("duration"),
        "source": info.get("extractor_key"), "is_playlist": is_pl, "playlist_count": len(entries) if is_pl else None,
        "playlist_entries": entries[:200], "available_heights": heights, "subtitle_languages": subs[:60],
    }


def _build_opts(job: Job, out_dir: Path, hook, pp_hook) -> dict:
    s = job.settings
    opts = {
        "outtmpl": str(out_dir / "%(playlist_index|)s%(playlist_index& - |)s%(title).120B [%(id)s].%(ext)s"),
        "restrictfilenames": False, "windowsfilenames": True, "quiet": True, "no_warnings": True,
        "progress_hooks": [hook], "postprocessor_hooks": [pp_hook], "max_filesize": config.MAX_DOWNLOAD_SIZE,
        "socket_timeout": 30, "retries": 3, "noplaylist": s["playlist_mode"] == "single",
        "ignoreerrors": s["playlist_mode"] != "single",
    }
    if s["playlist_mode"] == "range":
        opts["playlist_items"] = f"{s['playlist_start']}-{s['playlist_end']}"
    pps = []
    if s["mode"] == "audio":
        fmt = s["audio_format"]
        opts["format"] = "bestaudio/best"
        pps.append({"key": "FFmpegExtractAudio", "preferredcodec": fmt, **({"preferredquality": "192"} if fmt in ("mp3", "aac", "ogg") else {})})
    else:
        q = s["quality"]
        if q == "best":
            opts["format"] = "bv*+ba/b"
        else:
            h = int(q)
            opts["format"] = f"bv*[height<={h}]+ba/b[height<={h}]/bv*+ba/b"  # last fallback = closest available
        opts["merge_output_format"] = "mp4"
    if s["subtitles"]:
        opts.update({"writesubtitles": True, "writeautomaticsub": True, "subtitleslangs": [s["subtitle_lang"]],
                     "subtitlesformat": s["subtitle_format"]})
    if s["trim_enabled"]:
        end = s["trim_end"] if s["trim_end"] is not None else float("inf")
        opts["download_ranges"] = download_range_func(None, [(s["trim_start"], end)])
        opts["force_keyframes_at_cuts"] = True
    opts["postprocessors"] = pps
    return opts


def run_job(job: Job):
    out_dir = manager.job_dir(job.id)
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        if job.cancel.is_set():
            raise Cancelled()
        job.status = "fetching"

        def hook(d):
            if job.cancel.is_set():
                raise Cancelled()
            ie = d.get("info_dict") or {}
            job.filename = Path(d.get("filename", "")).name or job.filename
            if ie.get("playlist_index"):
                job.item_index, job.item_total = ie["playlist_index"], ie.get("n_entries")
            if d["status"] == "downloading":
                job.status = "downloading"
                total = d.get("total_bytes") or d.get("total_bytes_estimate")
                job.downloaded_bytes = d.get("downloaded_bytes")
                job.percent = round(min(99.0, d["downloaded_bytes"] / total * 100), 1) if total else None
                job.speed, job.eta = d.get("speed"), d.get("eta")
                if ie.get("height"):
                    job.actual_quality = f"{ie['height']}p"
            elif d["status"] == "finished":
                job.status = "processing"

        def pp_hook(d):
            if d["status"] == "started":
                job.status = "cutting" if job.settings["trim_enabled"] and d["postprocessor"] == "ModifyChapters" else "converting"

        with yt_dlp.YoutubeDL(_build_opts(job, out_dir, hook, pp_hook)) as ydl:
            ydl.download([job.url])
        if job.cancel.is_set():
            raise Cancelled()

        job.status = "finalizing"
        files = sorted(p for p in out_dir.iterdir() if p.is_file() and not p.name.endswith((".part", ".ytdl")))
        media = [p for p in files if p.suffix.lower() not in (".srt", ".vtt")]
        if not media:
            raise RuntimeError("no output")
        job.completed_items = len(media)
        if job.settings["subtitles"] and not any(p.suffix.lower() in (".srt", ".vtt") for p in files):
            job.notes.append("Subtitles were not available for the requested language.")
        if len(files) == 1:
            final = files[0]
        else:
            archive = shutil.make_archive(str(out_dir / "vyra_download"), "zip", root_dir=out_dir)
            final = Path(archive)
        job.file_path, job.file_size = final, final.stat().st_size
        job.filename, job.percent = final.name, 100.0
        job.status = "completed"  # only set once the file exists
    except Cancelled:
        job.status = "cancelled"
        shutil.rmtree(out_dir, ignore_errors=True)
    except Exception as e:
        log.exception("Job %s failed", job.id)
        job.status, job.error = "failed", _friendly(e)
    finally:
        job.finished_at = time.time()
