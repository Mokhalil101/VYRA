import { useEffect, useState } from 'react'
import Downloader from './components/Downloader'
import { Navbar, Hero, Features, FAQ, Footer } from './components/Sections'

export default function App() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <>
      <Navbar scrolled={scrolled} />
      <main><Hero /><Downloader /><Features /><FAQ /></main>
      <Footer />
    </>
  )
}
