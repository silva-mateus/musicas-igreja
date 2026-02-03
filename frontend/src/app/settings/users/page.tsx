'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { usersApi, rolesApi, handleApiError } from '@/lib/api'
import {
    Users,
    Plus,
    KeyRound,
    Loader2,
    RefreshCw,
    UserCheck,
    UserX,
    Lock,
    Eye,
    EyeOff,
    AlertCircle,
    Trash2,
    Shield,
    Settings
} from 'lucide-react'

interface UserItem {
    id: number
    username: string
    full_name: string
    role: string
    role_id: number
    role_display_name?: string
    is_active: boolean
    must_change_password?: boolean
    created_at?: string
    last_login?: string
}

interface RoleItem {
    id: number
    name: string
    display_name: string
    description?: string
    is_system_role: boolean
    priority: number
    permissions: {
        can_view_music: boolean
        can_download_music: boolean
        can_edit_music_metadata: boolean
        can_upload_music: boolean
        can_delete_music: boolean
        can_manage_lists: boolean
        can_manage_categories: boolean
        can_manage_users: boolean
        can_manage_roles: boolean
        can_access_admin: boolean
    }
}

export default function UsersPage() {
    const { toast } = useToast()
    const { canManageUsers, canManageRoles, isAuthenticated, user } = useAuth()
    const [users, setUsers] = useState<UserItem[]>([])
    const [roles, setRoles] = useState<RoleItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingRoles, setIsLoadingRoles] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Create user dialog
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [createForm, setCreateForm] = useState({ username: '', fullName: '', password: '', roleId: 1 })
    const [isCreating, setIsCreating] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    // Reset password dialog
    const [isResetOpen, setIsResetOpen] = useState(false)
    const [resetUserId, setResetUserId] = useState<number | null>(null)
    const [resetUsername, setResetUsername] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [isResetting, setIsResetting] = useState(false)
    const [showResetPassword, setShowResetPassword] = useState(false)

    // Delete user dialog
    const [deleteUserId, setDeleteUserId] = useState<number | null>(null)
    const [deleteUsername, setDeleteUsername] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)


    const loadUsers = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)
            const data = await usersApi.getAll()
            setUsers(data.users || [])
        } catch (error) {
            setError(handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }, [])

    const loadRoles = useCallback(async () => {
        try {
            setIsLoadingRoles(true)
            const data = await rolesApi.getAll()
            setRoles(data.roles || [])
        } catch (error) {
            console.error('Error loading roles:', error)
        } finally {
            setIsLoadingRoles(false)
        }
    }, [])

    useEffect(() => {
        if (canManageUsers) {
            loadUsers()
        }
        loadRoles()
    }, [loadUsers, loadRoles, canManageUsers])

    const handleCreate = async () => {
        if (!createForm.username || !createForm.password) {
            toast({ title: 'Erro', description: 'Usuário e senha são obrigatórios', variant: 'destructive' })
            return
        }

        if (createForm.password.length < 4) {
            toast({ title: 'Erro', description: 'Senha deve ter pelo menos 4 caracteres', variant: 'destructive' })
            return
        }

        setIsCreating(true)
        try {
            const selectedRole = roles.find(r => r.id === createForm.roleId)
            await usersApi.create(
                createForm.username, 
                createForm.fullName || createForm.username, 
                createForm.password, 
                selectedRole?.name || 'viewer'
            )
            toast({ 
                title: 'Sucesso', 
                description: 'Usuário criado! Ele precisará trocar a senha no primeiro login.' 
            })
            setIsCreateOpen(false)
            setCreateForm({ username: '', fullName: '', password: '', roleId: 1 })
            setShowPassword(false)
            loadUsers()
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        } finally {
            setIsCreating(false)
        }
    }

    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 4) {
            toast({ title: 'Erro', description: 'Senha deve ter pelo menos 4 caracteres', variant: 'destructive' })
            return
        }

        setIsResetting(true)
        try {
            await usersApi.resetPassword(resetUserId!, newPassword)
            toast({ 
                title: 'Sucesso', 
                description: 'Senha resetada! O usuário precisará trocar a senha no próximo login.' 
            })
            setIsResetOpen(false)
            setNewPassword('')
            setShowResetPassword(false)
            loadUsers()
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        } finally {
            setIsResetting(false)
        }
    }

    const handleRoleChange = async (userId: number, newRoleId: number) => {
        try {
            const selectedRole = roles.find(r => r.id === newRoleId)
            await usersApi.updateRole(userId, selectedRole?.name || 'viewer')
            toast({ title: 'Sucesso', description: 'Role atualizada!' })
            loadUsers()
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        }
    }

    const handleToggleActive = async (targetUser: UserItem) => {
        try {
            if (targetUser.is_active) {
                await usersApi.deactivate(targetUser.id)
                toast({ title: 'Sucesso', description: 'Usuário desativado!' })
            } else {
                await usersApi.activate(targetUser.id)
                toast({ title: 'Sucesso', description: 'Usuário ativado!' })
            }
            loadUsers()
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        }
    }

    const handleDeleteUser = async () => {
        if (!deleteUserId) return

        setIsDeleting(true)
        try {
            await usersApi.deletePermanently(deleteUserId)
            toast({ title: 'Sucesso', description: 'Usuário excluído permanentemente!' })
            setDeleteUserId(null)
            setDeleteUsername('')
            loadUsers()
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        } finally {
            setIsDeleting(false)
        }
    }

    const openResetDialog = (targetUser: UserItem) => {
        setResetUserId(targetUser.id)
        setResetUsername(targetUser.username)
        setNewPassword('')
        setShowResetPassword(false)
        setIsResetOpen(true)
    }

    const openDeleteDialog = (targetUser: UserItem) => {
        setDeleteUserId(targetUser.id)
        setDeleteUsername(targetUser.username)
    }

    // Permission check
    if (!isAuthenticated) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                    <Lock className="h-16 w-16 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
                    <p className="text-muted-foreground">
                        Você precisa estar logado para acessar esta página.
                    </p>
                </div>
            </MainLayout>
        )
    }

    if (!canManageUsers && !canManageRoles) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                    <Lock className="h-16 w-16 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Permissão Insuficiente</h2>
                    <p className="text-muted-foreground">
                        Você não tem permissão para acessar esta área.
                    </p>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                            <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                            Configurações de Acesso
                        </h1>
                        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                            Gerencie usuários, roles e permissões do sistema
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 mb-4">
                    <Button variant="outline" asChild>
                        <Link href="/settings/roles">
                            <Shield className="h-4 w-4 mr-2" />
                            Gerenciar Roles
                        </Link>
                    </Button>
                </div>

                    {/* Users List */}
                {canManageUsers && (
                    <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Usuários Cadastrados</CardTitle>
                                        <CardDescription>
                                            {users.length} usuário(s) no sistema
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={loadUsers}>
                                            <RefreshCw className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                                            <Plus className="h-4 w-4 mr-1" />
                                            Novo Usuário
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : error ? (
                                        <div className="text-center py-8">
                                            <p className="text-destructive">{error}</p>
                                            <Button onClick={loadUsers} className="mt-4">Tentar novamente</Button>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Usuário</TableHead>
                                                        <TableHead>Nome Completo</TableHead>
                                                        <TableHead>Role</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Ações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {users.map((targetUser) => (
                                                        <TableRow key={targetUser.id}>
                                                            <TableCell className="font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    {targetUser.username}
                                                                    {targetUser.must_change_password && (
                                                                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                                                            <AlertCircle className="h-3 w-3 mr-1" />
                                                                            Trocar senha
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>{targetUser.full_name || '-'}</TableCell>
                                                            <TableCell>
                                                                <Select
                                                                    value={String(targetUser.role_id)}
                                                                    onValueChange={(value) => handleRoleChange(targetUser.id, Number(value))}
                                                                >
                                                                    <SelectTrigger className="w-36">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {roles.map((role) => (
                                                                            <SelectItem key={role.id} value={String(role.id)}>
                                                                                {role.display_name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant={targetUser.is_active ? 'default' : 'secondary'}>
                                                                    {targetUser.is_active ? 'Ativo' : 'Inativo'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => openResetDialog(targetUser)}
                                                                        title="Resetar senha"
                                                                    >
                                                                        <KeyRound className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleToggleActive(targetUser)}
                                                                        title={targetUser.is_active ? 'Desativar' : 'Ativar'}
                                                                    >
                                                                        {targetUser.is_active ? (
                                                                            <UserX className="h-4 w-4 text-amber-600" />
                                                                        ) : (
                                                                            <UserCheck className="h-4 w-4 text-green-600" />
                                                                        )}
                                                                    </Button>
                                                                    {user?.id !== targetUser.id && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => openDeleteDialog(targetUser)}
                                                                            title="Excluir permanentemente"
                                                                        >
                                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                    </Card>
                )}

                {/* Create User Dialog */}
                <Dialog open={isCreateOpen} onOpenChange={(open) => {
                    setIsCreateOpen(open)
                    if (!open) {
                        setShowPassword(false)
                        setCreateForm({ username: '', fullName: '', password: '', roleId: 1 })
                    }
                }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Criar Novo Usuário</DialogTitle>
                            <DialogDescription>
                                O usuário precisará trocar a senha no primeiro login.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Usuário *</Label>
                                <Input
                                    value={createForm.username}
                                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                                    placeholder="Digite o username"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Nome Completo</Label>
                                <Input
                                    value={createForm.fullName}
                                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                                    placeholder="Digite o nome completo"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Senha Inicial *</Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        value={createForm.password}
                                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                        placeholder="Digite a senha inicial"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Mínimo 4 caracteres. O usuário será obrigado a trocar no primeiro login.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Role</Label>
                                <Select
                                    value={String(createForm.roleId)}
                                    onValueChange={(value) => setCreateForm({ ...createForm, roleId: Number(value) })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem key={role.id} value={String(role.id)}>
                                                {role.display_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                            <Button onClick={handleCreate} disabled={isCreating}>
                                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Criar Usuário
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Reset Password Dialog */}
                <Dialog open={isResetOpen} onOpenChange={(open) => {
                    setIsResetOpen(open)
                    if (!open) {
                        setShowResetPassword(false)
                        setNewPassword('')
                    }
                }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Resetar Senha</DialogTitle>
                            <DialogDescription>
                                Defina uma nova senha para <strong>{resetUsername}</strong>. 
                                O usuário precisará trocar a senha no próximo login.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-2">
                            <Label>Nova Senha</Label>
                            <div className="relative">
                                <Input
                                    type={showResetPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Digite a nova senha"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() => setShowResetPassword(!showResetPassword)}
                                >
                                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Mínimo 4 caracteres.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsResetOpen(false)}>Cancelar</Button>
                            <Button onClick={handleResetPassword} disabled={isResetting}>
                                {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Resetar Senha
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete User Confirmation */}
                <AlertDialog open={deleteUserId !== null} onOpenChange={(open) => {
                    if (!open) {
                        setDeleteUserId(null)
                        setDeleteUsername('')
                    }
                }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Usuário Permanentemente</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir o usuário <strong>{deleteUsername}</strong>? 
                                Esta ação é <strong>irreversível</strong> e todos os dados do usuário serão perdidos.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteUser}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={isDeleting}
                            >
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Excluir Permanentemente
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </MainLayout>
    )
}
