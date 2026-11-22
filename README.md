# VYRA — Your Media. Your Way.
React + Vite + Tailwind frontend, FastAPI + yt-dlp + FFmpeg backend. Use only for content you have the right to download.

## Run locally (Windows PowerShell)
Install: Node.js 20 LTS, Python 3.11+, FFmpeg (`winget install Gyan.FFmpeg`).

**Backend**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DOWNLOAD_DIR = "$env:TEMP\vyra_downloads"
uvicorn app.main:app --reload --port 8000
```
Check http://localhost:8000/health and http://localhost:8000/docs

**Frontend** (new PowerShell window)
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Deploy backend on Render
1. Push this project to GitHub. 2. Render → New → Web Service → pick the repo. 3. Runtime: Docker, Root Directory: `backend`. 4. Env vars: `CORS_ORIGINS=https://YOUR_USERNAME.github.io`. 5. Deploy, then open `https://YOUR-APP.onrender.com/health`.
Free tier: the service sleeps when idle (first request ~1 min), files are temporary and lost on restart, jobs are in memory.

## Deploy frontend on GitHub Pages
1. Repo → Settings → Pages → Source: **GitHub Actions**.
2. Settings → Secrets and variables → Actions → Variables → add `VITE_API_BASE_URL` = your Render URL (no trailing slash).
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds `frontend/` and publishes it.

## Known limitations
Not yet automated-tested. No rate limiting. In-memory jobs. Per-item playlist status and the `/subtitles` endpoint are not implemented.
