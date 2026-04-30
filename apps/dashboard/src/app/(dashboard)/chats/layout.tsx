'use client'

import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Search, Filter, Clock, Bot, User, MessageSquare } from 'lucide-react'
import { formatTimestamp, getInitials, ESTADO_COLORS, ESTADO_LABELS, cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Chat {
  jid: string
  tel: string
  nombre?: string
  ultimoMensaje?: string
  ultimoMensajeAt?: Date
  estado?: string
  humanoAtendiendo?: boolean
}

const ESTADOS = ['todos', 'capturados', 'clasificando', 'cualificados', 'vendiendo', 'ganado', 'perdido']

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([])
  const [filtered, setFiltered] = useState<Chat[]>([])
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()

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
          estado: d.estado || 'capturados',
          humanoAtendiendo: d.humanoAtendiendo,
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
    setFiltered(result)
  }, [chats, search, estadoFilter])

  return (
    <div className="h-screen flex overflow-hidden bg-white">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-slate-900">Chats</h1>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {chats.length}
            </span>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                placeholder="Buscar chat..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2"
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e === 'todos' ? 'Todos los estados' : ESTADO_LABELS[e] ?? e}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                    <div className="h-2 bg-slate-200 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No hay chats</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((chat) => {
                const isActive = pathname === `/chats/${encodeURIComponent(chat.jid)}`
                return (
                  <Link
                    key={chat.jid}
                    href={`/chats/${encodeURIComponent(chat.jid)}`}
                    className={cn(
                      'flex items-start gap-3 p-4 hover:bg-slate-100 transition-colors',
                      isActive && 'bg-brand-50 hover:bg-brand-50'
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center',
                        isActive ? 'bg-brand-200' : 'bg-slate-200'
                      )}>
                        <span className={cn(
                          'font-semibold text-sm',
                          isActive ? 'text-brand-700' : 'text-slate-600'
                        )}>
                          {getInitials(chat.nombre)}
                        </span>
                      </div>
                      {chat.humanoAtendiendo && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-400 rounded-full border-2 border-white flex items-center justify-center">
                          <User className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={cn(
                          'text-sm font-semibold truncate',
                          isActive ? 'text-brand-900' : 'text-slate-900'
                        )}>
                          {chat.nombre || chat.tel}
                        </p>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {formatTimestamp(chat.ultimoMensajeAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1 mb-1.5">
                        <Bot className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        {chat.ultimoMensaje || 'Sin mensajes'}
                      </p>
                      {chat.estado && (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', ESTADO_COLORS[chat.estado] ?? 'bg-slate-100 text-slate-600')}>
                          {ESTADO_LABELS[chat.estado] ?? chat.estado}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {children}
      </div>
    </div>
  )
}
