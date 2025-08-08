'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { handleApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Music, Lock, User, AlertCircle } from 'lucide-react'

export default function LoginPage() {
    const { isAuthenticated, isLoading: authLoading, needsSetup, login } = useAuth()
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    })
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()

    // Redirecionar se já estiver autenticado ou se precisar de setup
    useEffect(() => {
        if (!authLoading) {
            if (needsSetup) {
                router.push('/setup')
            } else if (isAuthenticated) {
                router.push('/dashboard')
            }
        }
    }, [isAuthenticated, authLoading, needsSetup, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            await login(formData.username, formData.password)
            // O redirecionamento é feito automaticamente pelo hook useAuth
        } catch (error: any) {
            // Verificar se o erro indica que precisa de setup
            if (error.response?.data?.needs_setup) {
                router.push('/setup')
                return
            }
            setError(handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
    }

    // Mostrar loading se ainda estiver verificando
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Verificando sistema...</p>
                </div>
            </div>
        )
    }

    // Não renderizar se precisar de setup ou já estiver autenticado
    if (needsSetup || isAuthenticated) {
        return null
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
            <div className="w-full max-w-md space-y-8">
                {/* Header */}
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center mb-4">
                        <Music className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Sistema de Músicas
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Faça login para acessar o sistema
                    </p>
                </div>

                {/* Login Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Entrar</CardTitle>
                        <CardDescription>
                            Entre com suas credenciais para acessar o sistema
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Error Alert */}
                            {error && (
                                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                    <span className="text-sm text-destructive">{error}</span>
                                </div>
                            )}

                            {/* Username */}
                            <div className="space-y-2">
                                <Label htmlFor="username">Nome de usuário</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="username"
                                        name="username"
                                        type="text"
                                        placeholder="Digite seu nome de usuário"
                                        value={formData.username}
                                        onChange={handleChange}
                                        className="pl-10"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <Label htmlFor="password">Senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="Digite sua senha"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="pl-10"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Entrando...' : 'Entrar'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center text-sm text-muted-foreground">
                    Sistema de Músicas da Igreja v2.0
                </div>
            </div>
        </div>
    )
}