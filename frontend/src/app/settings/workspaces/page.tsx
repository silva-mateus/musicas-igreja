'use client'

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@core/components/ui/card'
import { Button } from '@core/components/ui/button'
import { Input } from '@core/components/ui/input'
import { Label } from '@core/components/ui/label'
import { Badge } from '@core/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@core/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@core/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useToast } from '@core/hooks/use-toast'
import { useAuth } from '@core/contexts/auth-context'
import { useWorkspace } from '@/contexts/workspace-context'
import { workspacesApi, customFiltersApi, handleApiError, type Workspace, type CustomFilterGroup } from '@/lib/api'
import {
    Layers,
    Plus,
    Edit,
    Trash2,
    Music,
    FolderOpen,
    List,
    Lock,
    Loader2,
    Filter,
    ChevronDown,
    ChevronRight,
    Save,
    Merge,
    X
} from 'lucide-react'

const PRESET_COLORS = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
]

interface WorkspaceFormData {
    name: string
    description: string
    icon: string
    color: string
}

const defaultFormData: WorkspaceFormData = {
    name: '',
    description: '',
    icon: 'music',
    color: '#3b82f6',
}

function WorkspaceFormDialog({
    open,
    onOpenChange,
    onSubmit,
    initialData,
    title,
    description,
    submitLabel,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: WorkspaceFormData) => Promise<void>
    initialData: WorkspaceFormData
    title: string
    description: string
    submitLabel: string
}) {
    const [formData, setFormData] = useState<WorkspaceFormData>(initialData)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (open) setFormData(initialData)
    }, [open, initialData])

    const handleSubmit = async () => {
        setIsSaving(true)
        try {
            await onSubmit(formData)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ws-name">Nome *</Label>
                        <Input
                            id="ws-name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Ex: Banda, Coral, Evento..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ws-description">Descrição</Label>
                        <Input
                            id="ws-description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Descrição opcional do workspace"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Cor</Label>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                                        formData.color === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function WorkspacesPage() {
    const { toast } = useToast()
    const { isAuthenticated, hasPermission } = useAuth()
    const isAdmin = hasPermission('admin:access')
    const { workspaces, isLoading, refetchWorkspaces } = useWorkspace()

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; workspace: Workspace | null }>({ open: false, workspace: null })
    const [isDeleting, setIsDeleting] = useState(false)

    // Filter groups state
    const [expandedWorkspace, setExpandedWorkspace] = useState<number | null>(null)
    const [filterGroups, setFilterGroups] = useState<Record<number, CustomFilterGroup[]>>({})
    const [loadingGroups, setLoadingGroups] = useState<number | null>(null)

    // Filter group CRUD
    const [newGroupName, setNewGroupName] = useState('')
    const [addingGroupForWs, setAddingGroupForWs] = useState<number | null>(null)
    const [editingGroup, setEditingGroup] = useState<{ id: number; name: string } | null>(null)
    const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null)

    // Filter value CRUD
    const [newValueName, setNewValueName] = useState('')
    const [addingValueForGroup, setAddingValueForGroup] = useState<number | null>(null)
    const [editingValue, setEditingValue] = useState<{ id: number; name: string } | null>(null)
    const [deletingValueId, setDeletingValueId] = useState<number | null>(null)

    // Merge dialog
    const [mergeDialog, setMergeDialog] = useState<{ open: boolean; sourceId: number; groupId: number } | null>(null)
    const [mergeTargetId, setMergeTargetId] = useState('')
    const [isMerging, setIsMerging] = useState(false)

    const [savingEntity, setSavingEntity] = useState(false)

    const loadFilterGroups = useCallback(async (workspaceId: number) => {
        setLoadingGroups(workspaceId)
        try {
            const data = await customFiltersApi.getGroups(workspaceId)
            setFilterGroups(prev => ({ ...prev, [workspaceId]: data.groups || [] }))
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        } finally {
            setLoadingGroups(null)
        }
    }, [toast])

    const toggleWorkspaceFilters = (wsId: number) => {
        if (expandedWorkspace === wsId) {
            setExpandedWorkspace(null)
        } else {
            setExpandedWorkspace(wsId)
            if (!filterGroups[wsId]) {
                loadFilterGroups(wsId)
            }
        }
    }

    const handleCreate = async (data: WorkspaceFormData) => {
        if (!data.name.trim()) {
            toast({ title: 'Erro', description: 'Nome do workspace é obrigatório', variant: 'destructive' })
            return
        }
        try {
            await workspacesApi.create({
                name: data.name.trim(),
                description: data.description.trim() || undefined,
                icon: data.icon,
                color: data.color,
            })
            toast({ title: 'Sucesso', description: 'Workspace criado com sucesso!' })
            setIsCreateOpen(false)
            refetchWorkspaces()
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        }
    }

    const handleEdit = async (data: WorkspaceFormData) => {
        if (!editingWorkspace || !data.name.trim()) {
            toast({ title: 'Erro', description: 'Nome do workspace é obrigatório', variant: 'destructive' })
            return
        }
        try {
            await workspacesApi.update(editingWorkspace.id, {
                name: data.name.trim(),
                description: data.description.trim(),
                icon: data.icon,
                color: data.color,
            })
            toast({ title: 'Sucesso', description: 'Workspace atualizado com sucesso!' })
            setIsEditOpen(false)
            setEditingWorkspace(null)
            refetchWorkspaces()
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        }
    }

    const handleDelete = async () => {
        if (!deleteDialog.workspace) return
        try {
            setIsDeleting(true)
            await workspacesApi.delete(deleteDialog.workspace.id)
            toast({ title: 'Sucesso', description: 'Workspace excluído com sucesso!' })
            setDeleteDialog({ open: false, workspace: null })
            refetchWorkspaces()
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        } finally {
            setIsDeleting(false)
        }
    }

    const openEditDialog = (ws: Workspace) => {
        setEditingWorkspace(ws)
        setIsEditOpen(true)
    }

    const editInitialData: WorkspaceFormData = editingWorkspace ? {
        name: editingWorkspace.name,
        description: editingWorkspace.description || '',
        icon: editingWorkspace.icon || 'music',
        color: editingWorkspace.color || '#3b82f6',
    } : defaultFormData

    // Filter Group CRUD handlers
    const handleCreateGroup = async (workspaceId: number) => {
        if (!newGroupName.trim()) return
        try {
            setSavingEntity(true)
            await customFiltersApi.createGroup(newGroupName.trim(), workspaceId)
            toast({ title: 'Sucesso', description: 'Grupo de filtro criado!' })
            setNewGroupName('')
            setAddingGroupForWs(null)
            await loadFilterGroups(workspaceId)
            refetchWorkspaces()
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        } finally {
            setSavingEntity(false)
        }
    }

    const handleUpdateGroup = async (workspaceId: number) => {
        if (!editingGroup || !editingGroup.name.trim()) return
        try {
            setSavingEntity(true)
            await customFiltersApi.updateGroup(editingGroup.id, editingGroup.name.trim())
            toast({ title: 'Sucesso', description: 'Grupo atualizado!' })
            setEditingGroup(null)
            await loadFilterGroups(workspaceId)
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        } finally {
            setSavingEntity(false)
        }
    }

    const handleDeleteGroup = async (groupId: number, workspaceId: number) => {
        try {
            setSavingEntity(true)
            await customFiltersApi.deleteGroup(groupId)
            toast({ title: 'Sucesso', description: 'Grupo excluído!' })
            setDeletingGroupId(null)
            await loadFilterGroups(workspaceId)
            refetchWorkspaces()
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        } finally {
            setSavingEntity(false)
        }
    }

    // Filter Value CRUD handlers
    const handleCreateValue = async (groupId: number, workspaceId: number) => {
        if (!newValueName.trim()) return
        try {
            setSavingEntity(true)
            await customFiltersApi.createValue(groupId, newValueName.trim())
            toast({ title: 'Sucesso', description: 'Valor adicionado!' })
            setNewValueName('')
            setAddingValueForGroup(null)
            await loadFilterGroups(workspaceId)
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        } finally {
            setSavingEntity(false)
        }
    }

    const handleUpdateValue = async (workspaceId: number) => {
        if (!editingValue || !editingValue.name.trim()) return
        try {
            setSavingEntity(true)
            await customFiltersApi.updateValue(editingValue.id, editingValue.name.trim())
            toast({ title: 'Sucesso', description: 'Valor atualizado!' })
            setEditingValue(null)
            await loadFilterGroups(workspaceId)
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        } finally {
            setSavingEntity(false)
        }
    }

    const handleDeleteValue = async (valueId: number, workspaceId: number) => {
        try {
            setSavingEntity(true)
            await customFiltersApi.deleteValue(valueId)
            toast({ title: 'Sucesso', description: 'Valor excluído!' })
            setDeletingValueId(null)
            await loadFilterGroups(workspaceId)
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        } finally {
            setSavingEntity(false)
        }
    }

    const handleMergeValues = async (workspaceId: number) => {
        if (!mergeDialog || !mergeTargetId) return
        try {
            setIsMerging(true)
            const result = await customFiltersApi.mergeValues(mergeDialog.sourceId, parseInt(mergeTargetId))
            toast({ title: 'Sucesso', description: result.message })
            setMergeDialog(null)
            setMergeTargetId('')
            await loadFilterGroups(workspaceId)
        } catch (error) {
            toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' })
        } finally {
            setIsMerging(false)
        }
    }

    if (!isAuthenticated || !isAdmin) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                    <Lock className="h-16 w-16 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
                    <p className="text-muted-foreground">
                        Apenas administradores podem gerenciar workspaces.
                    </p>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    icon={Layers}
                    title="Workspaces"
                    description="Gerencie os contextos de organização musical e seus filtros personalizados"
                >
                    <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Novo Workspace
                    </Button>
                </PageHeader>

                {isLoading ? (
                    <LoadingSpinner />
                ) : workspaces.length === 0 ? (
                    <EmptyState
                        icon={Layers}
                        title="Nenhum workspace encontrado"
                        description="Crie seu primeiro workspace para começar a organizar suas músicas."
                    />
                ) : (
                    <div className="space-y-4">
                        {workspaces.map(ws => (
                            <Card key={ws.id} className="relative overflow-hidden">
                                <div
                                    className="absolute top-0 left-0 right-0 h-1"
                                    style={{ backgroundColor: ws.color || '#3b82f6' }}
                                />
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="h-10 w-10 rounded-lg flex items-center justify-center"
                                                style={{ backgroundColor: `${ws.color || '#3b82f6'}20` }}
                                            >
                                                <Layers className="h-5 w-5" style={{ color: ws.color || '#3b82f6' }} />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">{ws.name}</CardTitle>
                                                {ws.description && (
                                                    <CardDescription className="text-xs mt-0.5">{ws.description}</CardDescription>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(ws)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => setDeleteDialog({ open: true, workspace: ws })}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-4">
                                    <div className="grid grid-cols-4 gap-3 text-center">
                                        <div className="rounded-lg bg-muted/50 p-2">
                                            <Music className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                            <p className="text-lg font-bold">{ws.music_count}</p>
                                            <p className="text-xs text-muted-foreground">Músicas</p>
                                        </div>
                                        <div className="rounded-lg bg-muted/50 p-2">
                                            <FolderOpen className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                            <p className="text-lg font-bold">{ws.category_count}</p>
                                            <p className="text-xs text-muted-foreground">Categorias</p>
                                        </div>
                                        <div className="rounded-lg bg-muted/50 p-2">
                                            <List className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                            <p className="text-lg font-bold">{ws.list_count}</p>
                                            <p className="text-xs text-muted-foreground">Listas</p>
                                        </div>
                                        <div className="rounded-lg bg-muted/50 p-2">
                                            <Filter className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                            <p className="text-lg font-bold">{ws.filter_group_count}</p>
                                            <p className="text-xs text-muted-foreground">Filtros</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        <Badge variant={ws.is_active ? 'default' : 'secondary'} className="text-xs">
                                            {ws.is_active ? 'Ativo' : 'Inativo'}
                                        </Badge>
                                    </div>

                                    {/* Filter Groups Section */}
                                    <Collapsible open={expandedWorkspace === ws.id} onOpenChange={() => toggleWorkspaceFilters(ws.id)}>
                                        <CollapsibleTrigger asChild>
                                            <Button variant="outline" size="sm" className="w-full justify-between gap-2">
                                                <span className="flex items-center gap-2">
                                                    <Filter className="h-4 w-4" />
                                                    Grupos de Filtro ({ws.filter_group_count})
                                                </span>
                                                {expandedWorkspace === ws.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-3">
                                            {loadingGroups === ws.id ? (
                                                <div className="py-4 text-center text-muted-foreground text-sm">
                                                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                                                    Carregando filtros...
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {(filterGroups[ws.id] || []).map(group => (
                                                        <div key={group.id} className="border rounded-lg p-3 space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                {editingGroup?.id === group.id ? (
                                                                    <div className="flex items-center gap-2 flex-1">
                                                                        <Input
                                                                            value={editingGroup.name}
                                                                            onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                                                            className="h-8 text-sm"
                                                                            onKeyDown={e => { if (e.key === 'Enter') handleUpdateGroup(ws.id) }}
                                                                            autoFocus
                                                                        />
                                                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleUpdateGroup(ws.id)} disabled={savingEntity}>
                                                                            <Save className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingGroup(null)}>
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <span className="font-medium text-sm">{group.name}</span>
                                                                        <div className="flex gap-0.5">
                                                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingGroup({ id: group.id, name: group.name })}>
                                                                                <Edit className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                size="icon" variant="ghost"
                                                                                className="h-7 w-7 text-destructive hover:text-destructive"
                                                                                onClick={() => handleDeleteGroup(group.id, ws.id)}
                                                                                disabled={savingEntity}
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {/* Values */}
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {group.values.map(val => (
                                                                    <div key={val.id} className="group relative">
                                                                        {editingValue?.id === val.id ? (
                                                                            <div className="flex items-center gap-1">
                                                                                <Input
                                                                                    value={editingValue.name}
                                                                                    onChange={e => setEditingValue({ ...editingValue, name: e.target.value })}
                                                                                    className="h-7 text-xs w-32"
                                                                                    onKeyDown={e => { if (e.key === 'Enter') handleUpdateValue(ws.id) }}
                                                                                    autoFocus
                                                                                />
                                                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdateValue(ws.id)} disabled={savingEntity}>
                                                                                    <Save className="h-3 w-3" />
                                                                                </Button>
                                                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingValue(null)}>
                                                                                    <X className="h-3 w-3" />
                                                                                </Button>
                                                                            </div>
                                                                        ) : (
                                                                            <Badge
                                                                                variant="secondary"
                                                                                className="text-xs cursor-default pr-1 gap-1"
                                                                            >
                                                                                {val.name}
                                                                                <span className="text-muted-foreground">({val.file_count})</span>
                                                                                <span className="hidden group-hover:inline-flex gap-0.5 ml-1">
                                                                                    <button
                                                                                        className="hover:text-primary"
                                                                                        onClick={() => setEditingValue({ id: val.id, name: val.name })}
                                                                                    >
                                                                                        <Edit className="h-3 w-3" />
                                                                                    </button>
                                                                                    {group.values.length > 1 && (
                                                                                        <button
                                                                                            className="hover:text-primary"
                                                                                            onClick={() => {
                                                                                                setMergeDialog({ open: true, sourceId: val.id, groupId: group.id })
                                                                                                setMergeTargetId('')
                                                                                            }}
                                                                                        >
                                                                                            <Merge className="h-3 w-3" />
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        className="hover:text-destructive"
                                                                                        onClick={() => handleDeleteValue(val.id, ws.id)}
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                    </button>
                                                                                </span>
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Add value */}
                                                            {addingValueForGroup === group.id ? (
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <Input
                                                                        value={newValueName}
                                                                        onChange={e => setNewValueName(e.target.value)}
                                                                        placeholder="Nome do valor..."
                                                                        className="h-7 text-xs"
                                                                        onKeyDown={e => { if (e.key === 'Enter') handleCreateValue(group.id, ws.id) }}
                                                                        autoFocus
                                                                    />
                                                                    <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleCreateValue(group.id, ws.id)} disabled={savingEntity}>
                                                                        Adicionar
                                                                    </Button>
                                                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAddingValueForGroup(null); setNewValueName('') }}>
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <Button
                                                                    size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground"
                                                                    onClick={() => { setAddingValueForGroup(group.id); setNewValueName('') }}
                                                                >
                                                                    <Plus className="h-3 w-3" /> Adicionar valor
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}

                                                    {/* Add group */}
                                                    {addingGroupForWs === ws.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                value={newGroupName}
                                                                onChange={e => setNewGroupName(e.target.value)}
                                                                placeholder="Nome do grupo (ex: Tempo Litúrgico, Estilo...)"
                                                                className="h-8 text-sm"
                                                                onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(ws.id) }}
                                                                autoFocus
                                                            />
                                                            <Button size="sm" onClick={() => handleCreateGroup(ws.id)} disabled={savingEntity}>
                                                                Criar
                                                            </Button>
                                                            <Button size="icon" variant="ghost" onClick={() => { setAddingGroupForWs(null); setNewGroupName('') }}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            variant="outline" size="sm" className="gap-1.5 w-full"
                                                            onClick={() => { setAddingGroupForWs(ws.id); setNewGroupName('') }}
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                            Novo Grupo de Filtro
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </CollapsibleContent>
                                    </Collapsible>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <WorkspaceFormDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSubmit={handleCreate}
                initialData={defaultFormData}
                title="Novo Workspace"
                description="Crie um novo contexto para organizar suas músicas."
                submitLabel="Criar Workspace"
            />

            <WorkspaceFormDialog
                open={isEditOpen}
                onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingWorkspace(null) }}
                onSubmit={handleEdit}
                initialData={editInitialData}
                title="Editar Workspace"
                description="Atualize as informações do workspace."
                submitLabel="Salvar Alterações"
            />

            {/* Delete Confirmation */}
            <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Workspace</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o workspace &quot;{deleteDialog.workspace?.name}&quot;?
                            {(deleteDialog.workspace?.music_count ?? 0) > 0 && (
                                <span className="block mt-2 font-semibold text-destructive">
                                    Este workspace possui {deleteDialog.workspace?.music_count} música(s).
                                    Não é possível excluir workspaces com músicas associadas.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Merge Values Dialog */}
            <Dialog open={!!mergeDialog?.open} onOpenChange={(open) => { if (!open) setMergeDialog(null) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Consolidar Valor</DialogTitle>
                        <DialogDescription>
                            Todas as músicas associadas ao valor de origem serão transferidas para o valor de destino.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Transferir para:</Label>
                        <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Selecione o destino..." />
                            </SelectTrigger>
                            <SelectContent>
                                {mergeDialog && expandedWorkspace && filterGroups[expandedWorkspace]
                                    ?.find(g => g.id === mergeDialog.groupId)
                                    ?.values.filter(v => v.id !== mergeDialog.sourceId)
                                    .map(v => (
                                        <SelectItem key={v.id} value={String(v.id)}>
                                            {v.name} ({v.file_count} músicas)
                                        </SelectItem>
                                    ))
                                }
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMergeDialog(null)}>Cancelar</Button>
                        <Button
                            onClick={() => expandedWorkspace && handleMergeValues(expandedWorkspace)}
                            disabled={isMerging || !mergeTargetId}
                            variant="destructive"
                            className="gap-2"
                        >
                            {isMerging && <Loader2 className="h-4 w-4 animate-spin" />}
                            <Merge className="h-4 w-4" />
                            Consolidar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    )
}
