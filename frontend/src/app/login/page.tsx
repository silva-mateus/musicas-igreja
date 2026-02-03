'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Login page now redirects to dashboard - login is done via modal
export default function LoginPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/dashboard')
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <p className="text-muted-foreground">Redirecionando...</p>
        </div>
    )
}
