import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(date: Date | undefined): string {
  if (!date) return ''
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Ayer'
  return format(date, 'dd/MM/yy')
}

export function formatRelative(date: Date | undefined): string {
  if (!date) return ''
  return formatDistanceToNow(date, { addSuffix: true, locale: es })
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}

export function getInitials(name?: string): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getTelFromJid(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@g.us', '')
}

export const SERVICIO_LABELS: Record<string, string> = {
  lena: 'Leña',
  cerco: 'Cercos',
  pergola: 'Pérgolas',
  fogonero: 'Sector Fogonero',
  bancos: 'Bancos',
  madera: 'Productos de Madera',
}

export const SERVICIO_COLORS: Record<string, string> = {
  lena: '#92400e',
  cerco: '#166534',
  pergola: '#1d4ed8',
  fogonero: '#b45309',
  bancos: '#7c3aed',
  madera: '#0f766e',
}

export const ESTADO_LABELS: Record<string, string> = {
  capturados: 'Leads capturados',
  clasificando: 'Clasificando leads',
  cualificados: 'Leads cualificados',
  vendiendo: 'Vendiendo',
  ganado: 'Ganado',
  perdido: 'Perdido',
}

export const ESTADO_COLORS: Record<string, string> = {
  capturados: 'bg-blue-100 text-blue-700',
  clasificando: 'bg-fuchsia-100 text-fuchsia-700',
  cualificados: 'bg-emerald-100 text-emerald-700',
  vendiendo: 'bg-indigo-100 text-indigo-700',
  ganado: 'bg-green-100 text-green-700',
  perdido: 'bg-red-100 text-red-700',
}
