'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, User, Phone, MapPin, Package, Clock, CreditCard, Save } from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getInitials, ESTADO_LABELS, ESTADO_COLORS, SERVICIO_LABELS, cn, formatRelative } from '@/lib/utils'

interface LeadDrawerProps {
  isOpen: boolean
  onClose: () => void
  cliente: any
}

export function LeadDrawer({ isOpen, onClose, cliente }: LeadDrawerProps) {
  const [notas, setNotas] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [estado, setEstado] = useState('')

  useEffect(() => {
    if (cliente) {
      setNotas(cliente.notas || '')
      setEstado(cliente.estado || 'capturados')
    }
  }, [cliente])

  if (!cliente) return null

  const handleSaveNotas = async () => {
    if (!cliente.tel) return
    setIsSaving(true)
    try {
      const docRef = doc(db, 'clientes', cliente.tel)
      await updateDoc(docRef, { notas })
    } catch (error) {
      console.error('Error saving notes:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEstadoChange = async (newEstado: string) => {
    if (!cliente.tel) return
    setEstado(newEstado)
    try {
      const docRef = doc(db, 'clientes', cliente.tel)
      await updateDoc(docRef, { estado: newEstado })
    } catch (error) {
      console.error('Error updating status:', error)
      setEstado(cliente.estado) // revert on error
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-50 shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
            {/* Header */}
            <div className="bg-white px-6 py-5 border-b border-slate-200 flex items-start justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-brand-700 font-semibold text-lg">
                    {getInitials(cliente.nombre)}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">
                    {cliente.nombre || 'Sin nombre'}
                  </h2>
                  <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5" />
                    {cliente.tel}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status Selectors */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Etapa
                  </label>
                  <select
                    value={estado}
                    onChange={(e) => handleEstadoChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5"
                  >
                    {Object.entries(ESTADO_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Asignado a
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5"
                    defaultValue=""
                  >
                    <option value="" disabled>Elegir compañero de equipo...</option>
                    <option value="alejandro">Alejandro</option>
                    <option value="vicky">Vicky (Bot)</option>
                  </select>
                </div>
              </div>

              {/* Notes (Post-it style) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Nota del cliente
                </label>
                <div className="relative">
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Añade una nota privada aquí..."
                    className="w-full h-40 p-4 bg-yellow-100/80 border border-yellow-200/50 rounded-xl text-slate-700 text-sm resize-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent placeholder:text-yellow-600/50 shadow-inner"
                  />
                  {notas !== (cliente.notas || '') && (
                    <button
                      onClick={handleSaveNotas}
                      disabled={isSaving}
                      className="absolute bottom-3 right-3 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 p-2 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* System Properties */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Propiedades del sistema
                </label>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                  <PropertyRow icon={<MapPin />} label="Zona" value={cliente.zona} />
                  <PropertyRow icon={<Package />} label="Servicio" value={cliente.servicioPendiente ? SERVICIO_LABELS[cliente.servicioPendiente] : undefined} />
                  <PropertyRow icon={<CreditCard />} label="Método de pago" value={cliente.metodoPago} />
                  <PropertyRow icon={<Clock />} label="Último contacto" value={formatRelative(cliente.fechaUltimoContacto)} />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function PropertyRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between p-3.5">
      <div className="flex items-center gap-2.5 text-slate-500">
        <div className="w-4 h-4">{icon}</div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-sm text-slate-900 font-medium text-right">{value}</span>
    </div>
  )
}
