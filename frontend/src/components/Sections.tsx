import { useState } from 'react'
import { Menu, X, Film, Music, ListVideo, Scissors, Captions, Activity, Smartphone, MousePointerClick, ChevronDown } from 'lucide-react'

const links = [['Home', '#home'], ['Downloader', '#downloader'], ['Features', '#features'], ['FAQ', '#faq']]

export const Logo = ({ light = false }: { light?: boolean }) => (
  <a href="#home" className={`font-serif text-2xl tracking-[0.3em] rise ${light ? 'text-sand' : 'text-cocoa'}`} aria-label="VYRA home">VYRA</a>
)

export function Navbar({ scrolled }: { scrolled: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <header className={`sticky top-0 z-40 transition ${scrolled ? 'bg-ivory/95 shadow-sm border-b border-sand' : 'bg-transparent'}`}>
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4" aria-label="Main">
        <Logo />
        <ul className="hidden gap-8 md:flex">
          {links.map(([n, h]) => <li key={h}><a href={h} className="text-brown hover:text-caramel transition">{n}</a></li>)}
        </ul>
        <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>{open ? <X /> : <Menu />}</button>
      </nav>
      {open && <ul className="md:hidden border-t border-sand bg-ivory px-5 pb-4">
        {links.map(([n, h]) => <li key={h}><a href={h} onClick={() => setOpen(false)} className="block py-3 text-brown">{n}</a></li>)}
      </ul>}
    </header>
  )
}

export const Hero = () => (
  <section id="home" className="mx-auto max-w-4xl px-5 pb-10 pt-16 text-center">
    <p className="rise mb-4 text-sm uppercase tracking-[0.3em] text-caramel">Your Media. Your Way.</p>
    <h1 className="rise font-serif text-4xl leading-tight text-espresso sm:text-6xl">Download Your Favorite Media.</h1>
    <p className="rise mt-5 text-lg text-brown">A smarter, simpler way to download and manage your media.</p>
    <p className="rise mt-2 text-muted">Powerful tools. Beautiful simplicity. Everything you need in one place.</p>
    <a href="#downloader" className="rise mt-8 inline-flex items-center gap-2 rounded-full bg-cocoa px-7 py-3 text-cream transition hover:bg-espresso">Start downloading</a>
  </section>
)

const feats = [
  [Film, 'Flexible Video Quality', 'Pick 360p to 1440p or best available. The real quality is always reported.'],
  [Music, 'Audio Extraction', 'MP3, WAV, AAC, FLAC, OGG or M4A, converted with FFmpeg.'],
  [ListVideo, 'Playlist Support', 'Single item, whole playlist, or a range. Failed items are skipped.'],
  [Scissors, 'Smart Trimming', 'Cut start and end times on the server with FFmpeg.'],
  [Captions, 'Subtitle Support', 'SRT or VTT when the source provides them.'],
  [Activity, 'Real Progress', 'Live status from the server. 100% only when the file is ready.'],
  [MousePointerClick, 'Simple Workflow', 'Paste a link, choose options, download.'],
  [Smartphone, 'Responsive Design', 'Works on phones, tablets and desktops.'],
] as const

export const Features = () => (
  <section id="features" className="mx-auto max-w-6xl px-5 py-16">
    <h2 className="mb-10 text-center font-serif text-3xl text-espresso">Everything you need</h2>
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {feats.map(([Icon, t, d]) => (
        <div key={t} className="rounded-2xl border border-sand bg-white p-6 transition hover:-translate-y-1 hover:shadow-md">
          <Icon className="mb-4 text-caramel" /><h3 className="mb-2 font-semibold">{t}</h3><p className="text-sm text-muted">{d}</p>
        </div>
      ))}
    </div>
  </section>
)

const faqs = [
  ['How do I use VYRA?', 'Paste a public link, choose video or audio, adjust options, and press Start. Download the file when it is ready.'],
  ['What formats are supported?', 'Video as MP4 (when possible). Audio as MP3, WAV, AAC, FLAC, OGG or M4A. Subtitles as SRT or VTT.'],
  ['Can I download audio only?', 'Yes. Choose Audio Only and a format. It is converted with FFmpeg.'],
  ['Can I download playlists?', 'Yes, where the source allows it: a single item, all items, or a range. Several files are delivered as a ZIP.'],
  ['Can I trim media?', 'Yes. Enter start and end times (seconds, MM:SS or HH:MM:SS). Trimming runs on the server.'],
  ['Are subtitles available?', 'Only when the source provides them. If not, VYRA tells you instead of pretending.'],
  ['Why did my download fail?', 'The content may be private, removed, unsupported, too large, or the server may be busy or asleep.'],
  ['Where are files stored?', 'Temporarily on the server (about one hour), then deleted. Your history list is saved only in this browser.'],
  ['Does VYRA work on mobile?', 'Yes, the interface is fully responsive.'],
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-16">
      <h2 className="mb-8 text-center font-serif text-3xl text-espresso">Questions</h2>
      {faqs.map(([q, a], i) => (
        <div key={q} className="border-b border-sand">
          <button className="flex w-full items-center justify-between py-4 text-left font-medium" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            {q}<ChevronDown className={`transition ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <p className="pb-4 text-brown">{a}</p>}
        </div>
      ))}
    </section>
  )
}

export const Footer = () => (
  <footer className="mt-10 bg-espresso px-5 py-12 text-beige">
    <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
      <div><Logo light /><p className="mt-3 text-sm">Your Media. Your Way. A simple interface for downloading media you are allowed to download.</p></div>
      <ul className="space-y-2 text-sm">{links.map(([n, h]) => <li key={h}><a href={h} className="hover:text-white">{n}</a></li>)}</ul>
      <p className="text-sm">Privacy: VYRA stores files temporarily on the server and your history only in your browser. Terms: use VYRA only for content you have the right to download.</p>
    </div>
    <p className="mx-auto mt-8 max-w-6xl border-t border-cocoa pt-6 text-xs text-muted">
      You are responsible for having the right to download content and for respecting the source platform's terms and copyright. VYRA does not bypass DRM, paywalls, logins or private content and is not affiliated with YouTube or any platform. © {new Date().getFullYear()} VYRA.
    </p>
  </footer>
)
