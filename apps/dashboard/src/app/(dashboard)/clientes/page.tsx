'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'
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

const ESTADOS = ['todos', 'nuevo', 'cotizacion_enviada', 'confirmado', 'cliente']
const SERVICIOS = ['todos', 'lena', 'cerco', 'pergola', 'fogonero', 'bancos', 'madera']
const POTENCIALES = ['todos', 'frio', 'tibio', 'caliente']
const STATUS_CRM = ['todos', 'pendiente_cotizacion', 'seguimiento', 'concreto', 'en_obra']

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtered, setFiltered] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [servicioFilter, setServicioFilter] = useState('todos')
  const [potencialFilter, setPotencialFilter] = useState('todos')
  const [statusCrmFilter, setStatusCrmFilter] = useState('todos')
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
          fechaUltimoContacto: d.fechaUltimoContacto?.toDate(),
          fechaPrimerContacto: d.fechaPrimerContacto?.toDate(),
          potencial: d.potencial,
          statusCrm: d.statusCrm,
          urgencia: d.urgencia,
          interes: Array.isArray(d.interes) ? d.interes : [],
          proximoContactoAt: d.proximoContactoAt?.toDate(),
        }
      })
      setClientes(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

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
    if (potencialFilter !== 'todos') result = result.filter((c) => c.potencial === potencialFilter)
    if (statusCrmFilter !== 'todos') result = result.filter((c) => c.statusCrm === statusCrmFilter)
    setFiltered(result)
  }, [clientes, search, estadoFilter, servicioFilter, potencialFilter, statusCrmFilter])

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
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {clientes.length} clientes registrados · {clientes.filter((c) => c.estado === 'cliente').length} recurrentes
          </p>
        </div>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5">
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Nuevos', count: clientes.filter((c) => !c.estado || c.estado === 'nuevo').length, color: 'bg-slate-100 text-slate-600' },
          { label: 'Con cotización', count: clientes.filter((c) => c.estado === 'cotizacion_enviada').length, color: 'bg-blue-100 text-blue-700' },
          { label: 'Confirmados', count: clientes.filter((c) => c.estado === 'confirmado').length, color: 'bg-green-100 text-green-700' },
          { label: 'Clientes', count: clientes.filter((c) => c.estado === 'cliente').length, color: 'bg-brand-100 text-brand-700' },
          { label: 'Seguimiento', count: clientes.filter((c) => c.statusCrm === 'seguimiento').length, color: 'bg-amber-100 text-amber-700' },
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
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Pago</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Pedidos</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Último contacto</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((cliente) => (
                <tr key={cliente.tel} className="hover:bg-slate-50 transition-colors">
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
                        <span className="badge text-xs bg-amber-50 text-amber-700">{cliente.potencial}</span>
                      )}
                      {cliente.statusCrm && (
                        <p className="text-xs text-slate-500">{cliente.statusCrm.replaceAll('_', ' ')}</p>
                      )}
                      {cliente.interes && cliente.interes.length > 0 && (
                        <p className="text-xs text-slate-400">{cliente.interes.slice(0, 2).join(', ')}</p>
                      )}
                    </div>
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
                    <Link
                      href={`/clientes/${encodeURIComponent(cliente.tel)}`}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
