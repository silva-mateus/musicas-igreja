'use client'

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@core/components/ui/card'
import { Button } from '@core/components/ui/button'
import { Input } from '@core/components/ui/input'
import { Badge } from '@core/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@core/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@core/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@core/components/ui/select'
import { Label } from '@core/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useToast } from '@core/hooks/use-toast'
import { useAuth } from '@core/contexts/auth-context'
import { useWorkspace } from '@/contexts/workspace-context'
import { request, customFiltersApi, handleApiError } from '@/lib/api'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
    FolderOpen,
    User,
    Plus,
    Trash2,
    Edit,
    Loader2,
    RefreshCw,
    Settings,
    Save,
    Merge,
    AlertTriangle,
    Lock,
    Filter,
    ChevronDown
} from 'lucide-react'
import { InstructionsModal, PAGE_INSTRUCTIONS } from '@/components/ui/instructions-modal'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'

interface EntityItem {
    id: number
    name: string
    description?: string
    file_count?: number
}

interface EntitySection {
    items: EntityItem[]
    isLoading: boolean
    error: string | null
}

interface FilterGroup {
    id: number
    name: string
    slug: string
    values: FilterValue[]
}

interface FilterValue {
    id: number
    name: string
    slug: string
    file_count?: number
}

interface DeleteDialogState {
    open: boolean
    type: 'category' | 'artist' | 'filter_value'
    item: EntityItem | null
    groupId?: number
}

export default function ManagePage() {
    const { toast } = useToast()
    const { hasPermission, isAuthenticated } = useAuth()
    const { activeWorkspace } = useWorkspace()
    const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')
    const canDelete = hasPermission('music:delete')

    const [categories, setCategories] = useState<EntitySection>({ items: [], isLoading: false, error: null })
    const [artists, setArtists] = useState<EntitySection>({ items: [], isLoading: false, error: null })
    const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([])
    const [filtersLoading, setFiltersLoading] = useState(false)
    const [filtersError, setFiltersError] = useState<string | null>(null)
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [addingType, setAddingType] = useState<'category' | 'artist' | 'filter_value'>('category')
    const [addingGroupId, setAddingGroupId] = useState<number | null>(null)
    const [newItemName, setNewItemName] = useState('')
    const [isAdding, setIsAdding] = useState(false)

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<EntityItem | null>(null)
    const [editingType, setEditingType] = useState<'category' | 'artist' | 'filter_value'>('category')
    const [editedName, setEditedName] = useState('')
    const [isEditing, setIsEditing] = useState(false)

    const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({ open: false, type: 'category', item: null })
    const [isDeleting, setIsDeleting] = useState(false)

    const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false)
    const [mergeType, setMergeType] = useState<'category' | 'artist' | 'filter_value'>('category')
    const [mergeSource, setMergeSource] = useState<EntityItem | null>(null)
    const [mergeGroupId, setMergeGroupId] = useState<number | null>(null)
    const [mergeTargetId, setMergeTargetId] = useState<string>('')
    const [isMerging, setIsMerging] = useState(false)

    const loadCategories = useCallback(async () => {
        try {
            setCategories(prev => ({ ...prev, isLoading: true, error: null }))
            const data = await request<any>('/categories/with-details')
            setCategories({ items: data.categories || [], isLoading: false, error: null })
        } catch (error) {
            setCategories({ items: [], isLoading: false, error: handleApiError(error) })
        }
    }, [])

    const loadArtists = useCallback(async () => {
        try {
            setArtists(prev => ({ ...prev, isLoading: true, error: null }))
            const data = await request<any>('/artists/with-details')
            setArtists({ items: data.artists || [], isLoading: false, error: null })
        } catch (error) {
            try {
                const fallbackData = await request<any>('/dashboard/get_artists')
                const artistItems: EntityItem[] = (fallbackData || []).map((name: string, index: number) => ({
                    id: index + 1,
                    name: name
                }))
                setArtists({ items: artistItems, isLoading: false, error: null })
            } catch {
                setArtists({ items: [], isLoading: false, error: handleApiError(error) })
            }
        }
    }, [])

    const loadFilters = useCallback(async () => {
        try {
            setFiltersLoading(true)
            setFiltersError(null)
            const data = await customFiltersApi.getGroups()
            setFilterGroups(data.groups || [])
        } catch (error) {
            setFiltersError(handleApiError(error))
        } finally {
            setFiltersLoading(false)
        }
    }, [])

    useEffect(() => {
        loadCategories()
        loadArtists()
        loadFilters()
    }, [loadCategories, loadArtists, loadFilters])

    const handleAdd = async () => {
        if (!newItemName.trim()) {
            toast({
                title: 'Erro',
                description: 'Digite um nome',
                variant: 'destructive',
            })
            return
        }

        setIsAdding(true)

        try {
            if (addingType === 'filter_value' && addingGroupId) {
                await customFiltersApi.createValue(addingGroupId, newItemName.trim())
            } else {
                const endpoints: Record<string, string> = {
                    category: '/categories',
                    artist: '/artists'
                }
                await request<any>(endpoints[addingType], {
                    method: 'POST',
                    body: JSON.stringify({ name: newItemName.trim() }),
                })
            }

            toast({
                title: 'Sucesso',
                description: 'Item adicionado com sucesso!',
            })

            setIsAddDialogOpen(false)
            setNewItemName('')

            if (addingType === 'category') loadCategories()
            else if (addingType === 'artist') loadArtists()
            else loadFilters()
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.message || 'Erro ao adicionar',
                variant: 'destructive',
            })
        } finally {
            setIsAdding(false)
        }
    }

    const handleEdit = async () => {
        if (!editingItem || !editedName.trim()) return

        setIsEditing(true)

        try {
            if (editingType === 'filter_value') {
                await customFiltersApi.updateValue(editingItem.id, editedName.trim())
            } else {
                const endpoints: Record<string, string> = {
                    category: `/categories/${editingItem.id}`,
                    artist: `/artists/${editingItem.id}`
                }
                await request<any>(endpoints[editingType], {
                    method: 'PUT',
                    body: JSON.stringify({ name: editedName.trim() }),
                })
            }

            toast({
                title: 'Sucesso',
                description: 'Nome atualizado com sucesso!',
            })

            setIsEditDialogOpen(false)
            setEditingItem(null)
            setEditedName('')

            if (editingType === 'category') loadCategories()
            else if (editingType === 'artist') loadArtists()
            else loadFilters()
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.message || 'Erro ao atualizar',
                variant: 'destructive',
            })
        } finally {
            setIsEditing(false)
        }
    }

    const handleMerge = async () => {
        if (!mergeSource || !mergeTargetId) return

        setIsMerging(true)

        try {
            if (mergeType === 'filter_value') {
                await customFiltersApi.mergeValues(mergeSource.id, parseInt(mergeTargetId))
            } else {
                const endpoints: Record<string, string> = {
                    category: `/categories/${mergeSource.id}/merge/${mergeTargetId}`,
                    artist: `/artists/${mergeSource.id}/merge/${mergeTargetId}`
                }
                await request<any>(endpoints[mergeType], { method: 'POST' })
            }

            toast({
                title: 'Sucesso',
                description: 'Itens consolidados com sucesso!',
            })

            setIsMergeDialogOpen(false)
            setMergeSource(null)
            setMergeTargetId('')

            if (mergeType === 'category') loadCategories()
            else if (mergeType === 'artist') loadArtists()
            else loadFilters()
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.message || 'Erro ao consolidar',
                variant: 'destructive',
            })
        } finally {
            setIsMerging(false)
        }
    }

    const handleDeleteConfirm = async () => {
        if (!deleteDialog.item) return

        setIsDeleting(true)

        try {
            if (deleteDialog.type === 'filter_value') {
                await customFiltersApi.deleteValue(deleteDialog.item.id)
            } else {
                const endpoints: Record<string, string> = {
                    category: `/categories/${deleteDialog.item.id}`,
                    artist: `/artists/${deleteDialog.item.id}`
                }
                await request<any>(endpoints[deleteDialog.type], { method: 'DELETE' })
            }

            toast({
                title: 'Sucesso',
                description: 'Item excluído com sucesso!',
            })

            setDeleteDialog({ open: false, type: 'category', item: null })

            if (deleteDialog.type === 'category') loadCategories()
            else if (deleteDialog.type === 'artist') loadArtists()
            else loadFilters()
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.message || 'Erro ao excluir',
                variant: 'destructive',
            })
        } finally {
            setIsDeleting(false)
        }
    }

    const openAddDialog = (type: 'category' | 'artist' | 'filter_value', groupId?: number) => {
        setAddingType(type)
        setAddingGroupId(groupId ?? null)
        setNewItemName('')
        setIsAddDialogOpen(true)
    }

    const openEditDialog = (item: EntityItem, type: 'category' | 'artist' | 'filter_value') => {
        setEditingItem(item)
        setEditingType(type)
        setEditedName(item.name)
        setIsEditDialogOpen(true)
    }

    const openMergeDialog = (item: EntityItem, type: 'category' | 'artist' | 'filter_value', groupId?: number) => {
        setMergeSource(item)
        setMergeType(type)
        setMergeGroupId(groupId ?? null)
        setMergeTargetId('')
        setIsMergeDialogOpen(true)
    }

    const openDeleteDialog = (item: EntityItem, type: 'category' | 'artist' | 'filter_value') => {
        setDeleteDialog({ open: true, type, item })
    }

    const toggleGroup = (groupId: number) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(groupId)) next.delete(groupId)
            else next.add(groupId)
            return next
        })
    }

    const getEntityTypeLabel = (type: 'category' | 'artist' | 'filter_value') => {
        const labels: Record<string, string> = {
            category: 'Categoria',
            artist: 'Artista',
            filter_value: 'Valor do Filtro'
        }
        return labels[type]
    }

    const getMergeTargetOptions = () => {
        if (!mergeSource) return []
        
        let items: EntityItem[] = []
        switch (mergeType) {
            case 'category':
                items = categories.items
                break
            case 'artist':
                items = artists.items
                break
            case 'filter_value': {
                const group = filterGroups.find(g => g.id === mergeGroupId)
                items = (group?.values || []).map(v => ({ id: v.id, name: v.name, file_count: v.file_count }))
                break
            }
        }
        return items.filter(item => item.id !== mergeSource.id)
    }

    const renderEntityList = (
        section: EntitySection,
        type: 'category' | 'artist',
        icon: React.ReactNode,
        onRefresh: () => void
    ) => {
        if (section.isLoading) {
            return <LoadingSpinner size="md" className="py-8" />
        }

        if (section.error) {
            return <ErrorState message={section.error} onRetry={onRefresh} />
        }

        if (section.items.length === 0) {
            return (
                <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum item encontrado</p>
                </div>
            )
        }

        return (
            <div className="space-y-2">
                {section.items.map((item) => (
                    <div
                        key={item.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            {icon}
                            <span className="font-medium">{item.name}</span>
                            {item.file_count !== undefined && (
                                <Badge variant="secondary" className="text-xs">
                                    {item.file_count} música{item.file_count !== 1 ? 's' : ''}
                                </Badge>
                            )}
                        </div>
                        <div className="flex gap-1">
                            {canEdit ? (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openEditDialog(item, type)}
                                        title="Editar nome"
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openMergeDialog(item, type)}
                                        title="Consolidar com outro"
                                    >
                                        <Merge className="h-4 w-4" />
                                    </Button>
                                    {canDelete && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => openDeleteDialog(item, type)}
                                            title="Excluir"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (!isAuthenticated) {
        return (
            <MainLayout>
                <EmptyState
                    icon={Lock}
                    title="Acesso Restrito"
                    description="Você precisa estar logado para acessar esta página."
                    className="min-h-[400px]"
                />
            </MainLayout>
        )
    }

    if (!canEdit) {
        return (
            <MainLayout>
                <EmptyState
                    icon={Lock}
                    title="Permissão Insuficiente"
                    description="Você não tem permissão para acessar esta página. Somente editores e administradores podem gerenciar entidades."
                    className="min-h-[400px]"
                />
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    icon={Settings}
                    title={`Gerenciar Entidades${activeWorkspace ? ` — ${activeWorkspace.name}` : ''}`}
                    description="Edite, consolide e gerencie categorias e artistas"
                >
                    <InstructionsModal
                        title={PAGE_INSTRUCTIONS.settings.title}
                        description={PAGE_INSTRUCTIONS.settings.description}
                        sections={PAGE_INSTRUCTIONS.settings.sections}
                    />
                </PageHeader>

                {/* Info Card */}
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-4">
                        <div className="flex gap-2 text-sm text-muted-foreground">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-primary" />
                            <p>
                                Cada música pode ter <strong>múltiplas categorias</strong> e <strong>múltiplos artistas</strong> associados. 
                                Ao consolidar dois itens, todas as músicas do item de origem serão transferidas para o item de destino.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="categories">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="categories" className="gap-1">
                            <FolderOpen className="h-4 w-4 hidden sm:block" />
                            Categorias
                        </TabsTrigger>
                        <TabsTrigger value="artists" className="gap-1">
                            <User className="h-4 w-4 hidden sm:block" />
                            Artistas
                        </TabsTrigger>
                        <TabsTrigger value="filters" className="gap-1">
                            <Filter className="h-4 w-4 hidden sm:block" />
                            Filtros
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="categories">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <FolderOpen className="h-5 w-5" />
                                            Categorias
                                        </CardTitle>
                                        <CardDescription>
                                            Gerencie as categorias de músicas
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <SimpleTooltip label="Recarregar dados">
                                            <Button variant="outline" size="icon" onClick={loadCategories}>
                                                <RefreshCw className="h-4 w-4" />
                                            </Button>
                                        </SimpleTooltip>
                                        <SimpleTooltip label="Adicionar nova entidade">
                                            <Button size="sm" onClick={() => openAddDialog('category')}>
                                                <Plus className="h-4 w-4 mr-1" />
                                                Adicionar
                                            </Button>
                                        </SimpleTooltip>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {renderEntityList(
                                    categories,
                                    'category',
                                    <FolderOpen className="h-4 w-4 text-muted-foreground" />,
                                    loadCategories
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="artists">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <User className="h-5 w-5" />
                                            Artistas
                                        </CardTitle>
                                        <CardDescription>
                                            Gerencie os artistas cadastrados
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <SimpleTooltip label="Recarregar dados">
                                            <Button variant="outline" size="icon" onClick={loadArtists}>
                                                <RefreshCw className="h-4 w-4" />
                                            </Button>
                                        </SimpleTooltip>
                                        <SimpleTooltip label="Adicionar nova entidade">
                                            <Button size="sm" onClick={() => openAddDialog('artist')}>
                                                <Plus className="h-4 w-4 mr-1" />
                                                Adicionar
                                            </Button>
                                        </SimpleTooltip>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {renderEntityList(
                                    artists,
                                    'artist',
                                    <User className="h-4 w-4 text-muted-foreground" />,
                                    loadArtists
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="filters">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Filter className="h-5 w-5" />
                                            Filtros Personalizados
                                        </CardTitle>
                                        <CardDescription>
                                            Gerencie os valores dos filtros personalizados
                                        </CardDescription>
                                    </div>
                                    <SimpleTooltip label="Recarregar dados">
                                        <Button variant="outline" size="icon" onClick={loadFilters}>
                                            <RefreshCw className="h-4 w-4" />
                                        </Button>
                                    </SimpleTooltip>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {filtersLoading ? (
                                    <LoadingSpinner size="md" className="py-8" />
                                ) : filtersError ? (
                                    <ErrorState message={filtersError} onRetry={loadFilters} />
                                ) : filterGroups.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <p>Nenhum grupo de filtro encontrado</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filterGroups.map((group) => (
                                            <Collapsible
                                                key={group.id}
                                                open={expandedGroups.has(group.id)}
                                                onOpenChange={() => toggleGroup(group.id)}
                                            >
                                                <div className="border rounded-lg">
                                                    <CollapsibleTrigger asChild>
                                                        <button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg">
                                                            <div className="flex items-center gap-2">
                                                                <Filter className="h-4 w-4 text-muted-foreground" />
                                                                <span className="font-medium">{group.name}</span>
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {group.values.length} valor{group.values.length !== 1 ? 'es' : ''}
                                                                </Badge>
                                                            </div>
                                                            <ChevronDown className={`h-4 w-4 transition-transform ${expandedGroups.has(group.id) ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    </CollapsibleTrigger>
                                                    <CollapsibleContent>
                                                        <div className="border-t px-3 pb-3 pt-2 space-y-2">
                                                            <div className="flex justify-end">
                                                                <SimpleTooltip label="Adicionar valor ao grupo">
                                                                    <Button size="sm" variant="outline" onClick={() => openAddDialog('filter_value', group.id)}>
                                                                        <Plus className="h-4 w-4 mr-1" />
                                                                        Adicionar Valor
                                                                    </Button>
                                                                </SimpleTooltip>
                                                            </div>
                                                            {group.values.length === 0 ? (
                                                                <p className="text-center text-sm text-muted-foreground py-4">
                                                                    Nenhum valor neste grupo
                                                                </p>
                                                            ) : (
                                                                group.values.map((value) => (
                                                                    <div
                                                                        key={value.id}
                                                                        className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 transition-colors"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm">{value.name}</span>
                                                                            {value.file_count !== undefined && (
                                                                                <Badge variant="secondary" className="text-xs">
                                                                                    {value.file_count} música{value.file_count !== 1 ? 's' : ''}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex gap-1">
                                                                            {canEdit ? (
                                                                                <>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-7 w-7"
                                                                                        onClick={() => openEditDialog({ id: value.id, name: value.name, file_count: value.file_count }, 'filter_value')}
                                                                                        title="Editar nome"
                                                                                    >
                                                                                        <Edit className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-7 w-7"
                                                                                        onClick={() => openMergeDialog({ id: value.id, name: value.name, file_count: value.file_count }, 'filter_value', group.id)}
                                                                                        title="Consolidar com outro"
                                                                                    >
                                                                                        <Merge className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                    {canDelete && (
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="icon"
                                                                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                                                                            onClick={() => openDeleteDialog({ id: value.id, name: value.name, file_count: value.file_count }, 'filter_value')}
                                                                                            title="Excluir"
                                                                                        >
                                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                    )}
                                                                                </>
                                                                            ) : (
                                                                                <Lock className="h-4 w-4 text-muted-foreground" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </CollapsibleContent>
                                                </div>
                                            </Collapsible>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Add Dialog */}
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Adicionar {getEntityTypeLabel(addingType)}
                            </DialogTitle>
                            <DialogDescription>
                                Digite o nome do novo item
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label htmlFor="name">Nome</Label>
                            <Input
                                id="name"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder="Digite o nome..."
                                className="mt-2"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAdd()
                                }}
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleAdd} disabled={isAdding} className="gap-2">
                                {isAdding ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Adicionando...
                                    </>
                                ) : (
                                    'Adicionar'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Editar {getEntityTypeLabel(editingType)}
                            </DialogTitle>
                            <DialogDescription>
                                Altere o nome do item
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label htmlFor="edit-name">Nome</Label>
                            <Input
                                id="edit-name"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                placeholder="Digite o novo nome..."
                                className="mt-2"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEdit()
                                }}
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleEdit} disabled={isEditing} className="gap-2">
                                {isEditing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        Salvar
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Merge Dialog with Shadcn Select */}
                <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Consolidar {getEntityTypeLabel(mergeType)}
                            </DialogTitle>
                            <DialogDescription>
                                Todas as músicas de &quot;{mergeSource?.name}&quot; serão transferidas para o item selecionado, e &quot;{mergeSource?.name}&quot; será excluído.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label htmlFor="merge-target">Transferir para:</Label>
                            <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Selecione um destino..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {getMergeTargetOptions().map((item) => (
                                        <SelectItem key={item.id} value={item.id.toString()}>
                                            {item.name} {item.file_count !== undefined ? `(${item.file_count} músicas)` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleMerge} disabled={isMerging || !mergeTargetId} variant="destructive" className="gap-2">
                                {isMerging ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Consolidando...
                                    </>
                                ) : (
                                    <>
                                        <Merge className="h-4 w-4" />
                                        Consolidar
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation AlertDialog (replaces confirm()) */}
                <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir {getEntityTypeLabel(deleteDialog.type)}</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir &quot;{deleteDialog.item?.name}&quot;? 
                                Todas as músicas associadas perderão essa classificação.
                                <br /><br />
                                <strong className="text-destructive">Esta ação não pode ser desfeita.</strong>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteConfirm}
                                disabled={isDeleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Excluindo...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-4 w-4" />
                                        Excluir
                                    </>
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </MainLayout>
    )
}

