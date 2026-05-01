'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
  getDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  Bot,
  User,
  BellOff,
  Bell,
  Mic,
  Image as ImageIcon,
  FileText,
  ExternalLink,
  PanelRightOpen,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn, SERVICIO_LABELS, ESTADO_LABELS, ESTADO_COLORS, formatRelative, getTelFromJid } from '@/lib/utils'
import { LeadDrawer } from '@/components/LeadDrawer'

interface Mensaje {
  id: string
  contenido: string
  tipo: 'texto' | 'audio' | 'imagen' | 'video' | 'documento'
  direccion: 'entrante' | 'saliente'
  timestamp: Date
  marcadores?: string[]
  servicio?: string
  feedback?: 'good' | 'bad'
}

export default function ChatDetailPage() {
  const { chatId } = useParams<{ chatId: string }>()
  const jid = decodeURIComponent(chatId)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [chatInfo, setChatInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    const tel = getTelFromJid(jid)
    const clienteRef = doc(db, 'clientes', tel)
    const unsubCliente = onSnapshot(clienteRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        setChatInfo({
          jid,
          tel,
          nombre: d.nombre,
          estado: d.estado,
          servicioPendiente: d.servicioPendiente,
          humanoAtendiendo: d.humanoAtendiendo,
          direccion: d.direccion,
          zona: d.zona,
          metodoPago: d.metodoPago,
          pedidosAnteriores: d.pedidosAnteriores || [],
          ...d
        })
      } else {
        // Fallback to chat info if client doesn't exist yet
        const chatRef = doc(db, 'chats', jid)
        getDoc(chatRef).then(chatSnap => {
          if (chatSnap.exists()) {
             setChatInfo({ tel, jid, ...chatSnap.data() })
          }
        })
      }
    })

    // Load messages in real-time
    const mensajesRef = collection(db, 'chats', jid, 'mensajes')
    const q = query(mensajesRef, orderBy('timestamp', 'asc'))
    const unsubMensajes = onSnapshot(q, (snap) => {
      const data: Mensaje[] = snap.docs.map((d) => ({
        id: d.id,
        contenido: d.data().contenido || '',
        tipo: d.data().tipo || 'texto',
        direccion: d.data().direccion || 'entrante',
        timestamp: d.data().timestamp?.toDate() ?? new Date(),
        marcadores: d.data().marcadores,
        servicio: d.data().servicio,
        feedback: d.data().feedback,
      }))
      setMensajes(data)
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    })

    return () => {
      unsubCliente()
      unsubMensajes()
    }
  }, [jid])

  async function toggleBotSilencio() {
    if (!chatInfo) return
    setToggling(true)
    try {
      const chatRef = doc(db, 'chats', jid)
      await updateDoc(chatRef, {
        humanoAtendiendo: !chatInfo.humanoAtendiendo,
        silenciadoHasta: !chatInfo.humanoAtendiendo
          ? Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
          : null,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setToggling(false)
    }
  }

  async function handleFeedback(msgId: string, feedback: 'good' | 'bad') {
    try {
      const msgRef = doc(db, 'chats', jid, 'mensajes', msgId)
      await updateDoc(msgRef, { feedback })
    } catch (err) {
      console.error('Error al guardar feedback:', err)
    }
  }

  function groupByDate(msgs: Mensaje[]) {
    const groups: { date: string; messages: Mensaje[] }[] = []
    msgs.forEach((msg) => {
      const dateStr = format(msg.timestamp, 'dd/MM/yyyy')
      const last = groups[groups.length - 1]
      if (!last || last.date !== dateStr) {
        groups.push({ date: dateStr, messages: [msg] })
      } else {
        last.messages.push(msg)
      }
    })
    return groups
  }

  const MensajeIcon = ({ tipo }: { tipo: string }) => {
    if (tipo === 'audio') return <Mic className="w-3.5 h-3.5" />
    if (tipo === 'imagen') return <ImageIcon className="w-3.5 h-3.5" />
    if (tipo === 'documento') return <FileText className="w-3.5 h-3.5" />
    return null
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const groups = groupByDate(mensajes)

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
          <span className="text-brand-700 font-semibold">
            {chatInfo?.nombre?.[0]?.toUpperCase() ?? '?'}
          </span>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900">
              {chatInfo?.nombre || chatInfo?.tel || 'Cliente'}
            </h2>
            {chatInfo?.humanoAtendiendo && (
              <span className="badge bg-orange-100 text-orange-700 text-xs">
                <User className="w-3 h-3 mr-1" /> Humano atendiendo
              </span>
            )}
            {chatInfo?.estado && (
              <span className={cn('badge text-xs', ESTADO_COLORS[chatInfo.estado] ?? 'bg-slate-100 text-slate-600')}>
                {ESTADO_LABELS[chatInfo.estado] ?? chatInfo.estado}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {chatInfo?.tel} · {mensajes.length} mensajes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`https://wa.me/${chatInfo?.tel}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-1.5"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Abrir WA</span>
          </a>

          <button
            onClick={toggleBotSilencio}
            disabled={toggling}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              chatInfo?.humanoAtendiendo
                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
            )}
          >
            {chatInfo?.humanoAtendiendo ? (
              <><Bell className="w-4 h-4" /> <span className="hidden sm:inline">Reactivar bot</span></>
            ) : (
              <><BellOff className="w-4 h-4" /> <span className="hidden sm:inline">Silenciar bot</span></>
            )}
          </button>

          <div className="w-px h-6 bg-slate-200 mx-1" />

          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            <PanelRightOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Detalles</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-[#efeae2] px-4 sm:px-8 py-6 space-y-1">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-2 bg-white/50 rounded-xl p-8 max-w-sm mx-auto">
            <Bot className="w-10 h-10 text-slate-300" />
            <p>Sin mensajes registrados</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="space-y-2">
              <div className="flex justify-center my-4">
                <span className="text-xs text-slate-500 font-medium px-3 py-1.5 bg-white/80 shadow-sm rounded-lg backdrop-blur-sm">
                  {group.date}
                </span>
              </div>

              {group.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex animate-in', msg.direccion === 'saliente' ? 'justify-end' : 'justify-start')}
                >
                  <div className="max-w-[85%] sm:max-w-[75%] flex flex-col group">
                    {msg.direccion === 'entrante' && (
                      <div className="flex items-center gap-1 mb-1 ml-1">
                        <User className="w-3 h-3 text-slate-500" />
                        <span className="text-xs text-slate-500 font-medium">
                          {chatInfo?.nombre || 'Cliente'}
                        </span>
                      </div>
                    )}
                    {msg.direccion === 'saliente' && (
                      <div className="flex items-center gap-1 mb-1 mr-1 justify-end">
                        <Bot className="w-3 h-3 text-brand-600" />
                        <span className="text-xs text-brand-600 font-medium">Vicky</span>
                      </div>
                    )}
                    <div className={cn(
                      'px-4 py-2.5 rounded-2xl shadow-sm relative',
                      msg.direccion === 'saliente' 
                        ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-sm' 
                        : 'bg-white text-slate-800 rounded-tl-sm'
                    )}>
                      {msg.tipo !== 'texto' && (
                        <div className="flex items-center gap-1.5 mb-1 opacity-70 text-xs font-medium">
                          <MensajeIcon tipo={msg.tipo} />
                          <span className="capitalize">{msg.tipo}</span>
                        </div>
                      )}
                      <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{msg.contenido}</p>
                      {msg.marcadores && msg.marcadores.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {msg.marcadores.map((m, i) => (
                            <span key={i} className="text-[10px] bg-black/5 text-slate-600 rounded px-1.5 py-0.5 font-mono">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-end mt-1 -mb-1">
                        <span className="text-[11px] text-slate-400">
                          {format(msg.timestamp, 'HH:mm')}
                        </span>
                      </div>
                    </div>
                    {/* Botones de Feedback para mensajes salientes (del bot) */}
                    {msg.direccion === 'saliente' && (
                      <div className={cn(
                        "flex justify-end items-center gap-1.5 mt-1 mr-2 transition-opacity",
                        msg.feedback ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                      )}>
                        <button
                          onClick={() => handleFeedback(msg.id, 'good')}
                          className={cn(
                            "p-1.5 rounded-full transition-all hover:bg-green-100 hover:scale-110 active:scale-95",
                            msg.feedback === 'good' ? 'bg-green-100 text-green-600' : 'text-slate-400 hover:text-green-600'
                          )}
                          title="Bien respondido"
                        >
                          <ThumbsUp className={cn("w-4 h-4", msg.feedback === 'good' && "fill-current")} />
                        </button>
                        <button
                          onClick={() => handleFeedback(msg.id, 'bad')}
                          className={cn(
                            "p-1.5 rounded-full transition-all hover:bg-red-100 hover:scale-110 active:scale-95",
                            msg.feedback === 'bad' ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:text-red-600'
                          )}
                          title="Mal respondido"
                        >
                          <ThumbsDown className={cn("w-4 h-4", msg.feedback === 'bad' && "fill-current")} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <LeadDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        cliente={chatInfo}
      />
    </div>
  )
}
