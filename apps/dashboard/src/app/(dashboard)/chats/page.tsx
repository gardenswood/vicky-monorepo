'use client'

import { MessageSquare } from 'lucide-react'

export default function ChatsPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
      <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mb-6">
        <MessageSquare className="w-10 h-10 text-brand-500" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">
        Selecciona un chat para comenzar
      </h2>
      <p className="text-sm text-slate-500 max-w-sm">
        Elige una conversación de la lista lateral para ver los mensajes, responder y gestionar la información del cliente.
      </p>
    </div>
  )
}
