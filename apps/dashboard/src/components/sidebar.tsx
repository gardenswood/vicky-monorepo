'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Settings,
  FileText,
  DollarSign,
  SlidersHorizontal,
  LogOut,
  Leaf,
  ChevronRight,
  Bot,
  Truck,
  MapPin,
  Calendar,
  Megaphone,
} from 'lucide-react'

const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Chats',
    href: '/chats',
    icon: MessageSquare,
  },
  {
    label: 'CRM Ventas',
    href: '/clientes',
    icon: Users,
  },
  {
    label: 'Leña & Logística',
    icon: Truck,
    children: [
      { label: 'Cola de leña', href: '/cola-lena', icon: Truck },
      { label: 'Zonas & Consultas', href: '/logistica-zonas', icon: MapPin },
      { label: 'Agenda de entregas', href: '/agenda-entregas', icon: Calendar },
    ],
  },
  {
    label: 'Configuración',
    icon: Settings,
    children: [
      { label: 'Instrucciones AI', href: '/config/prompts', icon: Bot },
      { label: 'Promos y restricciones', href: '/config/promociones', icon: Megaphone },
      { label: 'Precios y servicios', href: '/config/precios', icon: DollarSign },
      { label: 'General', href: '/config/general', icon: SlidersHorizontal },
    ],
  },
  {
    label: 'Usuarios',
    href: '/usuarios',
    icon: FileText,
  },
]

type SidebarProps = {
  /** Cierra drawer móvil al navegar */
  onNavigate?: () => void
  className?: string
}

export default function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string>('')
  const [userRole, setUserRole] = useState<string>('')

  useEffect(() => {
    fetch('/api/auth/verify').then(r => r.json()).then(data => {
      if (data.email) setUserEmail(data.email)
      if (data.role) setUserRole(data.role)
    }).catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 w-60 bg-brand-950 flex flex-col z-30',
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-brand-800/50">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Leaf className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">Gardens Wood</p>
          <div className="flex items-center gap-1 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-brand-400 text-xs">Vicky Bot activo</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          if (item.children) {
            const isGroupActive = item.children.some((child) => pathname === child.href || pathname.startsWith(child.href))
            return (
              <div key={item.label}>
                <div className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider mt-3 mb-1',
                  isGroupActive ? 'text-brand-300' : 'text-brand-600'
                )}>
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </div>
                {item.children.map((child) => {
                  const active = pathname === child.href || pathname.startsWith(child.href)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => onNavigate?.()}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
                        active
                          ? 'bg-brand-700 text-white font-medium'
                          : 'text-brand-300 hover:bg-brand-800/60 hover:text-white'
                      )}
                    >
                      <child.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{child.label}</span>
                      {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
                    </Link>
                  )
                })}
              </div>
            )
          }

          const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(item.href!)
          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={() => onNavigate?.()}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
                active
                  ? 'bg-brand-700 text-white font-medium'
                  : 'text-brand-300 hover:bg-brand-800/60 hover:text-white'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-brand-800/50 space-y-1">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center flex-shrink-0">
            <span className="text-brand-200 text-xs font-bold">
              {userEmail ? userEmail[0].toUpperCase() : 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{userEmail || 'Admin'}</p>
            <p className="text-brand-500 text-xs capitalize truncate">{userRole || 'admin'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-brand-400 hover:bg-brand-800/60 hover:text-white transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
