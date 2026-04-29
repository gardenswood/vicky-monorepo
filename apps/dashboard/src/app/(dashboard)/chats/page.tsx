'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Search, MessageSquare, Filter, Clock, Bot, User } from 'lucide-react'
import { formatTimestamp, getInitials, SERVICIO_LABELS, ESTADO_COLORS, ESTADO_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Chat {
  jid: string
  tel: string
  nombre?: string
  ultimoMensaje?: string
  ultimoMensajeAt?: Date
  estado?: string
  servicioPendiente?: string
  humanoAtendiendo?: boolean
  mensajesCount?: number
}

const ESTADOS = ['todos', 'nuevo', 'cotizacion_enviada', 'confirmado', 'cliente', 'silenciado']
const SERVICIOS = ['todos', 'lena', 'cerco', 'pergola', 'fogonero', 'bancos', 'madera']

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [filtered, setFiltered] = useState<Chat[]>([])
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [servicioFilter, setServicioFilter] = useState('todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'chats'), orderBy('ultimoMensajeAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const data: Chat[] = snap.docs.map((doc) => {
        const d = doc.data()
        return {
          jid: doc.id,
          tel: d.tel || doc.id.replace('@s.whatsapp.net', ''),
          nombre: d.nombre,
          ultimoMensaje: d.ultimoMensaje,
          ultimoMensajeAt: d.ultimoMensajeAt?.toDate(),
          estado: d.estado,
          servicioPendiente: d.servicioPendiente,
          humanoAtendiendo: d.humanoAtendiendo,
          mensajesCount: d.mensajesCount,
        }
      })
      setChats(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    let result = [...chats]
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.nombre?.toLowerCase().includes(s) ||
          c.tel.includes(s) ||
          c.ultimoMensaje?.toLowerCase().includes(s)
      )
    }
    if (estadoFilter !== 'todos') result = result.filter((c) => c.estado === estadoFilter)
    if (servicioFilter !== 'todos') result = result.filter((c) => c.servicioPendiente === servicioFilter)
    setFiltered(result)
  }, [chats, search, estadoFilter, servicioFilter])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chats</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {chats.length} conversaciones · {chats.filter((c) => c.humanoAtendiendo).length} con humano atendiendo
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Buscar por nombre, teléfono o mensaje..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            className="input"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e === 'todos' ? 'Todos los estados' : ESTADO_LABELS[e] ?? e}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={servicioFilter}
            onChange={(e) => setServicioFilter(e.target.value)}
          >
            {SERVICIOS.map((s) => (
              <option key={s} value={s}>
                {s === 'todos' ? 'Todos los servicios' : SERVICIO_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chat list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {chats.length === 0 ? 'No hay chats registrados aún' : 'No hay chats que coincidan con los filtros'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {chats.length === 0 && 'Los chats aparecerán aquí cuando el bot esté conectado a Firestore'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((chat) => (
              <Link
                key={chat.jid}
                href={`/chats/${encodeURIComponent(chat.jid)}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-700 font-semibold">
                      {getInitials(chat.nombre)}
                    </span>
                  </div>
                  {chat.humanoAtendiendo && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-orange-400 rounded-full border-2 border-white flex items-center justify-center">
                      <User className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {chat.nombre || chat.tel}
                      </p>
                      {chat.humanoAtendiendo && (
                        <span className="badge bg-orange-100 text-orange-700 text-xs">
                          <User className="w-2.5 h-2.5 mr-1" /> Humano
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(chat.ultimoMensajeAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500 truncate flex-1 flex items-center gap-1">
                      <Bot className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      {chat.ultimoMensaje || 'Sin mensajes'}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {chat.servicioPendiente && (
                        <span className="badge bg-slate-100 text-slate-600 text-xs">
                          {SERVICIO_LABELS[chat.servicioPendiente] ?? chat.servicioPendiente}
                        </span>
                      )}
                      {chat.estado && (
                        <span className={cn('badge text-xs', ESTADO_COLORS[chat.estado] ?? 'bg-slate-100 text-slate-600')}>
                          {ESTADO_LABELS[chat.estado] ?? chat.estado}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
