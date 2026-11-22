import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// VITE_BASE is set by the GitHub Actions workflow (e.g. /VYRA/)
// @ts-ignore
const base = process.env.VITE_BASE || '/'
export default defineConfig({ base, plugins: [react()] })
