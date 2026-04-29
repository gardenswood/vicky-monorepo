'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/sidebar'
import { cn } from '@/lib/utils'

/**
 * En viewport angosto el sidebar fijo dejaba ~150px de contenido y ocultaba ítems inferiores del menú.
 * Drawer + barra superior permite abrir el menú completo e ir a Agenda de entregas, etc.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-slate-50">
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <Sidebar
        onNavigate={() => setMenuOpen(false)}
        className={cn(
          'transition-transform duration-200 ease-out max-md:shadow-2xl',
          menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      />

      <main className="flex-1 min-h-screen w-full min-w-0 md:ml-60">
        <header className="md:hidden sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-sm">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Abrir menú de navegación"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-sm font-semibold text-slate-800">Gardens Wood</span>
        </header>
        {children}
      </main>
    </div>
  )
}
