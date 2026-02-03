'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { rolesApi, handleApiError } from '@/lib/api'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ErrorState } from '@/components/ui/error-state'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'
import {
    Shield,
    Plus,
    Trash2,
    Save,
    Crown,
    Star,
    Users,
    Lock,
    Loader2,
    AlertTriangle,
    Search,
    Check
} from 'lucide-react'

interface RoleItem {
    id: number
    name: string
    display_name: string
    description?: string
    is_system_role: boolean
    is_default: boolean
    priority: number
    user_count: number
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

const permissionLabels: Record<keyof RoleItem['permissions'], { label: string; description: string }> = {
    can_view_music: { label: 'Visualizar músicas', description: 'Permite ver a lista de músicas e detalhes' },
    can_download_music: { label: 'Baixar músicas', description: 'Permite fazer download dos PDFs' },
    can_edit_music_metadata: { label: 'Editar metadados', description: 'Permite editar informações das músicas' },
    can_upload_music: { label: 'Fazer upload', description: 'Permite enviar novas músicas para o sistema' },
    can_delete_music: { label: 'Deletar músicas', description: 'Permite remover músicas permanentemente' },
    can_manage_lists: { label: 'Gerenciar listas', description: 'Permite criar, editar e excluir listas de músicas' },
    can_manage_categories: { label: 'Gerenciar categorias', description: 'Permite criar e editar categorias e tempos litúrgicos' },
    can_manage_users: { label: 'Gerenciar usuários', description: 'Permite criar, editar e excluir usuários' },
    can_manage_roles: { label: 'Gerenciar roles', description: 'Permite configurar roles e permissões' },
    can_access_admin: { label: 'Acessar admin', description: 'Permite acessar áreas administrativas do sistema' }
}

export default function RolesPage() {
    const { toast } = useToast()
    const { canManageRoles, isAuthenticated } = useAuth()
    const [roles, setRoles] = useState<RoleItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    // Selected role state
    const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null)
    const [editedRole, setEditedRole] = useState<RoleItem | null>(null)
    const [hasChanges, setHasChanges] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Create dialog
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [createForm, setCreateForm] = useState({ name: '', displayName: '', description: '' })
    const [isCreating, setIsCreating] = useState(false)

    // Delete confirmation
    const [deleteRoleId, setDeleteRoleId] = useState<number | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Unsaved changes dialog
    const [pendingRoleSwitch, setPendingRoleSwitch] = useState<RoleItem | null>(null)
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

    const loadRoles = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)
            const data = await rolesApi.getAll()
            setRoles(data.roles || [])
        } catch (error) {
            setError(handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadRoles()
    }, [loadRoles])

    // Check for changes when editedRole changes
    useEffect(() => {
        if (!selectedRole || !editedRole) {
            setHasChanges(false)
            return
        }
        const changed = JSON.stringify(selectedRole) !== JSON.stringify(editedRole)
        setHasChanges(changed)
    }, [selectedRole, editedRole])

    const handleSelectRole = (role: RoleItem) => {
        if (hasChanges) {
            setPendingRoleSwitch(role)
            setShowUnsavedDialog(true)
            return
        }
        setSelectedRole(role)
        setEditedRole({ ...role })
    }

    const handleDiscardAndSwitch = () => {
        if (pendingRoleSwitch) {
            setSelectedRole(pendingRoleSwitch)
            setEditedRole({ ...pendingRoleSwitch })
        }
        setShowUnsavedDialog(false)
        setPendingRoleSwitch(null)
    }

    const handleSaveRole = async () => {
        if (!editedRole) return

        setIsSaving(true)
        try {
            await rolesApi.update(editedRole.id, {
                display_name: editedRole.display_name,
                description: editedRole.description,
                priority: editedRole.priority,
                permissions: editedRole.permissions
            })
            toast({ title: 'Sucesso', description: 'Role atualizada com sucesso!' })
            setSelectedRole(editedRole)
            setHasChanges(false)
            loadRoles()
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        } finally {
            setIsSaving(false)
        }
    }

    const handleCreateRole = async () => {
        if (!createForm.name || !createForm.displayName) {
            toast({ title: 'Erro', description: 'Nome e nome de exibição são obrigatórios', variant: 'destructive' })
            return
        }

        setIsCreating(true)
        try {
            await rolesApi.create({
                name: createForm.name.toLowerCase().replace(/\s+/g, '_'),
                display_name: createForm.displayName,
                description: createForm.description || undefined,
                permissions: {
                    can_view_music: true,
                    can_download_music: true,
                    can_edit_music_metadata: false,
                    can_upload_music: false,
                    can_delete_music: false,
                    can_manage_lists: false,
                    can_manage_categories: false,
                    can_manage_users: false,
                    can_manage_roles: false,
                    can_access_admin: false
                }
            })
            toast({ title: 'Sucesso', description: 'Role criada com sucesso!' })
            setIsCreateOpen(false)
            setCreateForm({ name: '', displayName: '', description: '' })
            loadRoles()
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        } finally {
            setIsCreating(false)
        }
    }

    const handleDeleteRole = async () => {
        if (!deleteRoleId) return

        const roleToDelete = roles.find(r => r.id === deleteRoleId)
        
        setIsDeleting(true)
        try {
            await rolesApi.delete(deleteRoleId)
            toast({ title: 'Sucesso', description: 'Role excluída com sucesso!' })
            setDeleteRoleId(null)
            if (selectedRole?.id === deleteRoleId) {
                setSelectedRole(null)
                setEditedRole(null)
            }
            loadRoles()
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        } finally {
            setIsDeleting(false)
        }
    }

    const handleSetDefault = async (roleId: number) => {
        try {
            await rolesApi.setDefault(roleId)
            toast({ title: 'Sucesso', description: 'Role definida como padrão!' })
            loadRoles()
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        }
    }

    const updatePermission = (key: keyof RoleItem['permissions'], value: boolean) => {
        if (!editedRole) return
        setEditedRole({
            ...editedRole,
            permissions: {
                ...editedRole.permissions,
                [key]: value
            }
        })
    }

    const filteredRoles = roles.filter(role =>
        role.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

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

    if (!canManageRoles) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                    <Lock className="h-16 w-16 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Permissão Insuficiente</h2>
                    <p className="text-muted-foreground">
                        Você não tem permissão para gerenciar roles.
                    </p>
                </div>
            </MainLayout>
        )
    }

    if (isLoading) {
        return (
            <MainLayout>
                <LoadingSpinner message="Carregando roles..." />
            </MainLayout>
        )
    }

    if (error) {
        return (
            <MainLayout>
                <ErrorState message={error} onRetry={loadRoles} />
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Configuração de Roles"
                    description="Gerencie roles e permissões do sistema"
                    icon={Shield}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
                    {/* Left Panel - Role List */}
                    <Card className="lg:col-span-1">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Roles</CardTitle>
                                <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Nova
                                </Button>
                            </div>
                            <div className="relative mt-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar role..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[500px]">
                                <div className="space-y-1 p-2">
                                    {filteredRoles.map((role) => (
                                        <button
                                            key={role.id}
                                            onClick={() => handleSelectRole(role)}
                                            className={cn(
                                                "w-full text-left p-3 rounded-lg transition-colors",
                                                "hover:bg-muted/50",
                                                selectedRole?.id === role.id && "bg-primary/10 border border-primary/20"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        {role.is_system_role ? (
                                                            <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                                                        ) : (
                                                            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        )}
                                                        <span className="font-medium truncate">{role.display_name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                        <Star className="h-3 w-3" />
                                                        <span>{role.priority}</span>
                                                        <span className="mx-1">•</span>
                                                        <Users className="h-3 w-3" />
                                                        <span>{role.user_count}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    {role.is_system_role && (
                                                        <Badge variant="secondary" className="text-xs">Sistema</Badge>
                                                    )}
                                                    {role.is_default && (
                                                        <Badge variant="default" className="text-xs">Padrão</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredRoles.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            Nenhuma role encontrada
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Right Panel - Role Details */}
                    <Card className="lg:col-span-2">
                        {editedRole ? (
                            <>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                {editedRole.is_system_role ? (
                                                    <Crown className="h-5 w-5 text-amber-500" />
                                                ) : (
                                                    <Shield className="h-5 w-5 text-primary" />
                                                )}
                                                {editedRole.display_name}
                                                {hasChanges && (
                                                    <Badge variant="outline" className="text-amber-600 border-amber-300 ml-2">
                                                        Não salvo
                                                    </Badge>
                                                )}
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                {editedRole.description || 'Sem descrição'}
                                            </CardDescription>
                                        </div>
                                        <Button onClick={handleSaveRole} disabled={!hasChanges || isSaving}>
                                            {isSaving ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : (
                                                <Save className="h-4 w-4 mr-2" />
                                            )}
                                            Salvar
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="h-[480px] pr-4">
                                        <div className="space-y-6">
                                            {/* Basic Info */}
                                            <div className="space-y-4">
                                                <h3 className="font-semibold flex items-center gap-2">
                                                    Informações Básicas
                                                </h3>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <Label>Nome de Exibição</Label>
                                                        <Input
                                                            value={editedRole.display_name}
                                                            onChange={(e) => setEditedRole({ ...editedRole, display_name: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Prioridade</Label>
                                                        <Input
                                                            type="number"
                                                            value={editedRole.priority}
                                                            onChange={(e) => setEditedRole({ ...editedRole, priority: Number(e.target.value) })}
                                                        />
                                                        <p className="text-xs text-muted-foreground">
                                                            Maior número = mais permissões
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Descrição</Label>
                                                    <Input
                                                        value={editedRole.description || ''}
                                                        onChange={(e) => setEditedRole({ ...editedRole, description: e.target.value })}
                                                        placeholder="Descreva a função desta role..."
                                                    />
                                                </div>
                                            </div>

                                            <Separator />

                                            {/* Permissions */}
                                            <div className="space-y-4">
                                                <h3 className="font-semibold flex items-center gap-2">
                                                    <Check className="h-4 w-4" />
                                                    Permissões
                                                </h3>
                                                <div className="grid gap-3">
                                                    {(Object.entries(permissionLabels) as [keyof RoleItem['permissions'], { label: string; description: string }][]).map(([key, { label, description }]) => (
                                                        <div
                                                            key={key}
                                                            className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                                                        >
                                                            <Checkbox
                                                                id={key}
                                                                checked={editedRole.permissions[key]}
                                                                onCheckedChange={(checked) => updatePermission(key, checked as boolean)}
                                                            />
                                                            <div className="flex-1">
                                                                <label
                                                                    htmlFor={key}
                                                                    className="text-sm font-medium cursor-pointer"
                                                                >
                                                                    {label}
                                                                </label>
                                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                                    {description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <Separator />

                                            {/* Actions */}
                                            <div className="space-y-4">
                                                <h3 className="font-semibold flex items-center gap-2">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    Ações
                                                </h3>
                                                <div className="flex flex-wrap gap-3">
                                                    {!editedRole.is_default && (
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => handleSetDefault(editedRole.id)}
                                                        >
                                                            <Star className="h-4 w-4 mr-2" />
                                                            Definir como Padrão
                                                        </Button>
                                                    )}
                                                    {!editedRole.is_system_role && !editedRole.is_default && (
                                                        <Button
                                                            variant="destructive"
                                                            onClick={() => setDeleteRoleId(editedRole.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Excluir Role
                                                        </Button>
                                                    )}
                                                </div>
                                                {editedRole.is_system_role && (
                                                    <p className="text-sm text-amber-600 flex items-center gap-2">
                                                        <AlertTriangle className="h-4 w-4" />
                                                        Esta é uma role do sistema. Altere com cuidado.
                                                    </p>
                                                )}
                                                {editedRole.is_default && (
                                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                        <Star className="h-4 w-4" />
                                                        Esta é a role padrão. Novos usuários e usuários de roles excluídas serão atribuídos a ela.
                                                    </p>
                                                )}
                                                {editedRole.user_count > 0 && (
                                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                        <Users className="h-4 w-4" />
                                                        {editedRole.user_count} usuário(s) possuem esta role.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-6">
                                <Shield className="h-16 w-16 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Selecione uma Role</h3>
                                <p className="text-muted-foreground max-w-sm">
                                    Clique em uma role na lista ao lado para visualizar e editar suas permissões.
                                </p>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Create Role Dialog */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Criar Nova Role</DialogTitle>
                            <DialogDescription>
                                Defina o nome e descrição da nova role. As permissões podem ser configuradas depois.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nome Interno *</Label>
                                <Input
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                    placeholder="ex: editor_musicas"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Usado internamente. Será convertido para lowercase sem espaços.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Nome de Exibição *</Label>
                                <Input
                                    value={createForm.displayName}
                                    onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                                    placeholder="ex: Editor de Músicas"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Descrição</Label>
                                <Input
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                    placeholder="Descreva o propósito desta role..."
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                            <Button onClick={handleCreateRole} disabled={isCreating}>
                                {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Criar Role
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation */}
                <AlertDialog open={deleteRoleId !== null} onOpenChange={(open) => !open && setDeleteRoleId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Role</AlertDialogTitle>
                            <AlertDialogDescription>
                                {(() => {
                                    const role = roles.find(r => r.id === deleteRoleId)
                                    if (!role) return null
                                    if (role.user_count > 0) {
                                        const defaultRole = roles.find(r => r.is_default)
                                        return (
                                            <>
                                                Tem certeza que deseja excluir a role <strong>{role.display_name}</strong>?
                                                <br /><br />
                                                <strong className="text-amber-600">{role.user_count} usuário(s)</strong> serão movidos 
                                                para a role padrão {defaultRole ? <strong>({defaultRole.display_name})</strong> : ''}.
                                            </>
                                        )
                                    }
                                    return (
                                        <>
                                            Tem certeza que deseja excluir a role <strong>{role.display_name}</strong>?
                                            Esta ação não pode ser desfeita.
                                        </>
                                    )
                                })()}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteRole}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={isDeleting}
                            >
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Unsaved Changes Dialog */}
                <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
                            <AlertDialogDescription>
                                Você tem alterações não salvas. Deseja descartar as alterações e continuar?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setPendingRoleSwitch(null)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDiscardAndSwitch}>
                                Descartar Alterações
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </MainLayout>
    )
}
