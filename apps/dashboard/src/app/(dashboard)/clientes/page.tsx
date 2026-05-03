'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { LeadDrawer } from '@/components/LeadDrawer'
import {
  Search,
  Filter,
  Download,
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  Maximize2,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react'
import {
  formatRelative,
  getInitials,
  ESTADO_COLORS,
  ESTADO_LABELS,
  cn,
  getDisplayName,
  getDisplayPhone,
  getIdentitySecondary,
  getTelFromJid,
} from '@/lib/utils'
import Link from 'next/link'

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
  notas?: string
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

const COLUMNS = ['capturados', 'clasificando', 'cualificados', 'vendiendo', 'ganado', 'perdido']

const SERVICIOS = ['todos', 'lena', 'cerco', 'pergola', 'fogonero', 'bancos', 'madera']
const POTENCIALES = ['todos', 'frio', 'tibio', 'caliente']
const STATUS_CRM = ['todos', 'pendiente_cotizacion', 'seguimiento', 'concreto', 'en_obra', 'perdido', 'desestimado']
const ORDENES = ['recientes', 'estado_lead'] as const

const STATUS_CRM_LABELS: Record<string, string> = {
  pendiente_cotizacion: '⏱️ Pendiente cotización',
  seguimiento: '👀 Seguimiento',
  concreto: '🎯 Concreto',
  en_obra: '🚧 En obra',
  perdido: '❌ Perdido',
  desestimado: '👎 Desestimado',
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
  
  const [selectedLead, setSelectedLead] = useState<Cliente | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

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
          estado: d.estado || 'capturados', // Default state
          servicioPendiente: d.servicioPendiente,
          pedidosAnteriores: d.pedidosAnteriores || [],
          fechaUltimoContacto: optionalDate(d.fechaUltimoContacto),
          fechaPrimerContacto: optionalDate(d.fechaPrimerContacto),
          potencial: d.potencial,
          statusCrm: d.statusCrm,
          urgencia: d.urgencia,
          interes: Array.isArray(d.interes) ? d.interes : [],
          proximoContactoAt: optionalDate(d.proximoContactoAt),
          notas: d.notas,
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

  const todayEnd = useMemo(() => {
    const d = new Date()
    d.setHours(23, 59, 59, 999)
    return d
  }, [])

  const seguimientosVencidos = clientes.filter((c) => c.proximoContactoAt && c.proximoContactoAt < todayStart).length
  const seguimientosHoy = clientes.filter((c) => c.proximoContactoAt && c.proximoContactoAt >= todayStart && c.proximoContactoAt <= todayEnd).length
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
      servicioPrincipal(c) ?? '',
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

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newEstado = destination.droppableId

    // Optimistic update
    setClientes((prev) =>
      prev.map((c) => (c.tel === draggableId ? { ...c, estado: newEstado } : c))
    )

    try {
      const docRef = doc(db, 'clientes', draggableId)
      await updateDoc(docRef, { estado: newEstado })
    } catch (error) {
      console.error('Error updating status:', error)
      // Revert on error (could be improved)
    }
  }

  const openLeadDetails = (cliente: Cliente) => {
    setSelectedLead(cliente)
    setIsDrawerOpen(true)
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">CRM Ventas</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Cerebro comercial de Vicky: atenciones, leads, seguimientos, intereses y remarketing. {clientes.length} contactos registrados - {clientes.filter((c) => c.estado === 'ganado').length} clientes recurrentes
            </p>
          </div>
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-5">
          {[
            { label: 'Nuevos', count: clientes.filter((c) => !c.estado || c.estado === 'capturados').length, color: 'bg-slate-100 text-slate-600' },
            { label: 'Clasificando', count: clientes.filter((c) => c.estado === 'clasificando').length, color: 'bg-fuchsia-100 text-fuchsia-700' },
            { label: 'Calientes', count: clientes.filter((c) => normalizePotencial(c.potencial) === 'caliente').length, color: 'bg-orange-100 text-orange-700' },
            { label: 'Seguimiento', count: clientes.filter((c) => c.statusCrm === 'seguimiento').length, color: 'bg-amber-100 text-amber-700' },
            { label: 'Concretos', count: clientes.filter((c) => c.statusCrm === 'concreto').length, color: 'bg-green-100 text-green-700' },
            { label: 'En obra', count: clientes.filter((c) => c.statusCrm === 'en_obra').length, color: 'bg-purple-100 text-purple-700' },
            { label: 'Hoy', count: seguimientosHoy, color: 'bg-indigo-100 text-indigo-700' },
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
              {['todos', ...COLUMNS].map((e) => (
                <option key={e} value={e}>
                  {e === 'todos' ? 'Todos los estados' : ESTADO_LABELS[e] ?? e}
                </option>
              ))}
            </select>
            <select className="input" value={servicioFilter} onChange={(e) => setServicioFilter(e.target.value)}>
              {SERVICIOS.map((s) => (
                <option key={s} value={s}>
                  {s === 'todos' ? 'Todos los servicios' : s}
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
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {loading ? (
          <div className="flex gap-6 h-full">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-80 flex-shrink-0 bg-slate-100/50 rounded-xl border border-slate-200/60 p-4 h-full animate-pulse" />
            ))}
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-6 h-full pb-4">
              {COLUMNS.map((colId) => {
                const columnLeads = filtered.filter((c) => c.estado === colId)
                return (
                  <div key={colId} className="w-80 flex-shrink-0 flex flex-col max-h-full">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                        <div className={cn('w-2.5 h-2.5 rounded-full', ESTADO_COLORS[colId]?.split(' ')[0] || 'bg-slate-300')} />
                        {ESTADO_LABELS[colId] || colId}
                      </h3>
                      <span className="text-xs font-medium text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full">
                        {columnLeads.length}
                      </span>
                    </div>

                    <Droppable droppableId={colId}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            'flex-1 overflow-y-auto bg-slate-100/50 rounded-xl border border-slate-200/60 p-3 space-y-3 transition-colors',
                            snapshot.isDraggingOver && 'bg-slate-200/50 border-slate-300'
                          )}
                        >
                          {columnLeads.map((lead, index) => {
                            const telefonoVisible = getDisplayPhone(lead)
                            const consultasCliente = consultasByTel.get(lead.tel) ?? (telefonoVisible ? consultasByTel.get(telefonoVisible) : undefined) ?? []
                            const vencido = lead.proximoContactoAt && lead.proximoContactoAt < todayStart
                            const seguimientoHoyLead = lead.proximoContactoAt && lead.proximoContactoAt >= todayStart && lead.proximoContactoAt <= todayEnd
                            const nombreVisible = getDisplayName(lead)

                            return (
                              <Draggable key={lead.tel} draggableId={lead.tel} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => openLeadDetails(lead)}
                                    className={cn(
                                      'bg-white p-4 rounded-lg border border-slate-200 shadow-sm cursor-pointer group hover:border-brand-300 hover:shadow-md transition-all',
                                      snapshot.isDragging && 'shadow-xl ring-2 ring-brand-500/20 rotate-2'
                                    )}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                                        <span className="text-brand-700 text-sm font-semibold">
                                          {getInitials(nombreVisible)}
                                        </span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-600 transition-colors">
                                          {nombreVisible}
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                          <Phone className="w-3 h-3" />
                                          {telefonoVisible || getIdentitySecondary(lead)}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      {lead.statusCrm && (
                                        <span className={cn('badge text-[10px] px-1.5 py-0.5 rounded', STATUS_CRM_COLORS[lead.statusCrm] ?? 'bg-slate-100 text-slate-600')}>
                                          {crmLabel(lead.statusCrm)}
                                        </span>
                                      )}
                                      {lead.potencial && (
                                        <span className={cn('badge text-[10px] px-1.5 py-0.5 rounded', potencialClass(lead.potencial))}>
                                          {lead.potencial}
                                        </span>
                                      )}
                                      {vencido && (
                                        <span className="badge text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">Vencido</span>
                                      )}
                                      {seguimientoHoyLead && (
                                        <span className="badge text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 flex items-center gap-1">
                                          <CalendarClock className="w-3 h-3" /> Hoy
                                        </span>
                                      )}
                                      {consultasCliente.length > 0 && (
                                        <span className="badge text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3" /> Leña
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-3 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {lead.zona && (
                                          <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                            <MapPin className="w-3 h-3" />
                                            <span className="truncate max-w-[80px]">{lead.zona}</span>
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                        <Clock className="w-3 h-3" />
                                        {formatRelative(lead.fechaUltimoContacto)}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            )
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      <LeadDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        cliente={selectedLead}
      />
    </div>
  )
}
