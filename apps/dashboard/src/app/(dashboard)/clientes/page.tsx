'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
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
  Maximize2,
} from 'lucide-react'
import {
  formatRelative,
  getInitials,
  SERVICIO_LABELS,
  ESTADO_COLORS,
  ESTADO_LABELS,
  cn,
  getDisplayName,
  getDisplayPhone,
  getIdentitySecondary,
  getTelFromJid,
} from '@/lib/utils'
import Link from 'next/link'
import ClienteDetailModal from '@/components/clientes/ClienteDetailModal'

interface Cliente {
  tel: string
  remoteJid: string
  telefono?: string
  pushName?: string
  whatsappLid?: string
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
const STATUS_CRM = ['todos', 'pendiente_cotizacion', 'seguimiento', 'concreto', 'en_obra', 'perdido', 'desestimado']
const ORDENES = ['recientes', 'estado_lead'] as const

const STATUS_CRM_LABELS: Record<string, string> = {
  pendiente_cotizacion: 'Pendiente cotización',
  seguimiento: 'Seguimiento',
  concreto: 'Concreto',
  en_obra: 'En obra',
  perdido: 'Perdido',
  desestimado: 'Desestimado',
}

const STATUS_CRM_COLORS: Record<string, string> = {
  pendiente_cotizacion: 'bg-blue-50 text-blue-700',
  seguimiento: 'bg-amber-50 text-amber-700',
  concreto: 'bg-green-50 text-green-700',
  en_obra: 'bg-purple-50 text-purple-700',
  perdido: 'bg-red-50 text-red-700 border border-red-200',
  desestimado: 'bg-slate-200 text-slate-700 border border-slate-300',
}

const STATUS_CRM_ORDER: Record<string, number> = {
  pendiente_cotizacion: 0,
  seguimiento: 1,
  concreto: 2,
  en_obra: 3,
  perdido: 4,
  desestimado: 5,
}

const SERVICIO_ALIASES: Record<string, string> = {
  lena: 'lena',
  leña: 'lena',
  cerco: 'cerco',
  cercos: 'cerco',
  pergola: 'pergola',
  pergolas: 'pergola',
  fogonero: 'fogonero',
  bancos: 'bancos',
  banco: 'bancos',
  madera: 'madera',
  maderas: 'madera',
}

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

function crmLabel(value?: string): string {
  if (!value) return 'Sin estado CRM'
  return STATUS_CRM_LABELS[value] ?? value.replaceAll('_', ' ')
}

function normalizeServicio(value?: string): string {
  const normalized = (value ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  return SERVICIO_ALIASES[normalized] ?? normalized
}

function servicioPrincipal(cliente: Cliente): string | undefined {
  const servicio = normalizeServicio(cliente.servicioPendiente || cliente.interes?.[0])
  return servicio || undefined
}

function clienteTieneServicio(cliente: Cliente, servicio: string): boolean {
  return normalizeServicio(cliente.servicioPendiente) === servicio || !!cliente.interes?.some((i) => normalizeServicio(i) === servicio)
}

function statusRank(value?: string): number {
  return STATUS_CRM_ORDER[value ?? ''] ?? 99
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtered, setFiltered] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [servicioFilter, setServicioFilter] = useState('todos')
  const [potencialFilter, setPotencialFilter] = useState('todos')
  const [statusCrmFilter, setStatusCrmFilter] = useState('todos')
  const [orden, setOrden] = useState<(typeof ORDENES)[number]>('recientes')
  const [soloLenaActiva, setSoloLenaActiva] = useState(false)
  const [soloVencidos, setSoloVencidos] = useState(false)
  const [consultasLena, setConsultasLena] = useState<ConsultaLenaActiva[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClienteTel, setSelectedClienteTel] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'clientes'), orderBy('fechaUltimoContacto', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const data: Cliente[] = snap.docs.map((doc) => {
        const d = doc.data()
        return {
          tel: doc.id,
          remoteJid: d.remoteJid || `${doc.id}@s.whatsapp.net`,
          telefono: d.telefono,
          pushName: d.pushName,
          whatsappLid: d.whatsappLid,
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
            tel: String(d.tel ?? getTelFromJid(remoteJid)),
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
      const keys = [consulta.tel, getTelFromJid(consulta.remoteJid)].filter(Boolean)
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

  useEffect(() => {
    let result = [...clientes]
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (c) =>
          getDisplayName(c).toLowerCase().includes(s) ||
          c.tel.includes(s) ||
          c.telefono?.includes(s) ||
          c.pushName?.toLowerCase().includes(s) ||
          c.remoteJid?.toLowerCase().includes(s) ||
          c.whatsappLid?.includes(s) ||
          getDisplayPhone(c).includes(s) ||
          getIdentitySecondary(c).toLowerCase().includes(s) ||
          c.zona?.toLowerCase().includes(s) ||
          c.servicioPendiente?.toLowerCase().includes(s) ||
          c.statusCrm?.toLowerCase().includes(s) ||
          c.interes?.some((i) => i.toLowerCase().includes(s))
      )
    }
    if (estadoFilter !== 'todos') result = result.filter((c) => c.estado === estadoFilter)
    if (servicioFilter !== 'todos') result = result.filter((c) => clienteTieneServicio(c, servicioFilter))
    if (potencialFilter !== 'todos') result = result.filter((c) => normalizePotencial(c.potencial) === potencialFilter)
    if (statusCrmFilter !== 'todos') result = result.filter((c) => c.statusCrm === statusCrmFilter)
    if (soloLenaActiva) {
      result = result.filter((c) => {
        const phone = getDisplayPhone(c)
        return (consultasByTel.get(c.tel)?.length ?? 0) > 0 || (phone ? (consultasByTel.get(phone)?.length ?? 0) > 0 : false)
      })
    }
    if (soloVencidos) result = result.filter((c) => !!c.proximoContactoAt && c.proximoContactoAt < todayStart)
    result.sort((a, b) => {
      if (orden === 'estado_lead') {
        const statusDiff = statusRank(a.statusCrm) - statusRank(b.statusCrm)
        if (statusDiff !== 0) return statusDiff
      }
      return (b.fechaUltimoContacto?.getTime() ?? 0) - (a.fechaUltimoContacto?.getTime() ?? 0)
    })
    setFiltered(result)
  }, [clientes, search, estadoFilter, servicioFilter, potencialFilter, statusCrmFilter, orden, soloLenaActiva, soloVencidos, consultasByTel, todayStart])

  function potencialClass(potencial?: string) {
    const normalized = normalizePotencial(potencial)
    if (normalized === 'frio') return 'bg-sky-50 text-sky-700'
    if (normalized === 'tibio') return 'bg-yellow-50 text-yellow-700'
    if (normalized === 'caliente') return 'bg-orange-100 text-orange-700'
    return 'bg-slate-100 text-slate-600'
  }

  function exportCSV() {
    const headers = ['Teléfono', 'Nombre', 'Identificador técnico', 'Zona', 'Estado lead', 'Servicio principal', 'Potencial', 'CRM', 'Intereses', 'Próximo contacto', 'Último contacto', 'Pedidos', 'Logística leña activa']
    const rows = filtered.map((c) => [
      getDisplayPhone(c) || '',
      getDisplayName(c),
      getIdentitySecondary(c),
      c.zona ?? '',
      ESTADO_LABELS[c.estado ?? ''] ?? c.estado ?? '',
      SERVICIO_LABELS[servicioPrincipal(c) ?? ''] ?? servicioPrincipal(c) ?? '',
      c.potencial ?? '',
      c.statusCrm ?? '',
      c.interes?.join('|') ?? '',
      c.proximoContactoAt?.toLocaleDateString('es') ?? '',
      c.fechaUltimoContacto?.toLocaleDateString('es') ?? '',
      (c.pedidosAnteriores?.length ?? 0).toString(),
      ((consultasByTel.get(c.tel)?.length ?? 0) || (getDisplayPhone(c) ? (consultasByTel.get(getDisplayPhone(c))?.length ?? 0) : 0)).toString(),
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
          { label: 'Calientes', count: clientes.filter((c) => normalizePotencial(c.potencial) === 'caliente').length, color: 'bg-orange-100 text-orange-700' },
          { label: 'Seguimiento', count: clientes.filter((c) => c.statusCrm === 'seguimiento').length, color: 'bg-amber-100 text-amber-700' },
          { label: 'Concretos', count: clientes.filter((c) => c.statusCrm === 'concreto').length, color: 'bg-green-100 text-green-700' },
          { label: 'En obra', count: clientes.filter((c) => c.statusCrm === 'en_obra').length, color: 'bg-purple-100 text-purple-700' },
          { label: 'Vencidos', count: seguimientosVencidos, color: 'bg-red-100 text-red-700' },
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
          <select className="input" value={orden} onChange={(e) => setOrden(e.target.value as (typeof ORDENES)[number])}>
            {ORDENES.map((o) => (
              <option key={o} value={o}>
                {o === 'recientes' ? 'Más recientes primero' : 'Agrupar por estado lead'}
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
          Señal logística leña ({clientesConConsultaLena})
        </button>
        <Link href="/logistica-zonas" className="badge px-3 py-2 border bg-white text-amber-700 border-amber-200 hover:bg-amber-50">
          Ver reparto de leña
        </Link>
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
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Estado lead</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Servicio / interés</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">CRM comercial</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Próximo contacto</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Pedidos</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Último contacto</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((cliente) => {
                const telefonoVisible = getDisplayPhone(cliente)
                const consultasCliente = consultasByTel.get(cliente.tel) ?? (telefonoVisible ? consultasByTel.get(telefonoVisible) : undefined) ?? []
                const vencido = cliente.proximoContactoAt && cliente.proximoContactoAt < todayStart
                const servicio = servicioPrincipal(cliente)
                const nombreVisible = getDisplayName(cliente)
                const identidadSecundaria = getIdentitySecondary(cliente)
                return (
                <tr
                  key={cliente.tel}
                  className="group hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedClienteTel(cliente.tel)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-brand-700 text-sm font-semibold">
                          {getInitials(nombreVisible)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {nombreVisible}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {telefonoVisible || identidadSecundaria}
                        </p>
                        {telefonoVisible && identidadSecundaria && identidadSecundaria !== telefonoVisible && (
                          <p className="text-[11px] text-slate-400 truncate max-w-52">{identidadSecundaria}</p>
                        )}
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
                    <div className="space-y-1">
                      {servicio ? (
                        <span className="text-sm text-slate-700">
                          {SERVICIO_LABELS[servicio] ?? servicio}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                      {cliente.interes && cliente.interes.length > 0 && (
                        <p className="text-xs text-slate-400">{cliente.interes.slice(0, 3).join(', ')}</p>
                      )}
                      {consultasCliente.length > 0 && (
                        <Link href="/logistica-zonas" className="text-xs text-amber-700 hover:text-amber-800">
                          Logística leña activa ({consultasCliente.length})
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="space-y-1">
                      {cliente.statusCrm && (
                        <span className={cn('badge text-xs', STATUS_CRM_COLORS[cliente.statusCrm] ?? 'bg-slate-100 text-slate-600')}>
                          {crmLabel(cliente.statusCrm)}
                        </span>
                      )}
                      {cliente.potencial && (
                        <span className={cn('badge text-xs', potencialClass(cliente.potencial))}>{cliente.potencial}</span>
                      )}
                      {vencido && (
                        <span className="badge text-xs bg-red-100 text-red-700">Vencido</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {cliente.proximoContactoAt ? formatRelative(cliente.proximoContactoAt) : <span className="text-slate-300">—</span>}
                    </div>
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
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedClienteTel(cliente.tel)
                        }}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1.5 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-full transition-colors"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Ver
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {selectedClienteTel && (
        <ClienteDetailModal
          telDecoded={selectedClienteTel}
          onClose={() => setSelectedClienteTel(null)}
        />
      )}
    </div>
  )
}
