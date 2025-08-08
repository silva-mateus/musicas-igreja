'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { adminApi, handleApiError } from '@/lib/api'
import type { User } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { UserPlus, Eye, EyeOff } from 'lucide-react'

interface CreateUserDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onUserCreated: (user: User) => void
}

interface FormData {
    username: string
    email: string
    password: string
    confirmPassword: string
    role: string
}

interface FormErrors {
    username?: string
    email?: string
    password?: string
    confirmPassword?: string
    role?: string
    general?: string
}

export function CreateUserDialog({ open, onOpenChange, onUserCreated }: CreateUserDialogProps) {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const [formData, setFormData] = useState<FormData>({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user'
    })

    const [errors, setErrors] = useState<FormErrors>({})

    const resetForm = () => {
        setFormData({
            username: '',
            email: '',
            password: '',
            confirmPassword: '',
            role: 'user'
        })
        setErrors({})
        setShowPassword(false)
        setShowConfirmPassword(false)
    }

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {}

        // Username validation
        if (!formData.username.trim()) {
            newErrors.username = 'Nome de usuário é obrigatório'
        } else if (formData.username.length < 3) {
            newErrors.username = 'Nome de usuário deve ter pelo menos 3 caracteres'
        } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
            newErrors.username = 'Nome de usuário pode conter apenas letras, números, _ e -'
        }

        // Email validation
        if (!formData.email.trim()) {
            newErrors.email = 'Email é obrigatório'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Email inválido'
        }

        // Password validation
        if (!formData.password) {
            newErrors.password = 'Senha é obrigatória'
        } else if (formData.password.length < 6) {
            newErrors.password = 'Senha deve ter pelo menos 6 caracteres'
        }

        // Confirm password validation
        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Confirmação de senha é obrigatória'
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Senhas não coincidem'
        }

        // Role validation
        if (!formData.role) {
            newErrors.role = 'Função é obrigatória'
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
            const userData = {
                username: formData.username.trim(),
                email: formData.email.trim().toLowerCase(),
                password: formData.password,
                role: formData.role
            }

            const response = await adminApi.createUser(userData)

            onUserCreated(response.user)
            resetForm()
            onOpenChange(false)

            toast({
                title: "Usuário criado com sucesso!",
                description: `Usuário "${response.user.username}" foi criado com a função "${response.user.role}".`,
            })
        } catch (error) {
            const errorMessage = handleApiError(error)
            setErrors({ general: errorMessage })

            toast({
                title: "Erro ao criar usuário",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleInputChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))

        // Clear field error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }))
        }
    }

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && !isLoading) {
            resetForm()
        }
        onOpenChange(newOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Criar Novo Usuário
                    </DialogTitle>
                    <DialogDescription>
                        Preencha os dados para criar uma nova conta de usuário no sistema.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {errors.general && (
                        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded">
                            {errors.general}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {/* Username */}
                        <div className="space-y-2">
                            <Label htmlFor="username">Nome de usuário*</Label>
                            <Input
                                id="username"
                                value={formData.username}
                                onChange={(e) => handleInputChange('username', e.target.value)}
                                placeholder="Ex: joao.silva"
                                disabled={isLoading}
                                className={errors.username ? 'border-destructive' : ''}
                            />
                            {errors.username && (
                                <p className="text-sm text-destructive">{errors.username}</p>
                            )}
                        </div>

                        {/* Role */}
                        <div className="space-y-2">
                            <Label htmlFor="role">Função*</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(value) => handleInputChange('role', value)}
                                disabled={isLoading}
                            >
                                <SelectTrigger className={errors.role ? 'border-destructive' : ''}>
                                    <SelectValue placeholder="Selecionar função" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">Usuário</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.role && (
                                <p className="text-sm text-destructive">{errors.role}</p>
                            )}
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email*</Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            placeholder="Ex: joao.silva@igreja.com"
                            disabled={isLoading}
                            className={errors.email ? 'border-destructive' : ''}
                        />
                        {errors.email && (
                            <p className="text-sm text-destructive">{errors.email}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Password */}
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha*</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => handleInputChange('password', e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    disabled={isLoading}
                                    className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={isLoading}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            {errors.password && (
                                <p className="text-sm text-destructive">{errors.password}</p>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar Senha*</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={formData.confirmPassword}
                                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                                    placeholder="Confirme a senha"
                                    disabled={isLoading}
                                    className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    disabled={isLoading}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            {errors.confirmPassword && (
                                <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isLoading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                    Criando...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="h-4 w-4" />
                                    Criar Usuário
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}