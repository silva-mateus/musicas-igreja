'use client'

import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { CoreAuthProvider } from '@core/contexts/auth-context'
import { WorkspaceProvider } from '@/contexts/workspace-context'
import { getQueryClient } from '@/lib/query-client'

export function ClientWrapper({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => getQueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            <CoreAuthProvider config={{ apiBasePath: '/api', storagePrefix: 'cifras_nmat_auth' }}>
                <WorkspaceProvider>
                    {children}
                </WorkspaceProvider>
            </CoreAuthProvider>
        </QueryClientProvider>
    )
}
