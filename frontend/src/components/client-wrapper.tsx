'use client'

import { AuthProvider } from '@/hooks/useAuth'

export function ClientWrapper({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            {children}
        </AuthProvider>
    )
}