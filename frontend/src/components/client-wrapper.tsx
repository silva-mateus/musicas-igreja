'use client'

import { AuthProvider } from '@/contexts/AuthContext'

export function ClientWrapper({ children }: { children: React.ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>
}