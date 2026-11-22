import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, X, Download, Film, Music, Loader2 } from 'lucide-react'
import { createJob, getJob, cancelJob, fileUrl, Job, TERMINAL } from '../api'

const QUALITIES = ['360', '480', '720', '1080', '1440', 'best']
const AUDIO = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a']
const TIME_RE = /^\d+(\.\d+)?$|^\d{1,3}:[0-5]?\d(:[0-5]?\d)?$/
const toSec = (v: string) => v.includes(':') ? v.split(':').reduce((a, x) => a * 60 + Number(x), 0) : Number(v)
const LABEL: Record<string, string> = { waiting: 'Waiting', fetching: 'Fetching information', downloading: 'Downloading', processing: 'Processing', converting: 'Converting', cutting: 'Cutting', finalizing: 'Finalizing', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' }

interface Hist { id: string; label: string; kind: string; status: string; date: string; size: number | null }
const loadHist = (): Hist[] => { try { return JSON.parse(localStorage.getItem('vyra_history') || '[]') } catch { return [] } }
const mb = (b: number | null) => (b ? (b / 1048576).toFixed(1) + ' MB' : '—')

const field = 'w-full rounded-xl border border-beige bg-white px-4 py-3 focus:border-caramel'
const pill = (on: boolean) => `rounded-full border px-4 py-2 text-sm transition ${on ? 'border-cocoa bg-cocoa text-cream' : 'border-beige bg-white text-brown hover:border-caramel'}`

export default function Downloader() {
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<'video' | 'audio'>('video')
  const [quality, setQuality] = useState('best')
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [trim, setTrim] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [subs, setSubs] = useState(false)
  const [lang, setLang] = useState('en')
  const [subFmt, setSubFmt] = useState('srt')
  const [pl, setPl] = useState<'single' | 'all' | 'range'>('single')
  const [plStart, setPlStart] = useState(1)
  const [plEnd, setPlEnd] = useState(10)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [hist, setHist] = useState<Hist[]>(loadHist)
  const timer = useRef<number>()
  const meta = useRef({ label: '', kind: '' })

  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => { try { localStorage.setItem('vyra_history', JSON.stringify(hist.slice(0, 30))) } catch { /* ignore */ } }, [hist])

  function validate(): string {
    try { const u = new URL(url.trim()); if (!['http:', 'https:'].includes(u.protocol)) throw 0 } catch { return 'Enter a valid link starting with http:// or https://' }
    if (trim) {
      if (!start.trim() || !TIME_RE.test(start.trim())) return 'Start time is invalid. Use seconds, MM:SS or HH:MM:SS.'
      if (end.trim() && !TIME_RE.test(end.trim())) return 'End time is invalid. Use seconds, MM:SS or HH:MM:SS.'
      if (end.trim() && toSec(end.trim()) <= toSec(start.trim())) return 'End time must be greater than start time.'
    }
    if (pl === 'range' && plEnd < plStart) return 'Playlist end must be greater than or equal to start.'
    if (subs && !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(lang)) return 'Subtitle language code looks invalid (example: en, ar, pt-BR).'
    return ''
  }

  function poll(id: string) {
    timer.current = window.setTimeout(async () => {
      try {
        const j = await getJob(id)
        setJob(j)
        if (TERMINAL.includes(j.status)) {
          setBusy(false)
          setHist(h => [{ id, label: j.filename || meta.current.label, kind: meta.current.kind, status: j.status, date: new Date().toLocaleString(), size: j.file_size }, ...h.filter(x => x.id !== id)])
        } else poll(id)
      } catch (e) { setBusy(false); setError((e as Error).message) }
    }, 1500)
  }

  async function submit() {
    const v = validate()
    setError(v)
    if (v) return
    setBusy(true); setJob(null)
    meta.current = { label: url.trim(), kind: mode === 'video' ? `Video ${quality === 'best' ? 'best' : quality + 'p'}` : `Audio ${audioFormat.toUpperCase()}` }
    try {
      const { job_id } = await createJob({
        url: url.trim(), mode, quality, audio_format: audioFormat, trim_enabled: trim, trim_start: trim ? start.trim() : null, trim_end: trim && end.trim() ? end.trim() : null,
        subtitles: subs, subtitle_lang: lang, subtitle_format: subFmt, playlist_mode: pl, playlist_start: plStart, playlist_end: plEnd,
      })
      setJob({ id: job_id, status: 'waiting' } as Job)
      poll(job_id)
    } catch (e) { setBusy(false); setError((e as Error).message) }
  }

  const paste = async () => { try { setUrl(await navigator.clipboard.readText()) } catch { setError('Clipboard access was blocked. Paste manually with Ctrl+V.') } }
  const active = job && !TERMINAL.includes(job.status)

  return (
    <section id="downloader" className="mx-auto max-w-3xl px-5 py-10">
      <div className="rounded-3xl border border-sand bg-cream p-6 shadow-sm sm:p-8">
        <label htmlFor="url" className="mb-2 block font-medium">Media link</label>
        <div className="flex gap-2">
          <input id="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" className={field} inputMode="url" />
          {url ? <button onClick={() => setUrl('')} aria-label="Clear link" className="rounded-xl border border-beige bg-white px-3"><X size={18} /></button>
            : <button onClick={paste} aria-label="Paste from clipboard" className="rounded-xl border border-beige bg-white px-3"><ClipboardPaste size={18} /></button>}
        </div>
        <p className="mt-2 text-xs text-muted">Only download content you have the right to download. Private, paid or protected content is not supported.</p>

        <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Download mode">
          {([['video', Film, 'Video'], ['audio', Music, 'Audio Only']] as const).map(([m, Icon, t]) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`flex items-center justify-center gap-2 rounded-2xl border p-4 transition ${mode === m ? 'border-cocoa bg-cocoa text-cream' : 'border-beige bg-white'}`}><Icon size={18} />{t}</button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2" aria-label={mode === 'video' ? 'Quality' : 'Audio format'}>
          {mode === 'video' ? QUALITIES.map(q => <button key={q} onClick={() => setQuality(q)} aria-pressed={quality === q} className={pill(quality === q)}>{q === 'best' ? 'Best Available' : q + 'p'}</button>)
            : AUDIO.map(a => <button key={a} onClick={() => setAudioFormat(a)} aria-pressed={audioFormat === a} className={pill(audioFormat === a)}>{a.toUpperCase()}</button>)}
        </div>

        <div className="mt-6 space-y-4 border-t border-sand pt-5">
          <label className="flex items-center gap-2"><input type="checkbox" checked={trim} onChange={e => setTrim(e.target.checked)} /> Trim (cut a section)</label>
          {trim && <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="ts" className="text-sm">Start time</label><input id="ts" className={field} value={start} onChange={e => setStart(e.target.value)} placeholder="0, 1:30 or 00:01:30" /></div>
            <div><label htmlFor="te" className="text-sm">End time (optional)</label><input id="te" className={field} value={end} onChange={e => setEnd(e.target.value)} placeholder="until the end" /></div>
          </div>}

          <label className="flex items-center gap-2"><input type="checkbox" checked={subs} onChange={e => setSubs(e.target.checked)} /> Download subtitles</label>
          {subs && <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="sl" className="text-sm">Language</label>
              <select id="sl" className={field} value={['en', 'ar'].includes(lang) ? lang : 'custom'} onChange={e => setLang(e.target.value === 'custom' ? '' : e.target.value)}><option value="en">English</option><option value="ar">Arabic</option><option value="custom">Other (code)…</option></select></div>
            <div><label htmlFor="sf" className="text-sm">Format</label><select id="sf" className={field} value={subFmt} onChange={e => setSubFmt(e.target.value)}><option value="srt">SRT</option><option value="vtt">VTT</option></select></div>
            {!['en', 'ar'].includes(lang) && <div className="sm:col-span-2"><label htmlFor="lc" className="text-sm">Language code</label><input id="lc" className={field} value={lang} onChange={e => setLang(e.target.value)} placeholder="fr, de, pt-BR…" /></div>}
          </div>}

          <div><label htmlFor="pl" className="text-sm">If the link is a playlist</label>
            <select id="pl" className={field} value={pl} onChange={e => setPl(e.target.value as typeof pl)}><option value="single">Single item only</option><option value="all">Entire playlist</option><option value="range">Range of items</option></select></div>
          {pl === 'range' && <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="ps" className="text-sm">From item</label><input id="ps" type="number" min={1} className={field} value={plStart} onChange={e => setPlStart(Number(e.target.value))} /></div>
            <div><label htmlFor="pe" className="text-sm">To item</label><input id="pe" type="number" min={1} className={field} value={plEnd} onChange={e => setPlEnd(Number(e.target.value))} /></div>
          </div>}
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-caramel bg-sand px-4 py-3 text-sm text-espresso">{error}</p>}
        <button onClick={submit} disabled={busy || !url} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-cocoa py-4 text-cream transition hover:bg-espresso disabled:opacity-50">
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}{busy ? 'Working…' : 'Start download'}
        </button>
      </div>

      {job && (
        <div className="mt-6 rounded-2xl border border-sand bg-white p-6" aria-live="polite">
          <div className="flex items-center justify-between"><span className="font-medium">{LABEL[job.status] || job.status}</span><span className="text-xs text-muted">Job {job.id.slice(0, 8)}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={job.percent ?? undefined} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full bg-caramel transition-all ${job.percent == null && active ? 'w-1/3 animate-pulse' : ''}`} style={job.percent != null ? { width: `${job.status === 'completed' ? 100 : job.percent}%` } : undefined} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-1 text-sm text-muted sm:grid-cols-4">
            {job.percent != null && <div><dt className="sr-only">Percent</dt>{job.percent}%</div>}
            {job.speed ? <div>{(job.speed / 1048576).toFixed(1)} MB/s</div> : null}
            {job.eta != null ? <div>ETA {job.eta}s</div> : null}
            {job.item_index ? <div>Item {job.item_index}{job.item_total ? ` / ${job.item_total}` : ''}</div> : null}
          </dl>
          {job.filename && <p className="mt-2 truncate text-sm">{job.filename}</p>}
          {job.actual_quality && <p className="text-sm text-muted">Actual quality: {job.actual_quality}</p>}
          {job.notes?.map(n => <p key={n} className="mt-1 text-sm text-brown">{n}</p>)}
          {job.error && <p role="alert" className="mt-3 text-sm text-espresso">{job.error}</p>}
          <div className="mt-4 flex gap-3">
            {job.file_ready && <a href={fileUrl(job.id)} className="rounded-full bg-cocoa px-5 py-2 text-cream">Download file ({mb(job.file_size)})</a>}
            {active && <button onClick={() => cancelJob(job.id)} className="rounded-full border border-beige px-5 py-2">Cancel</button>}
          </div>
        </div>
      )}

      {hist.length > 0 && (
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between"><h3 className="font-serif text-xl">History</h3><button className="text-sm text-caramel" onClick={() => setHist([])}>Clear all</button></div>
          <p className="mb-3 text-xs text-muted">Saved in this browser only. Server files are deleted after about an hour, so old downloads may have expired.</p>
          <ul className="divide-y divide-sand rounded-2xl border border-sand bg-white">
            {hist.map(h => (
              <li key={h.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0"><p className="truncate">{h.label}</p><p className="text-xs text-muted">{h.kind} · {LABEL[h.status]} · {h.date} · {mb(h.size)}</p></div>
                <div className="flex shrink-0 gap-3">
                  {h.status === 'completed' && <a className="text-caramel" href={fileUrl(h.id)}>Download</a>}
                  <button aria-label="Remove entry" onClick={() => setHist(x => x.filter(y => y.id !== h.id))}><X size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
