'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  Timestamp,
  deleteField,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  Bot,
  User,
  Phone,
  MapPin,
  Package,
  Clock,
  BellOff,
  Mic,
  Image as ImageIcon,
  FileText,
  ExternalLink,
  X,
  ThumbsUp,
  ThumbsDown,
  HandHelping,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn, SERVICIO_LABELS, ESTADO_LABELS, ESTADO_COLORS, formatRelative, getTelFromJid } from '@/lib/utils'

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

interface ChatInfo {
  jid: string
  tel: string
  nombre?: string
  estado?: string
  servicioPendiente?: string
  humanoAtendiendo?: boolean
  direccion?: string
  zona?: string
  metodoPago?: string
  pedidosAnteriores?: { servicio: string; descripcion: string; fecha?: Date }[]
}

interface ChatModalProps {
  jidDecoded: string
  onClose: () => void
}

export default function ChatModal({ jidDecoded, onClose }: ChatModalProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null)
  const [botSilenciado, setBotSilenciado] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [solicitando, setSolicitando] = useState(false)
  const [asistenciaSolicitada, setAsistenciaSolicitada] = useState(false)

  useEffect(() => {
    const chatRef = doc(db, 'chats', jidDecoded)
    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        const humano = d.humanoAtendiendo === true
        const silenciadoHasta = d.silenciadoHasta?.toDate?.() ?? null
        const silenciadoPorTiempo = silenciadoHasta ? silenciadoHasta.getTime() > Date.now() : false
        setBotSilenciado(humano || silenciadoPorTiempo)
        if (!humano && !silenciadoPorTiempo) {
          setAsistenciaSolicitada(false)
        }
        setChatInfo({
          jid: jidDecoded,
          tel: d.tel || getTelFromJid(jidDecoded),
          nombre: d.nombre,
          estado: d.estado,
          servicioPendiente: d.servicioPendiente,
          humanoAtendiendo: humano,
          direccion: d.direccion,
          zona: d.zona,
          metodoPago: d.metodoPago,
          pedidosAnteriores: d.pedidosAnteriores || [],
        })
      }
    })

    const mensajesRef = collection(db, 'chats', jidDecoded, 'mensajes')
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
      unsubChat()
      unsubMensajes()
    }
  }, [jidDecoded])

  const silenciarBot = useCallback(async () => {
    setToggling(true)
    try {
      const chatRef = doc(db, 'chats', jidDecoded)
      await setDoc(chatRef, {
        humanoAtendiendo: true,
        silenciadoHasta: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      }, { merge: true })
    } catch (err) {
      console.error(err)
    } finally {
      setToggling(false)
    }
  }, [jidDecoded])

  const solicitarAsistenciaVicky = useCallback(async () => {
    setSolicitando(true)
    try {
      const chatRef = doc(db, 'chats', jidDecoded)
      await setDoc(chatRef, {
        humanoAtendiendo: false,
        humanoAtendiendoAt: deleteField(),
        silenciadoHasta: deleteField(),
      }, { merge: true })
      setAsistenciaSolicitada(true)

      fetch('/api/solicitar-asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: jidDecoded }),
      }).catch(() => {})
    } catch (err) {
      console.error(err)
    } finally {
      setSolicitando(false)
    }
  }, [jidDecoded])

  async function handleFeedback(msgId: string, feedback: 'good' | 'bad') {
    try {
      const msgRef = doc(db, 'chats', jidDecoded, 'mensajes', msgId)
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
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl p-8 flex items-center justify-center h-64 w-full max-w-4xl border border-slate-100">
          <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  const groups = groupByDate(mensajes)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 shadow-inner">
            <span className="text-brand-700 font-bold text-lg">
              {chatInfo?.nombre?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-lg text-slate-900 truncate">
                {chatInfo?.nombre || chatInfo?.tel || 'Cliente'}
              </h2>
              {botSilenciado && (
                <span className="badge bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                  <User className="w-3 h-3 inline mr-0.5" /> Humano atendiendo
                </span>
              )}
              {!botSilenciado && asistenciaSolicitada && (
                <span className="badge bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                  <Bot className="w-3 h-3 inline mr-0.5" /> Vicky activa
                </span>
              )}
              {chatInfo?.estado && (
                <span className={cn('badge text-xs px-2 py-0.5 rounded-full', ESTADO_COLORS[chatInfo.estado] ?? 'bg-slate-100 text-slate-600')}>
                  {ESTADO_LABELS[chatInfo.estado] ?? chatInfo.estado}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> {chatInfo?.tel} <span className="text-slate-300">•</span> {mensajes.length} mensajes
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`https://wa.me/${chatInfo?.tel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-1.5 rounded-full"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            {botSilenciado ? (
              <button
                onClick={solicitarAsistenciaVicky}
                disabled={solicitando}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200"
              >
                <HandHelping className="w-4 h-4" />
                <span className="hidden sm:inline">Pedir asistencia Vicky</span>
              </button>
            ) : (
              <button
                onClick={silenciarBot}
                disabled={toggling}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
              >
                <BellOff className="w-4 h-4" />
                <span className="hidden sm:inline">Silenciar bot</span>
              </button>
            )}
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-slate-50/80 px-6 py-4 space-y-2 scroll-smooth">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-3">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                  <Bot className="w-8 h-8 text-slate-300" />
                </div>
                <p className="italic">Sin mensajes registrados</p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.date} className="space-y-3">
                  <div className="flex items-center justify-center my-6">
                    <span className="text-xs text-slate-500 font-medium px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
                      {group.date}
                    </span>
                  </div>

                  {group.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn('flex animate-in slide-in-from-bottom-2', msg.direccion === 'saliente' ? 'justify-end' : 'justify-start')}
                    >
                      <div className="max-w-[75%] flex flex-col group">
                        {msg.direccion === 'entrante' && (
                          <div className="flex items-center gap-1.5 mb-1 ml-2">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs text-slate-500 font-medium">
                              {chatInfo?.nombre || 'Cliente'}
                            </span>
                          </div>
                        )}
                        {msg.direccion === 'saliente' && (
                          <div className="flex items-center gap-1.5 mb-1 mr-2 justify-end">
                            <span className="text-xs text-brand-600 font-medium">Vicky</span>
                            <Bot className="w-3.5 h-3.5 text-brand-600" />
                          </div>
                        )}
                        <div className={cn(
                          msg.direccion === 'saliente' ? 'bubble-out bg-brand-600 text-white rounded-2xl rounded-tr-sm p-3 shadow-sm' : 'bubble-in bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm p-3 shadow-sm'
                        )}>
                          {msg.tipo !== 'texto' && (
                            <div className="flex items-center gap-1.5 mb-2 opacity-80 text-xs font-medium bg-black/10 rounded-lg px-2 py-1 w-fit">
                              <MensajeIcon tipo={msg.tipo} />
                              <span className="capitalize">{msg.tipo}</span>
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.contenido}</p>
                          {msg.marcadores && msg.marcadores.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {msg.marcadores.map((m, i) => (
                                <span key={i} className="text-[11px] bg-black/10 text-inherit rounded-md px-2 py-0.5 font-mono">
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className={cn(
                            'text-[11px] mt-2 font-medium',
                            msg.direccion === 'saliente' ? 'text-white/70 text-right' : 'text-slate-400'
                          )}>
                            {format(msg.timestamp, 'HH:mm')}
                          </p>
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
            <div ref={bottomRef} className="h-4" />

            {/* Banner de asistencia dentro del scroll */}
            {botSilenciado && (
              <div className="sticky bottom-0 bg-amber-50/95 backdrop-blur-sm border-t border-amber-200 px-4 py-3 -mx-6 mt-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-sm font-medium text-amber-800 truncate">Vicky en silencio — Humano atendiendo</p>
                  </div>
                  <button
                    onClick={solicitarAsistenciaVicky}
                    disabled={solicitando}
                    className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors shadow-sm flex-shrink-0 disabled:opacity-50"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    Solicitar asistencia
                  </button>
                </div>
                <p className="text-[11px] text-amber-500 mt-1 ml-6">
                  Si respondés desde el teléfono, Vicky se silenciará automáticamente.
                </p>
              </div>
            )}

            {!botSilenciado && asistenciaSolicitada && (
              <div className="sticky bottom-0 bg-green-50/95 backdrop-blur-sm border-t border-green-200 px-4 py-2 -mx-6 mt-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-700 font-medium">Vicky responderá al próximo mensaje</p>
                </div>
              </div>
            )}
          </div>

          {/* Client info panel */}
          <div className="w-80 bg-white border-l border-slate-100 overflow-y-auto flex-shrink-0 p-6 space-y-6">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
              <User className="w-4 h-4 text-brand-500" />
              Info del cliente
            </h3>

            <div className="space-y-4">
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Teléfono" value={chatInfo?.tel} />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Dirección" value={chatInfo?.direccion} />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Zona" value={chatInfo?.zona} />
              <InfoRow icon={<Package className="w-4 h-4" />} label="Servicio" value={chatInfo?.servicioPendiente ? SERVICIO_LABELS[chatInfo.servicioPendiente] : undefined} />
              <InfoRow icon={<FileText className="w-4 h-4" />} label="Pago" value={chatInfo?.metodoPago} />
            </div>

            {chatInfo?.pedidosAnteriores && chatInfo.pedidosAnteriores.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pedidos</p>
                <div className="space-y-2.5">
                  {chatInfo.pedidosAnteriores.map((p, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                      <p className="text-sm font-semibold text-slate-800">{SERVICIO_LABELS[p.servicio] ?? p.servicio}</p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{p.descripcion}</p>
                      {p.fecha && (
                        <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {formatRelative(p.fecha)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <div className="text-slate-400 mt-0.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">{icon}</div>
      <div>
        <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm text-slate-800 font-medium leading-tight">{value}</p>
      </div>
    </div>
  )
}
