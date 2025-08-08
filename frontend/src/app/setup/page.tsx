'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Settings,
    User,
    Mail,
    Lock,
    CheckCircle,
    Music,
    AlertCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { setupApi } from '@/lib/api'

interface FormData {
    username: string
    email: string
    password: string
    confirm_password: string
}

export default function SetupPage() {
    const router = useRouter()
    const { toast } = useToast()

    const [formData, setFormData] = useState<FormData>({
        username: '',
        email: '',
        password: '',
        confirm_password: ''
    })
    const [isLoading, setIsLoading] = useState(false)
    const [errors, setErrors] = useState<Partial<FormData>>({})

    const handleChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        // Limpar erro do campo quando o usuário começar a digitar
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }))
        }
    }

    const validateForm = (): boolean => {
        const newErrors: Partial<FormData> = {}

        // Username
        if (!formData.username.trim()) {
            newErrors.username = 'Username é obrigatório'
        } else if (formData.username.length < 3) {
            newErrors.username = 'Username deve ter pelo menos 3 caracteres'
        }

        // Email
        if (!formData.email.trim()) {
            newErrors.email = 'Email é obrigatório'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Email inválido'
        }

        // Password
        if (!formData.password) {
            newErrors.password = 'Senha é obrigatória'
        } else if (formData.password.length < 6) {
            newErrors.password = 'Senha deve ter pelo menos 6 caracteres'
        }

        // Confirm Password
        if (!formData.confirm_password) {
            newErrors.confirm_password = 'Confirmação de senha é obrigatória'
        } else if (formData.password !== formData.confirm_password) {
            newErrors.confirm_password = 'Senhas não coincidem'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            return
        }

        setIsLoading(true)

        try {
            const response = await setupApi.initializeSystem(formData)

            toast({
                title: "Sistema configurado com sucesso!",
                description: "Agora você pode fazer login com suas credenciais.",
            })

            // Redirecionar para login
            router.push('/login')

        } catch (error: any) {
            const errorMessage = error.response?.data?.error || 'Erro ao configurar sistema'

            toast({
                title: "Erro na configuração",
                description: errorMessage,
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto">
                        <Music className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            🎵 Sistema de Músicas da Igreja
                        </h1>
                        <p className="text-xl text-gray-600">
                            Configuração Inicial
                        </p>
                    </div>
                </div>

                {/* Setup Card */}
                <Card className="shadow-xl">
                    <CardHeader className="text-center pb-6">
                        <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                            <Settings className="w-6 h-6" />
                            Primeira Configuração
                        </CardTitle>
                        <CardDescription className="text-base">
                            Para começar a usar o sistema, precisamos criar uma conta de administrador.
                            Este será o usuário principal que poderá gerenciar o sistema e criar outros usuários.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Username */}
                            <div className="space-y-2">
                                <Label htmlFor="username">Nome de Usuário *</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="username"
                                        value={formData.username}
                                        onChange={(e) => handleChange('username', e.target.value)}
                                        placeholder="Digite o nome de usuário"
                                        className={`pl-10 ${errors.username ? 'border-red-500' : ''}`}
                                        disabled={isLoading}
                                    />
                                </div>
                                {errors.username && (
                                    <p className="text-sm text-red-600 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {errors.username}
                                    </p>
                                )}
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                        placeholder="Digite o email"
                                        className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                                        disabled={isLoading}
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-sm text-red-600 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {errors.email}
                                    </p>
                                )}
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <Label htmlFor="password">Senha *</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => handleChange('password', e.target.value)}
                                        placeholder="Digite a senha"
                                        className={`pl-10 ${errors.password ? 'border-red-500' : ''}`}
                                        disabled={isLoading}
                                    />
                                </div>
                                {errors.password && (
                                    <p className="text-sm text-red-600 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {errors.password}
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    A senha deve ter pelo menos 6 caracteres
                                </p>
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <Label htmlFor="confirm_password">Confirmar Senha *</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="confirm_password"
                                        type="password"
                                        value={formData.confirm_password}
                                        onChange={(e) => handleChange('confirm_password', e.target.value)}
                                        placeholder="Confirme a senha"
                                        className={`pl-10 ${errors.confirm_password ? 'border-red-500' : ''}`}
                                        disabled={isLoading}
                                    />
                                </div>
                                {errors.confirm_password && (
                                    <p className="text-sm text-red-600 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {errors.confirm_password}
                                    </p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className="w-full py-6 text-lg font-semibold"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        Configurando Sistema...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5" />
                                        Criar Administrador & Iniciar Sistema
                                    </div>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <Card className="p-4">
                        <div className="space-y-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                                <Music className="w-5 h-5 text-blue-600" />
                            </div>
                            <h3 className="font-semibold">Organização</h3>
                            <p className="text-sm text-muted-foreground">
                                Gerencie suas músicas com categorias e metadados
                            </p>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="space-y-2">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <h3 className="font-semibold">Listas</h3>
                            <p className="text-sm text-muted-foreground">
                                Crie listas personalizadas para suas celebrações
                            </p>
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="space-y-2">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                                <Settings className="w-5 h-5 text-purple-600" />
                            </div>
                            <h3 className="font-semibold">Controle</h3>
                            <p className="text-sm text-muted-foreground">
                                Administre usuários e configurações do sistema
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}