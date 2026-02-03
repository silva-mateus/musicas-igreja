'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { LogIn, Loader2, Music, Key, Eye, EyeOff, AlertCircle } from 'lucide-react'

interface LoginModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
    const { toast } = useToast()
    const { login, changePassword } = useAuth()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    
    const [showChangePassword, setShowChangePassword] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showNewPassword, setShowNewPassword] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!username || !password) {
            toast({
                title: 'Erro',
                description: 'Preencha todos os campos',
                variant: 'destructive',
            })
            return
        }

        setIsLoading(true)

        const result = await login(username, password)

        if (result.success) {
            if (result.mustChangePassword) {
                setCurrentPassword(password)
                setShowChangePassword(true)
                toast({
                    title: 'Troca de senha obrigatória',
                    description: 'Por favor, defina uma nova senha para continuar.',
                })
            } else {
                toast({
                    title: 'Login realizado!',
                    description: 'Bem-vindo ao sistema!',
                })
                onOpenChange(false)
                resetForm()
                window.location.reload()
            }
        } else {
            toast({
                title: 'Erro no login',
                description: result.error || 'Credenciais inválidas',
                variant: 'destructive',
            })
        }

        setIsLoading(false)
    }

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!newPassword || !confirmPassword) {
            toast({
                title: 'Erro',
                description: 'Preencha todos os campos',
                variant: 'destructive',
            })
            return
        }

        if (newPassword.length < 4) {
            toast({
                title: 'Erro',
                description: 'A nova senha deve ter pelo menos 4 caracteres',
                variant: 'destructive',
            })
            return
        }

        if (newPassword !== confirmPassword) {
            toast({
                title: 'Erro',
                description: 'As senhas não coincidem',
                variant: 'destructive',
            })
            return
        }

        setIsLoading(true)

        const result = await changePassword(currentPassword, newPassword)

        if (result.success) {
            toast({
                title: 'Senha alterada!',
                description: 'Sua senha foi alterada com sucesso.',
            })
            onOpenChange(false)
            resetForm()
            window.location.reload()
        } else {
            toast({
                title: 'Erro ao alterar senha',
                description: result.error || 'Não foi possível alterar a senha',
                variant: 'destructive',
            })
        }

        setIsLoading(false)
    }

    const resetForm = () => {
        setUsername('')
        setPassword('')
        setShowChangePassword(false)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setShowNewPassword(false)
    }

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            resetForm()
        }
        onOpenChange(isOpen)
    }

    if (showChangePassword) {
        return (
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="flex justify-center mb-2">
                            <div className="p-3 bg-primary/10 rounded-full">
                                <Key className="h-6 w-6 text-primary" />
                            </div>
                        </div>
                        <DialogTitle className="text-center">Alterar Senha</DialogTitle>
                        <DialogDescription className="text-center">
                            <span className="flex items-center justify-center gap-2 text-muted-foreground">
                                <AlertCircle className="h-4 w-4" />
                                Você precisa criar uma nova senha para continuar
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-password">Nova Senha</Label>
                            <div className="relative">
                                <Input
                                    id="new-password"
                                    type={showNewPassword ? 'text' : 'password'}
                                    placeholder="Digite a nova senha"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    disabled={isLoading}
                                    autoComplete="new-password"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                            <Input
                                id="confirm-password"
                                type={showNewPassword ? 'text' : 'password'}
                                placeholder="Confirme a nova senha"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={isLoading}
                                autoComplete="new-password"
                            />
                        </div>
                        <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Alterando...
                                </>
                            ) : (
                                <>
                                    <Key className="h-4 w-4" />
                                    Alterar Senha
                                </>
                            )}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex justify-center mb-2">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <Music className="h-6 w-6 text-primary" />
                        </div>
                    </div>
                    <DialogTitle className="text-center">Entrar no Sistema</DialogTitle>
                    <DialogDescription className="text-center">
                        Entre para acessar funcionalidades de edição e upload
                    </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="modal-username">Usuário</Label>
                        <Input
                            id="modal-username"
                            type="text"
                            placeholder="Digite seu usuário"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLoading}
                            autoComplete="username"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="modal-password">Senha</Label>
                        <Input
                            id="modal-password"
                            type="password"
                            placeholder="Digite sua senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            autoComplete="current-password"
                        />
                    </div>
                    <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Entrando...
                            </>
                        ) : (
                            <>
                                <LogIn className="h-4 w-4" />
                                Entrar
                            </>
                        )}
                    </Button>
                </form>

                <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
                    <p>Usuário padrão: <code className="bg-muted px-1 rounded">admin</code></p>
                    <p>Senha: <code className="bg-muted px-1 rounded">admin123</code></p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
