// Single place for the backend URL. Set VITE_API_BASE_URL in .env files / GitHub variable.
export const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000').replace(/\/$/, '')
