'use client'

import { useState } from 'react'
import { Bot, CheckCircle2, ChevronDown, Loader2, Send, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type AssistantOperation = {
  id: string
  description: string
  target: string
  requiresDeploy?: boolean
  requiresBotReload?: boolean
}

type AssistantPlanResponse = {
  runId: string
  reply: string
  status: 'planned' | 'needs_more_detail'
  operations: AssistantOperation[]
  warnings: string[]
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  plan?: AssistantPlanResponse
}

function newId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function AssistantFloatingChat() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [applyingRunId, setApplyingRunId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Soy el asistente de Vicky. Pedime cambios de promociones, precios, prompts, clientes, agenda o configuración. Primero te muestro el plan y recién aplico cuando confirmás.',
    },
  ])

  async function sendMessage() {
    const message = input.trim()
    if (!message || loading) return
    setInput('')
    setLoading(true)
    setMessages((prev) => [...prev, { id: newId(), role: 'user', text: message }])

    try {
      const response = await fetch('/api/assistant/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, origin: 'dashboard' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No se pudo crear el plan')
      const plan = data as AssistantPlanResponse
      setMessages((prev) => [...prev, { id: newId(), role: 'assistant', text: plan.reply, plan }])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'system',
          text: error instanceof Error ? error.message : 'Error del asistente',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function applyPlan(plan: AssistantPlanResponse) {
    if (!plan.operations.length || applyingRunId) return
    setApplyingRunId(plan.runId)
    try {
      const response = await fetch('/api/assistant/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: plan.runId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || data?.error || 'No se pudo aplicar')
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          text: `Listo. Apliqué ${data.applied} cambio(s). Firestore ya quedó actualizado; si el cambio requiere bot/deploy queda marcado en auditoría.`,
        },
      ])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'system',
          text: error instanceof Error ? error.message : 'Error aplicando cambios',
        },
      ])
    } finally {
      setApplyingRunId(null)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end">
      {open ? (
        <section className="mb-3 w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-slate-200 bg-brand-950 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Asistente Vicky</p>
                <p className="text-xs text-brand-300">Cambios con confirmación</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-1 text-brand-200 hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="max-h-[55vh] space-y-3 overflow-y-auto bg-slate-50 p-3">
            {messages.map((message) => (
              <div key={message.id} className={cn('rounded-2xl px-3 py-2 text-sm', {
                'ml-8 bg-brand-600 text-white': message.role === 'user',
                'mr-8 bg-white text-slate-800 shadow-sm': message.role === 'assistant',
                'bg-amber-50 text-amber-800 border border-amber-100': message.role === 'system',
              })}>
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.plan ? (
                  <div className="mt-3 space-y-2">
                    {message.plan.operations.map((op) => (
                      <div key={op.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                        <p className="font-semibold text-slate-900">{op.description}</p>
                        <p className="mt-1">Destino: <span className="font-mono">{op.target}</span></p>
                        {(op.requiresBotReload || op.requiresDeploy) ? (
                          <p className="mt-1 text-amber-700">
                            Requiere {op.requiresBotReload ? 'recarga del bot' : ''}
                            {op.requiresBotReload && op.requiresDeploy ? ' y ' : ''}
                            {op.requiresDeploy ? 'deploy durable' : ''}.
                          </p>
                        ) : null}
                      </div>
                    ))}
                    {message.plan.warnings.map((warning) => (
                      <p key={warning} className="rounded-xl bg-amber-50 px-2 py-1 text-xs text-amber-800">{warning}</p>
                    ))}
                    {message.plan.status === 'planned' && message.plan.operations.length > 0 ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                        disabled={applyingRunId === message.plan.runId}
                        onClick={() => applyPlan(message.plan!)}
                      >
                        {applyingRunId === message.plan.runId ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Confirmar y aplicar
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
            {loading ? (
              <div className="mr-8 inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Pensando...
              </div>
            ) : null}
          </div>

          <form
            className="flex items-end gap-2 border-t border-slate-200 bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault()
              sendMessage()
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={2}
              className="min-h-10 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Ej: agregá una promo de cercos..."
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
              aria-label="Enviar al asistente"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-xl hover:bg-brand-800"
      >
        <Bot className="h-5 w-5" />
        Asistente Vicky
        {open ? <ChevronDown className="h-4 w-4" /> : null}
      </button>
    </div>
  )
}
