import { API_BASE } from './config'

export interface Job {
  id: string; status: string; percent: number | null; speed: number | null; eta: number | null
  filename: string | null; item_index: number | null; item_total: number | null
  completed_items: number; failed_items: number; actual_quality: string | null
  notes: string[]; error: string | null; file_size: number | null; file_ready: boolean
}
export const TERMINAL = ['completed', 'failed', 'cancelled']

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, { headers: { 'Content-Type': 'application/json' }, ...init })
  } catch {
    throw new Error('Cannot reach the VYRA server. It may be offline or waking up (free hosting can take ~1 minute).')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data.detail
    const msg = Array.isArray(d) ? d.map((x: any) => String(x.msg).replace('Value error, ', '')).join(' ') : d
    throw new Error(msg || `Request failed (${res.status}).`)
  }
  return data as T
}

export const createJob = (body: object) => req<{ job_id: string }>('/api/download', { method: 'POST', body: JSON.stringify(body) })
export const getJob = (id: string) => req<Job>(`/api/jobs/${id}/progress`)
export const cancelJob = (id: string) => req(`/api/jobs/${id}`, { method: 'DELETE' })
export const fileUrl = (id: string) => `${API_BASE}/api/jobs/${id}/file`
