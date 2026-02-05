'use client'

import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { getQueryClient } from '@/lib/query-client'

export function ClientWrapper({ children }: { children: React.ReactNode }) {
    // This ensures that data is not shared between different users and requests
    // while still only creating the QueryClient once per component lifecycle
    const [queryClient] = useState(() => getQueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
    )
}
