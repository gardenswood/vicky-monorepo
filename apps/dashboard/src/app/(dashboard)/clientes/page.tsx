'use client'
export const dynamic = 'force-dynamic'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { addDoc, collection, query, orderBy, onSnapshot, where, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  Search,
  Users,
  Filter,
  Download,
  MapPin,
  Package,
  Clock,
  Phone,
  Plus,
} from 'lucide-react'
import {
  formatRelative,
  getInitials,
  SERVICIO_LABELS,
  ESTADO_COLORS,
  ESTADO_LABELS,
  cn,
} from '@/lib/utils'
import Link from 'next/link'

interface Cliente {
  tel: string
  remoteJid: string
  nombre?: string
  zona?: string
  metodoPago?: string
  estado?: string
  servicioPendiente?: string
  pedidosAnteriores?: { servicio: string; descripcion: string }[]
  fechaUltimoContacto?: Date
  fechaPrimerContacto?: Date
  potencial?: string
  statusCrm?: string
  urgencia?: string
  interes?: string[]
  proximoContactoAt?: Date
}

interface ConsultaLenaActiva {
  id: string
  tel: string
  remoteJid: string
  nombre: string
  zona: string
  cantidadKg: number
  estado: string
}

const ESTADOS = ['todos', 'nuevo', 'cotizacion_enviada', 'confirmado', 'cliente']
const SERVICIOS = ['todos', 'lena', 'cerco', 'pergola', 'fogonero', 'bancos', 'madera']
const POTENCIALES = ['todos', 'frio', 'tibio', 'caliente']
const STATUS_CRM = ['todos', 'pendiente_cotizacion', 'seguimiento', 'concreto', 'en_obra']

function normalizePotencial(value?: string): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function optionalDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate()
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date : undefined
  }
  return undefined
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtered, setFiltered] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [servicioFilter, setServicioFilter] = useState('todos')
  const [potencialFilter, setPotencialFilter] = useState('todos')
  const [statusCrmFilter, setStatusCrmFilter] = useState('todos')
  const [soloLenaActiva, setSoloLenaActiva] = useState(false)
  const [soloVencidos, setSoloVencidos] = useState(false)
  const [consultasLena, setConsultasLena] = useState<ConsultaLenaActiva[]>([])
  const [quickTel, setQuickTel] = useState<string | null>(null)
  const [quickForm, setQuickForm] = useState({ cantidadKg: '', zona: '', notas: '' })
  const [quickSaving, setQuickSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'clientes'), orderBy('fechaUltimoContacto', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const data: Cliente[] = snap.docs.map((doc) => {
        const d = doc.data()
        return {
          tel: doc.id,
          remoteJid: d.remoteJid || `${doc.id}@s.whatsapp.net`,
          nombre: d.nombre,
          zona: d.zona,
          metodoPago: d.metodoPago,
          estado: d.estado,
          servicioPendiente: d.servicioPendiente,
          pedidosAnteriores: d.pedidosAnteriores || [],
          fechaUltimoContacto: optionalDate(d.fechaUltimoContacto),
          fechaPrimerContacto: optionalDate(d.fechaPrimerContacto),
          potencial: d.potencial,
          statusCrm: d.statusCrm,
          urgencia: d.urgencia,
          interes: Array.isArray(d.interes) ? d.interes : [],
          proximoContactoAt: optionalDate(d.proximoContactoAt),
        }
      })
      setClientes(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const q = query(
      collection(db, 'consultasLena'),
      where('estado', 'in', ['pendiente', 'zona_lista', 'admin_notificado', 'confirmado'])
    )
    const unsub = onSnapshot(q, (snap) => {
      setConsultasLena(
        snap.docs.map((docSnap) => {
          const d = docSnap.data()
          const remoteJid = String(d.remoteJid ?? '')
          return {
            id: docSnap.id,
            tel: String(d.tel ?? remoteJid.replace('@s.whatsapp.net', '')),
            remoteJid,
            nombre: String(d.nombre ?? ''),
            zona: String(d.zona ?? 'Sin zona'),
            cantidadKg: Number(d.cantidadKg ?? 0),
            estado: String(d.estado ?? 'pendiente'),
          }
        })
      )
    })
    return () => unsub()
  }, [])

  const consultasByTel = useMemo(() => {
    const map = new Map<string, ConsultaLenaActiva[]>()
    consultasLena.forEach((consulta) => {
      const keys = [consulta.tel, consulta.remoteJid.replace('@s.whatsapp.net', '')].filter(Boolean)
      keys.forEach((key) => map.set(key, [...(map.get(key) ?? []), consulta]))
    })
    return map
  }, [consultasLena])

  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const seguimientosVencidos = clientes.filter((c) => c.proximoContactoAt && c.proximoContactoAt < todayStart).length
  const clientesConConsultaLena = new Set(consultasLena.map((c) => c.tel)).size
  const consultasLenaPotenciales = clientes.filter(
    (c) => c.interes?.some((i) => i.toLowerCase().includes('lena') || i.toLowerCase().includes('leña')) && c.estado !== 'confirmado'
  ).length

  function leadPriority(cliente: Cliente): number {
    const potencial = normalizePotencial(cliente.potencial)
    let score = 0
    if (cliente.proximoContactoAt && cliente.proximoContactoAt < todayStart) score += 100
    if (cliente.statusCrm === 'seguimiento') score += 30
    if (potencial === 'caliente') score += 25
    if (cliente.urgencia === 'alta') score += 20
    if (cliente.estado === 'cotizacion_enviada') score += 10
    return score
  }

  useEffect(() => {
    let result = [...clientes]
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.nombre?.toLowerCase().includes(s) ||
          c.tel.includes(s) ||
          c.zona?.toLowerCase().includes(s) ||
          c.interes?.some((i) => i.toLowerCase().includes(s))
      )
    }
    if (estadoFilter !== 'todos') result = result.filter((c) => c.estado === estadoFilter)
    if (servicioFilter !== 'todos') result = result.filter((c) => c.servicioPendiente === servicioFilter)
    if (potencialFilter !== 'todos') result = result.filter((c) => normalizePotencial(c.potencial) === potencialFilter)
    if (statusCrmFilter !== 'todos') result = result.filter((c) => c.statusCrm === statusCrmFilter)
    if (soloLenaActiva) result = result.filter((c) => (consultasByTel.get(c.tel)?.length ?? 0) > 0)
    if (soloVencidos) result = result.filter((c) => !!c.proximoContactoAt && c.proximoContactoAt < todayStart)
    result.sort((a, b) => {
      const priorityDiff = leadPriority(b) - leadPriority(a)
      if (priorityDiff !== 0) return priorityDiff
      return (b.fechaUltimoContacto?.getTime() ?? 0) - (a.fechaUltimoContacto?.getTime() ?? 0)
    })
    setFiltered(result)
  }, [clientes, search, estadoFilter, servicioFilter, potencialFilter, statusCrmFilter, soloLenaActiva, soloVencidos, consultasByTel, todayStart])

  function potencialClass(potencial?: string) {
    const normalized = normalizePotencial(potencial)
    if (normalized === 'frio') return 'bg-sky-50 text-sky-700'
    if (normalized === 'tibio') return 'bg-yellow-50 text-yellow-700'
    if (normalized === 'caliente') return 'bg-orange-100 text-orange-700'
    return 'bg-slate-100 text-slate-600'
  }

  function openQuickConsulta(cliente: Cliente) {
    setQuickTel(cliente.tel)
    setQuickForm({ cantidadKg: '', zona: cliente.zona ?? '', notas: '' })
  }

  async function saveQuickConsulta(cliente: Cliente) {
    const kg = Number(quickForm.cantidadKg)
    if (!Number.isFinite(kg) || kg < 1 || kg > 499 || !quickForm.zona.trim()) return
    setQuickSaving(true)
    try {
      await addDoc(collection(db, 'consultasLena'), {
        remoteJid: cliente.remoteJid || `${cliente.tel}@s.whatsapp.net`,
        tel: cliente.tel,
        nombre: cliente.nombre || 'Sin nombre',
        zona: quickForm.zona.trim(),
        cantidadKg: Math.round(kg),
        notas: quickForm.notas.trim() || null,
        fechaConsulta: serverTimestamp(),
        estado: 'pendiente',
        origen: 'dashboard_clientes',
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      })
      setQuickTel(null)
      setQuickForm({ cantidadKg: '', zona: '', notas: '' })
    } finally {
      setQuickSaving(false)
    }
  }

  function exportCSV() {
    const headers = ['Teléfono', 'Nombre', 'Zona', 'Estado', 'Servicio', 'Potencial', 'CRM', 'Intereses', 'Próximo contacto', 'Pago', 'Último contacto', 'Pedidos']
    const rows = filtered.map((c) => [
      c.tel,
      c.nombre ?? '',
      c.zona ?? '',
      ESTADO_LABELS[c.estado ?? ''] ?? c.estado ?? '',
      SERVICIO_LABELS[c.servicioPendiente ?? ''] ?? c.servicioPendiente ?? '',
      c.potencial ?? '',
      c.statusCrm ?? '',
      c.interes?.join('|') ?? '',
      c.proximoContactoAt?.toLocaleDateString('es') ?? '',
      c.metodoPago ?? '',
      c.fechaUltimoContacto?.toLocaleDateString('es') ?? '',
      (c.pedidosAnteriores?.length ?? 0).toString(),
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clientes_gardens_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM Ventas</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Cerebro comercial de Vicky: atenciones, leads, seguimientos, intereses y remarketing. {clientes.length} contactos registrados - {clientes.filter((c) => c.estado === 'cliente').length} clientes recurrentes
          </p>
        </div>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5">
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-3 mb-5">
        {[
          { label: 'Nuevos', count: clientes.filter((c) => !c.estado || c.estado === 'nuevo').length, color: 'bg-slate-100 text-slate-600' },
          { label: 'Con cotización', count: clientes.filter((c) => c.estado === 'cotizacion_enviada').length, color: 'bg-blue-100 text-blue-700' },
          { label: 'Confirmados', count: clientes.filter((c) => c.estado === 'confirmado').length, color: 'bg-green-100 text-green-700' },
          { label: 'Clientes', count: clientes.filter((c) => c.estado === 'cliente').length, color: 'bg-brand-100 text-brand-700' },
          { label: 'Seguimiento', count: clientes.filter((c) => c.statusCrm === 'seguimiento').length, color: 'bg-amber-100 text-amber-700' },
          { label: 'Vencidos', count: seguimientosVencidos, color: 'bg-red-100 text-red-700' },
          { label: 'Consultas leña', count: consultasLenaPotenciales, color: 'bg-amber-100 text-amber-700' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <span className={`badge text-sm px-2.5 py-1 ${s.color}`}>{s.label}</span>
            <span className="text-2xl font-bold text-slate-900">{s.count}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Buscar por nombre, teléfono o zona..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select className="input" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e === 'todos' ? 'Todos los estados' : ESTADO_LABELS[e] ?? e}
              </option>
            ))}
          </select>
          <select className="input" value={servicioFilter} onChange={(e) => setServicioFilter(e.target.value)}>
            {SERVICIOS.map((s) => (
              <option key={s} value={s}>
                {s === 'todos' ? 'Todos los servicios' : SERVICIO_LABELS[s] ?? s}
              </option>
            ))}
          </select>
          <select className="input" value={potencialFilter} onChange={(e) => setPotencialFilter(e.target.value)}>
            {POTENCIALES.map((p) => (
              <option key={p} value={p}>
                {p === 'todos' ? 'Todo potencial' : p}
              </option>
            ))}
          </select>
          <select className="input" value={statusCrmFilter} onChange={(e) => setStatusCrmFilter(e.target.value)}>
            {STATUS_CRM.map((s) => (
              <option key={s} value={s}>
                {s === 'todos' ? 'Todo CRM' : s.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setSoloVencidos((v) => !v)}
          className={cn(
            'badge px-3 py-2 border transition-colors',
            soloVencidos
              ? 'bg-red-100 text-red-800 border-red-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          )}
        >
          Tareas vencidas ({seguimientosVencidos})
        </button>
        <button
          type="button"
          onClick={() => setSoloLenaActiva((v) => !v)}
          className={cn(
            'badge px-3 py-2 border transition-colors',
            soloLenaActiva
              ? 'bg-amber-100 text-amber-800 border-amber-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          )}
        >
          Con consulta leña activa ({clientesConConsultaLena})
        </button>
      </div>

      {/* Clients table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {clientes.length === 0 ? 'No hay clientes registrados aún' : 'No hay clientes que coincidan con los filtros'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Cliente</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Zona</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Estado</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Servicio</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">CRM</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Leña</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Pago</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Pedidos</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Último contacto</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((cliente) => {
                const consultasCliente = consultasByTel.get(cliente.tel) ?? []
                const consultaPrincipal = consultasCliente[0]
                const vencido = cliente.proximoContactoAt && cliente.proximoContactoAt < todayStart
                return (
                <Fragment key={cliente.tel}>
                <tr className="group hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-brand-700 text-sm font-semibold">
                          {getInitials(cliente.nombre)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {cliente.nombre || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {cliente.tel}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      {cliente.zona && <MapPin className="w-3.5 h-3.5 text-slate-400" />}
                      {cliente.zona || <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    {cliente.estado ? (
                      <span className={cn('badge text-xs', ESTADO_COLORS[cliente.estado] ?? 'bg-slate-100 text-slate-600')}>
                        {ESTADO_LABELS[cliente.estado] ?? cliente.estado}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    {cliente.servicioPendiente ? (
                      <span className="text-sm text-slate-700">
                        {SERVICIO_LABELS[cliente.servicioPendiente] ?? cliente.servicioPendiente}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <div className="space-y-1">
                      {cliente.potencial && (
                        <span className={cn('badge text-xs', potencialClass(cliente.potencial))}>{cliente.potencial}</span>
                      )}
                      {cliente.statusCrm && (
                        <p className="text-xs text-slate-500">{cliente.statusCrm.replaceAll('_', ' ')}</p>
                      )}
                      {vencido && (
                        <span className="badge text-xs bg-red-100 text-red-700">Vencido</span>
                      )}
                      {cliente.interes && cliente.interes.length > 0 && (
                        <p className="text-xs text-slate-400">{cliente.interes.slice(0, 2).join(', ')}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    {consultaPrincipal ? (
                      <div className="space-y-1">
                        <span className="badge text-xs bg-amber-100 text-amber-700">
                          Leña {consultaPrincipal.zona} · {consultasCliente.reduce((sum, c) => sum + c.cantidadKg, 0)}kg
                        </span>
                        {consultasCliente.length > 1 && <p className="text-xs text-slate-400">{consultasCliente.length} consultas</p>}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-slate-600 capitalize">
                    {cliente.metodoPago || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1 text-sm text-slate-700">
                      <Package className="w-3.5 h-3.5 text-slate-400" />
                      {cliente.pedidosAnteriores?.length ?? 0}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {formatRelative(cliente.fechaUltimoContacto)}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openQuickConsulta(cliente)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1 transition-opacity"
                      >
                        <Plus className="w-3 h-3" />
                        Consulta
                      </button>
                      <Link
                        href={`/clientes/${encodeURIComponent(cliente.tel)}`}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                      >
                        Ver →
                      </Link>
                    </div>
                  </td>
                </tr>
                {quickTel === cliente.tel && (
                  <tr>
                    <td colSpan={10} className="px-5 py-4 bg-amber-50/60">
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="label">Kg</label>
                          <input
                            type="number"
                            min={1}
                            max={499}
                            className="input w-28"
                            value={quickForm.cantidadKg}
                            onChange={(e) => setQuickForm((f) => ({ ...f, cantidadKg: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="label">Zona</label>
                          <input
                            className="input w-48"
                            value={quickForm.zona}
                            onChange={(e) => setQuickForm((f) => ({ ...f, zona: e.target.value }))}
                          />
                        </div>
                        <div className="flex-1 min-w-48">
                          <label className="label">Notas</label>
                          <input
                            className="input"
                            value={quickForm.notas}
                            onChange={(e) => setQuickForm((f) => ({ ...f, notas: e.target.value }))}
                          />
                        </div>
                        <button onClick={() => saveQuickConsulta(cliente)} disabled={quickSaving} className="btn-primary">
                          {quickSaving ? 'Guardando...' : 'Guardar consulta'}
                        </button>
                        <button onClick={() => setQuickTel(null)} className="btn-secondary">Cancelar</button>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
