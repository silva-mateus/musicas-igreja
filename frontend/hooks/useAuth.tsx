// Hook personalizado para gerenciamento de autenticação

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { authApi, setupApi, handleApiError } from '@/lib/api'
import type { User } from '@/types'

interface AuthContextType {
    user: User | null
    isLoading: boolean
    isAuthenticated: boolean
    needsSetup: boolean
    login: (username: string, password: string) => Promise<void>
    logout: () => Promise<void>
    checkAuth: () => Promise<void>
    checkSetupStatus: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [needsSetup, setNeedsSetup] = useState(false)
    const router = useRouter()

    const isAuthenticated = !!user

    // Verificar autenticação e setup ao carregar
    useEffect(() => {
        checkSetupStatus()
    }, [])

    const checkSetupStatus = async () => {
        try {
            setIsLoading(true)

            // Primeiro verificar se o sistema precisa de setup
            const setupStatus = await setupApi.getStatus()
            setNeedsSetup(setupStatus.needs_setup)

            if (setupStatus.needs_setup) {
                // Se precisa de setup, não verificar autenticação
                setUser(null)
                setIsLoading(false)
                return
            }

            // Se não precisa de setup, verificar autenticação
            await checkAuth()

        } catch (error) {
            console.error('Erro ao verificar status do sistema:', error)
            setNeedsSetup(false)
            setUser(null)
            setIsLoading(false)
        }
    }

    const checkAuth = async () => {
        try {
            // Verificar se há usuário no localStorage
            const savedUser = localStorage.getItem('user')
            if (savedUser) {
                const userData = JSON.parse(savedUser)
                setUser(userData)

                // Verificar se ainda está autenticado no servidor
                try {
                    const response = await authApi.getCurrentUser()
                    setUser(response.user)
                } catch (error) {
                    // Se falhou, limpar dados locais
                    localStorage.removeItem('user')
                    setUser(null)
                }
            }
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error)
            setUser(null)
        } finally {
            setIsLoading(false)
        }
    }

    const login = async (username: string, password: string) => {
        try {
            const response = await authApi.login(username, password)

            setUser(response.user)
            localStorage.setItem('user', JSON.stringify(response.user))

            router.push('/dashboard')
        } catch (error) {
            throw error
        }
    }

    const logout = async () => {
        try {
            await authApi.logout()
        } catch (error) {
            console.error('Erro ao fazer logout:', error)
        } finally {
            setUser(null)
            localStorage.removeItem('user')
            router.push('/login')
        }
    }

    const value = {
        user,
        isLoading,
        isAuthenticated,
        needsSetup,
        login,
        logout,
        checkAuth,
        checkSetupStatus
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

// Hook para proteger rotas
export function useRequireAuth() {
    const { isAuthenticated, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login')
        }
    }, [isAuthenticated, isLoading, router])

    return { isAuthenticated, isLoading }
}