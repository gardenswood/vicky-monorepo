'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { LeadDrawer } from '@/components/LeadDrawer'
import {
  Search,
  Download,
  MapPin,
  Clock,
  Phone,
  AlertTriangle,
  CalendarClock,
  Flame,
  Users,
  UserCheck,
  Eye,
  Target,
  XCircle,
  Inbox,
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

const STATUS_CRM_LABELS: Record<string, string> = {
  pendiente_cotizacion: 'Pendiente cotización',
  seguimiento: 'Seguimiento',
  concreto: 'Concreto',
  perdido: 'Perdido',
  desestimado: 'Desestimado',
}

const STATUS_CRM_COLORS: Record<string, string> = {
  pendiente_cotizacion: 'bg-blue-50 text-blue-700 border border-blue-200',
  seguimiento: 'bg-amber-50 text-amber-700 border border-amber-200',
  concreto: 'bg-green-50 text-green-700 border border-green-200',
  perdido: 'bg-red-50 text-red-700 border border-red-200',
  desestimado: 'bg-slate-200 text-slate-600 border border-slate-300',
}

const STATUS_CRM_ORDER: Record<string, number> = {
  pendiente_cotizacion: 0,
  seguimiento: 1,
  concreto: 2,
  perdido: 3,
  desestimado: 4,
}

const SERVICIO_ALIASES: Record<string, string> = {
  lena: 'lena', leña: 'lena',
  cerco: 'cerco', cercos: 'cerco',
  pergola: 'pergola', pergolas: 'pergola',
  fogonero: 'fogonero',
  bancos: 'bancos', banco: 'bancos',
  madera: 'madera', maderas: 'madera',
}

function normalizePotencial(value?: string): string {
  return (value ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
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
  if (!value) return ''
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

type StatFilter = null | 'nuevos' | 'calientes' | 'seguimiento' | 'concretos' | 'vencidos' | 'hoy'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtered, setFiltered] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [servicioFilter, setServicioFilter] = useState('todos')
  const [activeStatFilter, setActiveStatFilter] = useState<StatFilter>(null)
  const [soloLenaActiva, setSoloLenaActiva] = useState(false)
  const [consultasLena, setConsultasLena] = useState<ConsultaLenaActiva[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Cliente | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'clientes'), orderBy('fechaUltimoContacto', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const data: Cliente[] = snap.docs.map((d) => {
        const raw = d.data()
        return {
          tel: d.id,
          remoteJid: raw.remoteJid || `${d.id}@s.whatsapp.net`,
          telefono: raw.telefono,
          pushName: raw.pushName,
          whatsappLid: raw.whatsappLid,
          nombre: raw.nombre,
          zona: raw.zona,
          metodoPago: raw.metodoPago,
          estado: raw.estado || 'capturados',
          servicioPendiente: raw.servicioPendiente,
          pedidosAnteriores: raw.pedidosAnteriores || [],
          fechaUltimoContacto: optionalDate(raw.fechaUltimoContacto),
          fechaPrimerContacto: optionalDate(raw.fechaPrimerContacto),
          potencial: raw.potencial,
          statusCrm: raw.statusCrm,
          urgencia: raw.urgencia,
          interes: Array.isArray(raw.interes) ? raw.interes : [],
          proximoContactoAt: optionalDate(raw.proximoContactoAt),
          notas: raw.notas,
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

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(timer)
  }, [])

  const todayStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [tick])

  const todayEnd = useMemo(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d
  }, [tick])

  const counts = useMemo(() => ({
    nuevos: clientes.filter((c) => !c.estado || c.estado === 'capturados').length,
    calientes: clientes.filter((c) => normalizePotencial(c.potencial) === 'caliente').length,
    seguimiento: clientes.filter((c) => c.statusCrm === 'seguimiento').length,
    concretos: clientes.filter((c) => c.statusCrm === 'concreto').length,
    hoy: clientes.filter((c) => c.proximoContactoAt && c.proximoContactoAt >= todayStart && c.proximoContactoAt <= todayEnd).length,
    vencidos: clientes.filter((c) => c.proximoContactoAt && c.proximoContactoAt < todayStart).length,
  }), [clientes, todayStart, todayEnd])

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
          getDisplayPhone(c).includes(s) ||
          c.zona?.toLowerCase().includes(s) ||
          c.servicioPendiente?.toLowerCase().includes(s) ||
          c.interes?.some((i) => i.toLowerCase().includes(s))
      )
    }

    if (servicioFilter !== 'todos') result = result.filter((c) => clienteTieneServicio(c, servicioFilter))

    if (soloLenaActiva) {
      result = result.filter((c) => {
        const phone = getDisplayPhone(c)
        return (consultasByTel.get(c.tel)?.length ?? 0) > 0 || (phone ? (consultasByTel.get(phone)?.length ?? 0) > 0 : false)
      })
    }

    if (activeStatFilter === 'nuevos') result = result.filter((c) => !c.estado || c.estado === 'capturados')
    else if (activeStatFilter === 'calientes') result = result.filter((c) => normalizePotencial(c.potencial) === 'caliente')
    else if (activeStatFilter === 'seguimiento') result = result.filter((c) => c.statusCrm === 'seguimiento')
    else if (activeStatFilter === 'concretos') result = result.filter((c) => c.statusCrm === 'concreto')
    else if (activeStatFilter === 'hoy') result = result.filter((c) => c.proximoContactoAt && c.proximoContactoAt >= todayStart && c.proximoContactoAt <= todayEnd)
    else if (activeStatFilter === 'vencidos') result = result.filter((c) => !!c.proximoContactoAt && c.proximoContactoAt < todayStart)

    result.sort((a, b) => (b.fechaUltimoContacto?.getTime() ?? 0) - (a.fechaUltimoContacto?.getTime() ?? 0))
    setFiltered(result)
  }, [clientes, search, servicioFilter, soloLenaActiva, activeStatFilter, consultasByTel, todayStart, todayEnd])

  function potencialBg(potencial?: string) {
    const n = normalizePotencial(potencial)
    if (n === 'caliente') return 'bg-orange-50/80 border-orange-200'
    if (n === 'tibio') return 'bg-yellow-50/60 border-yellow-200'
    if (n === 'frio') return 'bg-sky-50/50 border-sky-200'
    return 'bg-white border-slate-200'
  }

  function potencialClass(potencial?: string) {
    const n = normalizePotencial(potencial)
    if (n === 'frio') return 'bg-sky-100 text-sky-700'
    if (n === 'tibio') return 'bg-yellow-100 text-yellow-700'
    if (n === 'caliente') return 'bg-orange-100 text-orange-700'
    return 'bg-slate-100 text-slate-600'
  }

  function exportCSV() {
    const headers = ['Teléfono', 'Nombre', 'Zona', 'Estado', 'Servicio', 'Potencial', 'CRM', 'Intereses', 'Próximo contacto', 'Último contacto', 'Pedidos']
    const rows = filtered.map((c) => [
      getDisplayPhone(c) || '',
      getDisplayName(c),
      c.zona ?? '',
      ESTADO_LABELS[c.estado ?? ''] ?? c.estado ?? '',
      servicioPrincipal(c) ?? '',
      c.potencial ?? '',
      c.statusCrm ?? '',
      c.interes?.join('|') ?? '',
      c.proximoContactoAt?.toLocaleDateString('es') ?? '',
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

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    const newEstado = destination.droppableId
    setClientes((prev) => prev.map((c) => (c.tel === draggableId ? { ...c, estado: newEstado } : c)))
    try {
      await updateDoc(doc(db, 'clientes', draggableId), { estado: newEstado })
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const openLeadDetails = (cliente: Cliente) => {
    setSelectedLead(cliente)
    setIsDrawerOpen(true)
  }

  const toggleStat = (key: StatFilter) => {
    setActiveStatFilter((prev) => (prev === key ? null : key))
  }

  const STATS: { key: StatFilter; label: string; count: number; icon: typeof Inbox; activeColor: string; bgColor: string }[] = [
    { key: 'nuevos', label: 'Nuevos', count: counts.nuevos, icon: Inbox, activeColor: 'border-slate-400 bg-slate-100', bgColor: 'text-slate-600' },
    { key: 'calientes', label: 'Calientes', count: counts.calientes, icon: Flame, activeColor: 'border-orange-400 bg-orange-50', bgColor: 'text-orange-600' },
    { key: 'seguimiento', label: 'Seguimiento', count: counts.seguimiento, icon: Eye, activeColor: 'border-amber-400 bg-amber-50', bgColor: 'text-amber-600' },
    { key: 'concretos', label: 'Concretos', count: counts.concretos, icon: Target, activeColor: 'border-green-400 bg-green-50', bgColor: 'text-green-600' },
    { key: 'hoy', label: 'Contactar hoy', count: counts.hoy, icon: CalendarClock, activeColor: 'border-indigo-400 bg-indigo-50', bgColor: 'text-indigo-600' },
    { key: 'vencidos', label: 'Vencidos', count: counts.vencidos, icon: XCircle, activeColor: 'border-red-400 bg-red-50', bgColor: 'text-red-600' },
  ]

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">CRM Ventas</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {clientes.length} contactos — {clientes.filter((c) => c.estado === 'ganado').length} clientes recurrentes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/seguimientos" className="btn-secondary flex items-center gap-1.5 text-sm">
              <CalendarClock className="w-4 h-4" />
              Seguimientos
            </Link>
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-sm">
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>

        {/* Stats clickeables */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          {STATS.map((s) => {
            const isActive = activeStatFilter === s.key
            return (
              <button
                key={s.key}
                onClick={() => toggleStat(s.key)}
                className={cn(
                  'rounded-xl border-2 p-3 flex items-center gap-2.5 transition-all text-left',
                  isActive
                    ? s.activeColor
                    : 'border-transparent bg-slate-50 hover:bg-slate-100'
                )}
              >
                <s.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? s.bgColor : 'text-slate-400')} />
                <div>
                  <p className={cn('text-xl font-bold leading-none', isActive ? s.bgColor : 'text-slate-800')}>{s.count}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Filtros simplificados */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              className="input pl-9 text-sm"
              placeholder="Buscar nombre, teléfono, zona..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input text-sm" value={servicioFilter} onChange={(e) => setServicioFilter(e.target.value)}>
            {SERVICIOS.map((s) => (
              <option key={s} value={s}>{s === 'todos' ? 'Todos los servicios' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSoloLenaActiva((v) => !v)}
            className={cn(
              'badge px-3 py-2 border transition-colors text-sm',
              soloLenaActiva
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
          >
            Logística leña ({new Set(consultasLena.map((c) => c.tel)).size})
          </button>
          {activeStatFilter && (
            <button
              onClick={() => setActiveStatFilter(null)}
              className="badge px-3 py-2 border border-brand-200 bg-brand-50 text-brand-700 text-sm hover:bg-brand-100 transition-colors"
            >
              Limpiar filtro
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {loading ? (
          <div className="flex gap-5 h-full">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-80 flex-shrink-0 bg-slate-100/50 rounded-xl border border-slate-200/60 p-4 h-full animate-pulse" />
            ))}
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-5 h-full pb-4">
              {COLUMNS.map((colId) => {
                const columnLeads = filtered.filter((c) => c.estado === colId)
                const colColor = ESTADO_COLORS[colId]?.split(' ')[0] || 'bg-slate-300'
                return (
                  <div key={colId} className="w-80 flex-shrink-0 flex flex-col max-h-full">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                        <div className={cn('w-2.5 h-2.5 rounded-full', colColor)} />
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
                            'flex-1 overflow-y-auto bg-slate-100/30 rounded-xl border border-slate-200/60 p-2.5 space-y-2.5 transition-colors',
                            snapshot.isDraggingOver && 'bg-slate-200/40 border-slate-300'
                          )}
                        >
                          {columnLeads.map((lead, index) => {
                            const telefonoVisible = getDisplayPhone(lead)
                            const consultasCliente = consultasByTel.get(lead.tel) ?? (telefonoVisible ? consultasByTel.get(telefonoVisible) : undefined) ?? []
                            const vencido = lead.proximoContactoAt && lead.proximoContactoAt < todayStart
                            const seguimientoHoyLead = lead.proximoContactoAt && lead.proximoContactoAt >= todayStart && lead.proximoContactoAt <= todayEnd
                            const nombreVisible = getDisplayName(lead)
                            const cardBg = potencialBg(lead.potencial)

                            return (
                              <Draggable key={lead.tel} draggableId={lead.tel} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => openLeadDetails(lead)}
                                    className={cn(
                                      'p-3.5 rounded-lg border shadow-sm cursor-pointer group hover:shadow-md transition-all',
                                      cardBg,
                                      snapshot.isDragging && 'shadow-xl ring-2 ring-brand-500/20 rotate-1'
                                    )}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className={cn(
                                        'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                                        normalizePotencial(lead.potencial) === 'caliente' ? 'bg-orange-200' :
                                        normalizePotencial(lead.potencial) === 'tibio' ? 'bg-yellow-200' :
                                        normalizePotencial(lead.potencial) === 'frio' ? 'bg-sky-200' : 'bg-slate-200'
                                      )}>
                                        <span className="text-slate-700 text-xs font-bold">
                                          {getInitials(nombreVisible)}
                                        </span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-600 transition-colors">
                                          {nombreVisible}
                                        </h4>
                                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                                          <Phone className="w-3 h-3" />
                                          {telefonoVisible || getIdentitySecondary(lead)}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                      {lead.statusCrm && (
                                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', STATUS_CRM_COLORS[lead.statusCrm] ?? 'bg-slate-100 text-slate-600')}>
                                          {crmLabel(lead.statusCrm)}
                                        </span>
                                      )}
                                      {lead.potencial && (
                                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', potencialClass(lead.potencial))}>
                                          {lead.potencial}
                                        </span>
                                      )}
                                      {vencido && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">Vencido</span>
                                      )}
                                      {seguimientoHoyLead && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 flex items-center gap-0.5">
                                          <CalendarClock className="w-3 h-3" /> Hoy
                                        </span>
                                      )}
                                      {consultasCliente.length > 0 && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-0.5">
                                          <AlertTriangle className="w-3 h-3" /> Leña
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-2.5 flex items-center justify-between">
                                      {lead.zona && (
                                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                          <MapPin className="w-3 h-3" />
                                          <span className="truncate max-w-[90px]">{lead.zona}</span>
                                        </span>
                                      )}
                                      <span className="flex items-center gap-1 text-[10px] text-slate-400 ml-auto">
                                        <Clock className="w-3 h-3" />
                                        {formatRelative(lead.fechaUltimoContacto)}
                                      </span>
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
