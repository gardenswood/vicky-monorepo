import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vicky Bot - Dashboard | Gardens Wood',
  description: 'Panel de administración del bot WhatsApp de Gardens Wood',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
