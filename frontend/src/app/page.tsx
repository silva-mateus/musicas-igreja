'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'


export default function HomePage() {
    const { user, isLoading, needsSetup } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading) {
            if (needsSetup) {
                router.push('/setup')
            } else if (user) {
                router.push('/dashboard')
            } else {
                router.push('/login')
            }
        }
    }, [user, isLoading, needsSetup, router])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Carregando...</p>
                </div>
            </div>
        )
    }

    // Esta página apenas redireciona, não renderiza conteúdo
    return null
}