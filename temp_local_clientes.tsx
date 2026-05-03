'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
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
} from 'lucide-react'
import {
  formatRelative,
  getInitials,
  ESTADO_COLORS,
  ESTADO_LABELS,
  cn,
} from '@/lib/utils'

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
  notas?: string
}

const COLUMNS = ['capturados', 'clasificando', 'cualificados', 'vendiendo', 'ganado', 'perdido']

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtered, setFiltered] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
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
          nombre: d.nombre,
          zona: d.zona,
          metodoPago: d.metodoPago,
          estado: d.estado || 'capturados', // Default state
          servicioPendiente: d.servicioPendiente,
          pedidosAnteriores: d.pedidosAnteriores || [],
          fechaUltimoContacto: d.fechaUltimoContacto?.toDate(),
          fechaPrimerContacto: d.fechaPrimerContacto?.toDate(),
          potencial: d.potencial,
          statusCrm: d.statusCrm,
          urgencia: d.urgencia,
          interes: Array.isArray(d.interes) ? d.interes : [],
          proximoContactoAt: d.proximoContactoAt?.toDate(),
          notas: d.notas,
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
          c.zona?.toLowerCase().includes(s)
      )
    }
    setFiltered(result)
  }, [clientes, search])

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {clientes.length} leads en total
            </p>
          </div>
          <button className="btn-secondary flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              placeholder="Buscar por nombre, teléfono o zona..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4" />
          </button>
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
                          {columnLeads.map((lead, index) => (
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
                                        {getInitials(lead.nombre)}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-600 transition-colors">
                                        {lead.nombre || 'Sin nombre'}
                                      </h4>
                                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        {lead.tel}
                                      </p>
                                    </div>
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
                          ))}
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
