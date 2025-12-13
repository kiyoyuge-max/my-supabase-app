'use client'

import { AuthProvider } from '../contexts/AuthContext'
import AuthGuard from './AuthGuard'

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        {children}
      </AuthGuard>
    </AuthProvider>
  )
}
