'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  RotateCcw,
  User,
  Filter,
  Search,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn, formatRelative } from '@/lib/utils'

interface Seguimiento {
  id: string
  jid: string
  texto: string
  runAt: Date
  estado: string
  origen: string
  motivoSeguimiento?: string
  nombreCliente?: string
  creadoEn?: Date
}

function tsToDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as Timestamp).toDate === 'function')
    return (value as Timestamp).toDate()
  return undefined
}

function getTelFromJid(jid: string): string {
  return String(jid || '')
    .replace('@s.whatsapp.net', '')
    .replace('@g.us', '')
    .replace('@lid', '')
}

type TabFilter = 'pendientes' | 'vencidos' | 'enviados' | 'todos'

export default function SeguimientosPage() {
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabFilter>('pendientes')
  const [search, setSearch] = useState('')
  const [reprogramando, setReprogramando] = useState<string | null>(null)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora] = useState('14:00')

  useEffect(() => {
    const q = query(
      collection(db, 'mensajes_programados'),
      orderBy('runAt', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const data: Seguimiento[] = snap.docs.map((d) => {
        const raw = d.data()
        return {
          id: d.id,
          jid: raw.jid || '',
          texto: raw.texto || '',
          runAt: tsToDate(raw.runAt) || new Date(),
          estado: raw.estado || 'pendiente',
          origen: raw.origen || 'bot',
          motivoSeguimiento: raw.motivoSeguimiento,
          nombreCliente: raw.nombreCliente,
          creadoEn: tsToDate(raw.creadoEn),
        }
      })
      setSeguimientos(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const counts = useMemo(() => {
    let pendientes = 0
    let vencidos = 0
    let enviados = 0
    for (const s of seguimientos) {
      if (s.estado === 'pendiente') {
        if (s.runAt < ahora) vencidos++
        else pendientes++
      } else if (s.estado === 'enviado') {
        enviados++
      }
    }
    return { pendientes, vencidos, enviados, total: seguimientos.length }
  }, [seguimientos, ahora])

  const filtered = useMemo(() => {
    let result = [...seguimientos]

    if (tab === 'pendientes') {
      result = result.filter((s) => s.estado === 'pendiente' && s.runAt >= ahora)
    } else if (tab === 'vencidos') {
      result = result.filter((s) => s.estado === 'pendiente' && s.runAt < ahora)
    } else if (tab === 'enviados') {
      result = result.filter((s) => s.estado === 'enviado')
    }

    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (seg) =>
          seg.nombreCliente?.toLowerCase().includes(s) ||
          seg.texto.toLowerCase().includes(s) ||
          seg.motivoSeguimiento?.toLowerCase().includes(s) ||
          getTelFromJid(seg.jid).includes(s)
      )
    }

    return result
  }, [seguimientos, tab, search, ahora])

  async function marcarCompletado(id: string) {
    try {
      await updateDoc(doc(db, 'mensajes_programados', id), {
        estado: 'completado_manual',
        actualizadoEn: serverTimestamp(),
      })
    } catch (err) {
      console.error('Error marcando completado:', err)
    }
  }

  async function reprogramar(id: string) {
    if (!nuevaFecha) return
    try {
      const runMs = Date.parse(`${nuevaFecha}T${nuevaHora}:00-03:00`)
      if (!Number.isFinite(runMs)) return
      await updateDoc(doc(db, 'mensajes_programados', id), {
        runAt: Timestamp.fromMillis(runMs),
        estado: 'pendiente',
        actualizadoEn: serverTimestamp(),
      })
      setReprogramando(null)
      setNuevaFecha('')
      setNuevaHora('14:00')
    } catch (err) {
      console.error('Error reprogramando:', err)
    }
  }

  function estadoBadge(seg: Seguimiento) {
    if (seg.estado === 'enviado') return { label: 'Enviado', color: 'bg-green-100 text-green-700' }
    if (seg.estado === 'completado_manual') return { label: 'Completado', color: 'bg-blue-100 text-blue-700' }
    if (seg.estado === 'error') return { label: 'Error', color: 'bg-red-100 text-red-700' }
    if (seg.estado === 'omitido_silencio') return { label: 'Omitido (silencio)', color: 'bg-slate-100 text-slate-600' }
    if (seg.runAt < ahora) return { label: 'Vencido', color: 'bg-red-100 text-red-700' }
    const diffH = (seg.runAt.getTime() - ahora.getTime()) / 3600000
    if (diffH <= 24) return { label: 'Hoy / Próximo', color: 'bg-amber-100 text-amber-700' }
    return { label: 'Programado', color: 'bg-blue-50 text-blue-700' }
  }

  function origenLabel(origen: string) {
    if (origen === 'gemini_seguimiento') return 'Vicky (auto)'
    if (origen === 'gemini_agendar') return 'Vicky (agendar)'
    if (origen === 'dashboard') return 'Dashboard'
    if (origen === 'dashboard_seguimiento') return 'Dashboard'
    return origen
  }

  const TABS: { key: TabFilter; label: string; count: number; color: string }[] = [
    { key: 'vencidos', label: 'Vencidos', count: counts.vencidos, color: 'text-red-600' },
    { key: 'pendientes', label: 'Pendientes', count: counts.pendientes, color: 'text-amber-600' },
    { key: 'enviados', label: 'Enviados', count: counts.enviados, color: 'text-green-600' },
    { key: 'todos', label: 'Todos', count: counts.total, color: 'text-slate-600' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-8 py-6 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-7 h-7 text-brand-600" />
              Seguimientos CRM
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Mensajes programados, seguimientos automáticos de Vicky y recordatorios manuales.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'card p-4 flex items-center gap-3 transition-all cursor-pointer border-2',
                tab === t.key ? 'border-brand-400 bg-brand-50/30' : 'border-transparent hover:border-slate-200'
              )}
            >
              <span className={cn('text-2xl font-bold', t.color)}>{t.count}</span>
              <span className="text-sm text-slate-600 font-medium">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Buscar por nombre, teléfono o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="p-6 space-y-3 max-w-5xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <CalendarClock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No hay seguimientos en esta vista.</p>
          </div>
        ) : (
          filtered.map((seg) => {
            const badge = estadoBadge(seg)
            const esVencido = seg.estado === 'pendiente' && seg.runAt < ahora
            const esPendiente = seg.estado === 'pendiente'

            return (
              <div
                key={seg.id}
                className={cn(
                  'card p-5 flex flex-col sm:flex-row sm:items-start gap-4 transition-all',
                  esVencido && 'border-red-200 bg-red-50/30'
                )}
              >
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
                  esVencido ? 'bg-red-100' : esPendiente ? 'bg-amber-100' : 'bg-green-100'
                )}>
                  {esVencido ? (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  ) : esPendiente ? (
                    <Clock className="w-5 h-5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-slate-400" />
                      {seg.nombreCliente || getTelFromJid(seg.jid)}
                    </h3>
                    <span className={cn('badge text-[10px] px-2 py-0.5 rounded', badge.color)}>
                      {badge.label}
                    </span>
                    <span className="badge text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                      {origenLabel(seg.origen)}
                    </span>
                  </div>

                  {seg.motivoSeguimiento && (
                    <p className="text-sm text-slate-700 mb-1 font-medium">{seg.motivoSeguimiento}</p>
                  )}
                  <p className="text-sm text-slate-500 line-clamp-2">{seg.texto}</p>

                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="w-3.5 h-3.5" />
                      {format(seg.runAt, "d 'de' MMM, yyyy HH:mm", { locale: es })}
                      {' '}({formatRelative(seg.runAt)})
                    </span>
                    {seg.creadoEn && (
                      <span>Creado {formatRelative(seg.creadoEn)}</span>
                    )}
                  </div>

                  {reprogramando === seg.id && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <input
                        type="date"
                        className="input text-sm"
                        value={nuevaFecha}
                        onChange={(e) => setNuevaFecha(e.target.value)}
                      />
                      <input
                        type="time"
                        className="input text-sm w-28"
                        value={nuevaHora}
                        onChange={(e) => setNuevaHora(e.target.value)}
                      />
                      <button
                        onClick={() => reprogramar(seg.id)}
                        className="btn-primary text-sm rounded-full px-4 py-1.5"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setReprogramando(null)}
                        className="btn-secondary text-sm rounded-full px-4 py-1.5"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {esPendiente && reprogramando !== seg.id && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => marcarCompletado(seg.id)}
                      title="Marcar como completado"
                      className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setReprogramando(seg.id)
                        setNuevaFecha(format(seg.runAt, 'yyyy-MM-dd'))
                        setNuevaHora(format(seg.runAt, 'HH:mm'))
                      }}
                      title="Reprogramar"
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
