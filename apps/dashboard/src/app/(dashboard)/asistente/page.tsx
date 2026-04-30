'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Bot, RefreshCw, RotateCcw } from 'lucide-react'

type AssistantRun = {
  id: string
  message?: string
  status?: string
  origin?: string
  operations?: Array<{ id: string; description: string; target: string }>
  sync?: Record<string, string>
  user?: { email?: string }
}

export default function AsistentePage() {
  const [runs, setRuns] = useState<AssistantRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadRuns() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/assistant/runs')
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Error al cargar auditoría')
      setRuns(Array.isArray(data.runs) ? data.runs : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar auditoría')
    } finally {
      setLoading(false)
    }
  }

  async function rollback(id: string) {
    if (!window.confirm('¿Revertir este cambio del asistente?')) return
    const response = await fetch(`/api/assistant/runs/${id}/rollback`, { method: 'POST' })
    const data = await response.json()
    if (!response.ok) {
      setError(data?.detail || data?.error || 'No se pudo revertir')
      return
    }
    loadRuns()
  }

  useEffect(() => {
    loadRuns()
  }, [])

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
            <Bot className="h-5 w-5 text-brand-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Asistente Vicky</h1>
            <p className="text-sm text-slate-500">Auditoría de cambios, sincronización y rollback</p>
          </div>
        </div>
        <button type="button" onClick={loadRuns} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">Cargando auditoría...</div> : null}

      <div className="space-y-4">
        {runs.map((run) => (
          <article key={run.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-700">{run.status || 'sin_estado'}</span>
                  <span className="text-xs text-slate-500">{run.origin || 'dashboard'}</span>
                  {run.user?.email ? <span className="text-xs text-slate-500">{run.user.email}</span> : null}
                </div>
                <p className="mt-2 text-sm text-slate-900">{run.message || 'Sin mensaje'}</p>
              </div>
              {run.status === 'applied' ? (
                <button type="button" onClick={() => rollback(run.id)} className="btn-secondary flex items-center gap-2 text-xs">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Rollback
                </button>
              ) : null}
            </div>

            {run.operations?.length ? (
              <div className="mt-3 space-y-2">
                {run.operations.map((op) => (
                  <div key={op.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-800">{op.description}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{op.target}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {run.sync ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(run.sync).map(([key, value]) => (
                  <span key={key} className="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-800">
                    {key}: {value}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {!loading && runs.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
          Todavía no hay cambios aplicados por el asistente.
        </div>
      ) : null}
    </div>
  )
}
