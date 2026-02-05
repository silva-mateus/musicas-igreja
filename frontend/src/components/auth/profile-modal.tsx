'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, User, Eye, EyeOff, Lock } from 'lucide-react'

const profileSchema = z.object({
    fullName: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
})

const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
    newPassword: z.string().min(4, 'A nova senha deve ter pelo menos 4 caracteres'),
    confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
    message: 'A nova senha deve ser diferente da atual',
    path: ['newPassword'],
})

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

interface ProfileModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
    const { toast } = useToast()
    const { user, changePassword, updateProfile } = useAuth()
    const [isLoadingProfile, setIsLoadingProfile] = useState(false)
    const [isLoadingPassword, setIsLoadingPassword] = useState(false)
    const [showChangePassword, setShowChangePassword] = useState(false)
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)

    const profileForm = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            fullName: user?.full_name || '',
        },
    })

    const passwordForm = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
    })

    // Update form when user changes
    useEffect(() => {
        if (user?.full_name) {
            profileForm.setValue('fullName', user.full_name)
        }
    }, [user?.full_name, profileForm])

    const handleProfileSubmit = async (data: ProfileFormData) => {
        setIsLoadingProfile(true)

        const result = await updateProfile(data.fullName)

        if (result.success) {
            toast({
                title: 'Perfil atualizado!',
                description: 'Seu nome foi alterado com sucesso.',
            })
        } else {
            toast({
                title: 'Erro ao atualizar perfil',
                description: result.error || 'Não foi possível atualizar o perfil',
                variant: 'destructive',
            })
        }

        setIsLoadingProfile(false)
    }

    const handlePasswordSubmit = async (data: PasswordFormData) => {
        setIsLoadingPassword(true)

        const result = await changePassword(data.currentPassword, data.newPassword)

        if (result.success) {
            toast({
                title: 'Senha alterada!',
                description: 'Sua senha foi alterada com sucesso.',
            })
            passwordForm.reset()
            setShowChangePassword(false)
        } else {
            toast({
                title: 'Erro ao alterar senha',
                description: result.error || 'Não foi possível alterar a senha',
                variant: 'destructive',
            })
        }

        setIsLoadingPassword(false)
    }

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            passwordForm.reset()
            setShowChangePassword(false)
            setShowCurrentPassword(false)
            setShowNewPassword(false)
        }
        onOpenChange(isOpen)
    }

    const getRoleLabel = (role: string) => {
        const labels: Record<string, string> = {
            admin: 'Administrador',
            editor: 'Editor',
            uploader: 'Uploader',
            viewer: 'Visualizador'
        }
        return labels[role?.toLowerCase()] || role
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center">Meu Perfil</DialogTitle>
                    <DialogDescription asChild>
                        <div className="text-center text-sm text-muted-foreground">
                            <span className="font-medium">@{user?.username}</span>
                            <span className="mx-2">·</span>
                            <Badge variant="outline" className="font-normal">
                                {getRoleLabel(user?.role || '')}
                            </Badge>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                {/* Profile Form */}
                <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="full-name">Nome Completo</Label>
                        <Input
                            id="full-name"
                            type="text"
                            placeholder="Digite seu nome"
                            {...profileForm.register('fullName')}
                            disabled={isLoadingProfile}
                            className={profileForm.formState.errors.fullName ? 'border-destructive' : ''}
                        />
                        {profileForm.formState.errors.fullName && (
                            <p className="text-sm text-destructive">{profileForm.formState.errors.fullName.message}</p>
                        )}
                    </div>

                    <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isLoadingProfile || !profileForm.formState.isDirty}
                    >
                        {isLoadingProfile ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Salvando...
                            </>
                        ) : (
                            'Salvar Alterações'
                        )}
                    </Button>
                </form>

                <Separator className="my-4" />

                {/* Change Password Section */}
                {!showChangePassword ? (
                    <Button 
                        variant="outline" 
                        className="w-full gap-2"
                        onClick={() => setShowChangePassword(true)}
                    >
                        <Lock className="h-4 w-4" />
                        Alterar Senha
                    </Button>
                ) : (
                    <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-base font-medium">Alterar Senha</Label>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                    setShowChangePassword(false)
                                    passwordForm.reset()
                                }}
                            >
                                Cancelar
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="current-password">Senha Atual</Label>
                            <div className="relative">
                                <Input
                                    id="current-password"
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    placeholder="Digite sua senha atual"
                                    {...passwordForm.register('currentPassword')}
                                    disabled={isLoadingPassword}
                                    autoComplete="current-password"
                                    className={passwordForm.formState.errors.currentPassword ? 'border-destructive' : ''}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                >
                                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            {passwordForm.formState.errors.currentPassword && (
                                <p className="text-sm text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-password">Nova Senha</Label>
                            <div className="relative">
                                <Input
                                    id="new-password"
                                    type={showNewPassword ? 'text' : 'password'}
                                    placeholder="Digite a nova senha"
                                    {...passwordForm.register('newPassword')}
                                    disabled={isLoadingPassword}
                                    autoComplete="new-password"
                                    className={passwordForm.formState.errors.newPassword ? 'border-destructive' : ''}
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
                            {passwordForm.formState.errors.newPassword && (
                                <p className="text-sm text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                            <Input
                                id="confirm-password"
                                type={showNewPassword ? 'text' : 'password'}
                                placeholder="Confirme a nova senha"
                                {...passwordForm.register('confirmPassword')}
                                disabled={isLoadingPassword}
                                autoComplete="new-password"
                                className={passwordForm.formState.errors.confirmPassword ? 'border-destructive' : ''}
                            />
                            {passwordForm.formState.errors.confirmPassword && (
                                <p className="text-sm text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
                            )}
                        </div>

                        <Button type="submit" className="w-full gap-2" disabled={isLoadingPassword}>
                            {isLoadingPassword ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Alterando...
                                </>
                            ) : (
                                <>
                                    <Lock className="h-4 w-4" />
                                    Alterar Senha
                                </>
                            )}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
