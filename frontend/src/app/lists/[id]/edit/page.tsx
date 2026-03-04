'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@core/components/ui/card'
import { Input } from '@core/components/ui/input'
import { Label } from '@core/components/ui/label'
import { Textarea } from '@core/components/ui/textarea'
import { Badge } from '@core/components/ui/badge'
import { Separator } from '@core/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Checkbox } from '@core/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@core/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@core/components/ui/popover'
import { ScrollArea } from '@core/components/ui/scroll-area'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { listsApi, musicApi, handleApiError, getActiveWorkspaceId } from '@/lib/api'
import type { MusicList, MusicFile, CustomFilterGroup } from '@/types'
import {
    List,
    Save,
    Music2,
    ArrowLeft,
    Trash2,
    Search,
    X,
    GripVertical,
    Eye,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Download,
    ExternalLink,
    Youtube,
    Plus,
    FileText,
    ArrowUp,
    ArrowDown,
    Lock,
    Loader2,
    Filter,
    Check,
    User,
    Tag
} from 'lucide-react'
import { useToast } from '@core/hooks/use-toast'
import { useAuth } from '@core/contexts/auth-context'
import Link from 'next/link'
import { InstructionsModal, PAGE_INSTRUCTIONS } from '@/components/ui/instructions-modal'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'

interface FilterOptionItem {
    slug: string
    label: string
}

interface FilterSuggestions {
    categories: FilterOptionItem[]
    artists: FilterOptionItem[]
    musical_keys: string[]
}

// Type guard para verificar se a resposta é do tipo AddMusicToListResponse
function isAddMusicResponse(response: any): response is { success: boolean; new_item_ids: number[]; added: number } {
    return response && typeof response.success === 'boolean' && Array.isArray(response.new_item_ids)
}

export default function EditListPage() {
    const router = useRouter()
    const params = useParams()
    const { toast } = useToast()
    const { hasPermission, isAuthenticated } = useAuth()
    const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')
    const listId = parseInt(params.id as string)

    const [list, setList] = useState<MusicList | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
    const [itemToRemove, setItemToRemove] = useState<number | null>(null)

    // Form data
    const [name, setName] = useState('')
    const [observations, setObservations] = useState('')

    // Collapsible states - Info colapsado por padrão, outros abertos
    const [infoOpen, setInfoOpen] = useState(false)
    const [musicListOpen, setMusicListOpen] = useState(true)
    const [searchOpen, setSearchOpen] = useState(true)

    // Search & filters
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [selectedArtists, setSelectedArtists] = useState<string[]>([])
    const [selectedCustomFilters, setSelectedCustomFilters] = useState<Record<string, string[]>>({})
    const [searchResults, setSearchResults] = useState<MusicFile[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [customFilterGroups, setCustomFilterGroups] = useState<CustomFilterGroup[]>([])
    const [suggestions, setSuggestions] = useState<FilterSuggestions>({
        categories: [],
        artists: [],
        musical_keys: []
    })
    const [filteredOptions, setFilteredOptions] = useState<FilterSuggestions>({
        categories: [],
        artists: [],
        musical_keys: []
    })

    const loadList = async () => {
        try {
            setIsLoading(true)
            setError('')
            const data = await listsApi.getList(listId)
            setList(data)
            setName(data.name)
            setObservations(data.observations || '')
        } catch (error) {
            setError(handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }

    const loadSuggestions = async () => {
        try {
            const response = await fetch(`/api/filters/suggestions?workspace_id=${getActiveWorkspaceId()}`)
            const data = await response.json()
            setSuggestions({
                categories: (data.categories || []).map((c: any) => ({
                    slug: typeof c === 'string' ? c : c.slug || '',
                    label: typeof c === 'string' ? c : c.label || c.name || ''
                })).filter((c: FilterOptionItem) => c.slug && c.label),
                artists: (data.artists || []).map((a: any) => ({
                    slug: typeof a === 'string' ? a : a.slug || '',
                    label: typeof a === 'string' ? a : a.label || a.name || ''
                })).filter((a: FilterOptionItem) => a.slug && a.label),
                musical_keys: data.musical_keys || []
            })
            setCustomFilterGroups(
                (data.custom_filter_groups || []).map((g: any) => ({
                    id: g.id,
                    name: g.name,
                    slug: g.slug,
                    sort_order: g.sort_order ?? 0,
                    show_as_tab: g.show_as_tab ?? false,
                    values: (g.values || []).map((v: any) => ({
                        id: v.id,
                        name: v.name,
                        slug: v.slug,
                        sort_order: v.sort_order ?? 0,
                        file_count: v.file_count ?? 0,
                    })),
                }))
            )
        } catch (error) {
            console.error('Erro ao carregar sugestões:', error)
        }
    }

    const getLabelBySlug = (slug: string, options: FilterOptionItem[]) =>
        options.find(o => o.slug === slug)?.label || slug

    const searchMusic = async () => {
        try {
            setIsSearching(true)
            const filters: any = {}

            if (searchTerm.trim()) {
                filters.title = searchTerm.trim()
            }

            if (selectedCategories.length > 0) {
                filters.category = selectedCategories
            }

            if (selectedArtists.length > 0) {
                filters.artist = selectedArtists
            }

            const activeCustomFilters = Object.entries(selectedCustomFilters)
                .filter(([, values]) => values.length > 0)
            if (activeCustomFilters.length > 0) {
                filters.custom_filters = Object.fromEntries(activeCustomFilters)
            }

            const response = await musicApi.search(filters, { page: 1, limit: 50 })
            setSearchResults(response.data)

            updateFilteredOptions(response.data)
        } catch (error) {
            console.error('Erro ao buscar músicas:', error)
        } finally {
            setIsSearching(false)
        }
    }

    const updateFilteredOptions = (results: MusicFile[]) => {
        const hasActiveFilters = selectedCategories.length > 0 || selectedArtists.length > 0

        if (!hasActiveFilters) {
            setFilteredOptions(suggestions)
            return
        }

        const resultCatLabels = new Set<string>()
        const resultArtistLabels = new Set<string>()

        results.forEach(music => {
            if (music.categories && music.categories.length > 0) {
                music.categories.forEach(cat => cat && resultCatLabels.add(cat))
            } else if (music.category) {
                resultCatLabels.add(music.category)
            }
            if (music.artist) {
                resultArtistLabels.add(music.artist)
            }
        })

        const selectedCatSet = new Set(selectedCategories)
        const selectedArtSet = new Set(selectedArtists)

        setFilteredOptions({
            categories: suggestions.categories.filter(c =>
                selectedCatSet.has(c.slug) || resultCatLabels.has(c.label)),
            artists: suggestions.artists.filter(a =>
                selectedArtSet.has(a.slug) || resultArtistLabels.has(a.label)),
            musical_keys: suggestions.musical_keys
        })
    }

    useEffect(() => {
        if (listId) {
            loadList()
            loadSuggestions()
        }
    }, [listId])

    // Initialize filtered options when suggestions load
    useEffect(() => {
        setFilteredOptions(suggestions)
    }, [suggestions])

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchMusic()
        }, 300)
        return () => clearTimeout(timeoutId)
    }, [searchTerm, selectedCategories, selectedArtists, selectedCustomFilters])

    const handleSave = async () => {
        if (!list || !name.trim()) return

        try {
            setIsSaving(true)

            // Salvar informações básicas da lista
            await listsApi.updateList(list.id, { name: name.trim(), observations: observations.trim() })

            // Salvar ordem das músicas se houver itens
            if (list.items && list.items.length > 0) {
                await listsApi.reorderList(list.id, list.items.map(item => ({ id: item.id })))
            }

            toast({
                title: "Lista atualizada",
                description: "As informações e ordem foram salvas com sucesso.",
            })
            router.push(`/lists/${list.id}`)
        } catch (error) {
            toast({
                title: "Erro ao salvar",
                description: handleApiError(error),
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleAddMusic = async (music: MusicFile) => {
        if (!list) return

        try {
            const response = await listsApi.addMusicToList(list.id, music.id)

            if (isAddMusicResponse(response) && response.success && response.new_item_ids.length > 0) {
                // Usar o ID real retornado pelo backend
                const realItemId = response.new_item_ids[0]

                const newItem = {
                    id: realItemId, // ID real do backend
                    list_id: list.id,
                    music_id: music.id,
                    position: (list.items?.length || 0) + 1,
                    music: music
                }

                setList(prev => prev ? {
                    ...prev,
                    items: [...(prev.items || []), newItem]
                } : prev)

                toast({
                    title: "Música adicionada",
                    description: `"${music.title}" foi adicionada à lista.`,
                })
            } else {
                throw new Error('Música não foi adicionada ou já existe na lista')
            }
        } catch (error) {
            toast({
                title: "Erro ao adicionar música",
                description: handleApiError(error),
                variant: "destructive",
            })
        }
    }

    const handleRemoveMusicClick = (itemId: number) => {
        setItemToRemove(itemId)
        setRemoveDialogOpen(true)
    }

    const handleRemoveMusicConfirm = async () => {
        if (!list || itemToRemove === null) return

        // Verificar se é um item temporário (adicionado dinamicamente)
        const item = list.items?.find(item => item.id === itemToRemove)
        const isTemporaryItem = itemToRemove > 1000000000000 // IDs temporários são gerados com Date.now()

        try {
            // Se não é temporário, remover do backend
            if (!isTemporaryItem) {
                await listsApi.removeMusicFromList(list.id, itemToRemove)
            }

            // Atualizar lista localmente sempre
            setList(prev => prev ? {
                ...prev,
                items: prev.items?.filter(item => item.id !== itemToRemove) || []
            } : prev)

            toast({
                title: "Música removida",
                description: isTemporaryItem
                    ? "A música foi removida da lista (não salva ainda)."
                    : "A música foi removida da lista.",
            })
        } catch (error) {
            toast({
                title: "Erro ao remover música",
                description: handleApiError(error),
                variant: "destructive",
            })
        }
    }

    const handleDragEnd = async (result: DropResult) => {
        const { destination, source } = result

        // Se não foi solto em um local válido
        if (!destination) return

        // Se foi solto na mesma posição
        if (destination.index === source.index) return

        if (!list?.items) return

        // Reordenar a lista localmente
        const newItems = Array.from(list.items)
        const [removed] = newItems.splice(source.index, 1)
        newItems.splice(destination.index, 0, removed)

        // Atualizar a ordem local
        setList(prev => prev ? { ...prev, items: newItems } : prev)

        try {
            await listsApi.reorderList(list.id, newItems.map(item => ({ id: item.id })))

            toast({
                title: "Ordem atualizada",
                description: "A nova ordem foi salva automaticamente.",
            })
        } catch (error) {
            // Em caso de erro, reverter a mudança local
            setList(prev => prev ? { ...prev, items: list.items } : prev)

            toast({
                title: "Erro ao reordenar",
                description: "Não foi possível salvar a nova ordem. Tente novamente.",
                variant: "destructive"
            })
        }
    }

    const handleMoveUp = async (index: number) => {
        if (index === 0 || !list?.items) return
        
        const newItems = Array.from(list.items)
        const [removed] = newItems.splice(index, 1)
        newItems.splice(index - 1, 0, removed)
        
        setList(prev => prev ? { ...prev, items: newItems } : prev)
        
        try {
            await listsApi.reorderList(list.id, newItems.map(item => ({ id: item.id })))
        } catch (error) {
            setList(prev => prev ? { ...prev, items: list.items } : prev)
            toast({
                title: "Erro ao reordenar",
                description: "Não foi possível salvar a nova ordem.",
                variant: "destructive"
            })
        }
    }

    const handleMoveDown = async (index: number) => {
        if (!list?.items || index === list.items.length - 1) return
        
        const newItems = Array.from(list.items)
        const [removed] = newItems.splice(index, 1)
        newItems.splice(index + 1, 0, removed)
        
        setList(prev => prev ? { ...prev, items: newItems } : prev)
        
        try {
            await listsApi.reorderList(list.id, newItems.map(item => ({ id: item.id })))
        } catch (error) {
            setList(prev => prev ? { ...prev, items: list.items } : prev)
            toast({
                title: "Erro ao reordenar",
                description: "Não foi possível salvar a nova ordem.",
                variant: "destructive"
            })
        }
    }

    const openYouTube = (url: string) => {
        window.open(url, '_blank')
    }

    const handleDownload = async (music: MusicFile) => {
        try {
            const response = await fetch(`/api/files/${music.id}/download`)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${music.title}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            toast({
                title: "Erro ao baixar",
                description: "Não foi possível baixar o arquivo.",
                variant: "destructive",
            })
        }
    }

    const handleViewPdf = (music: MusicFile) => {
        window.open(`/api/files/${music.id}/stream`, '_blank')
    }

    // Permission check
    if (!isAuthenticated || !canEdit) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                    <Lock className="h-16 w-16 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
                    <p className="text-muted-foreground">
                        {!isAuthenticated 
                            ? 'Você precisa estar logado para editar listas.'
                            : 'Você não tem permissão para editar listas.'}
                    </p>
                </div>
            </MainLayout>
        )
    }

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                        <p className="mt-4 text-muted-foreground">Carregando lista...</p>
                    </div>
                </div>
            </MainLayout>
        )
    }

    if (error || !list) {
        return (
            <MainLayout>
                <div className="text-center py-12">
                    <h1 className="text-2xl font-bold text-destructive mb-4">Erro ao carregar lista</h1>
                    <p className="text-muted-foreground mb-6">{error || 'Lista não encontrada'}</p>
                    <Button asChild>
                        <Link href="/lists">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar às listas
                        </Link>
                    </Button>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" asChild className="self-start shrink-0">
                                        <Link href={`/lists/${list.id}`}>
                                            <ArrowLeft className="h-4 w-4 mr-2" />
                                            Voltar
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Voltar para visualização da lista</p>
                                </TooltipContent>
                            </Tooltip>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                                    <List className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
                                    <span className="truncate">Editar Lista</span>
                                </h1>
                                <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                                    Modifique as informações e músicas da lista
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 shrink-0 items-center">
                            <InstructionsModal
                                title={PAGE_INSTRUCTIONS.listEdit.title}
                                description={PAGE_INSTRUCTIONS.listEdit.description}
                                sections={PAGE_INSTRUCTIONS.listEdit.sections}
                            />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving || !name.trim()}
                                        size="sm"
                                        className="gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Salvar alterações da lista</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* Informações da Lista - Collapsible */}
                <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
                    <Card>
                        <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                <CardTitle className="flex items-center justify-between">
                                    <span>Informações da Lista</span>
                                    {infoOpen ? (
                                        <ChevronDown className="h-5 w-5" />
                                    ) : (
                                        <ChevronRight className="h-5 w-5" />
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    Atualize o nome e observações da lista
                                </CardDescription>
                            </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="name">Nome da Lista</Label>
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Digite o nome da lista..."
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="observations">Observações</Label>
                                    <Textarea
                                        id="observations"
                                        value={observations}
                                        onChange={(e) => setObservations(e.target.value)}
                                        placeholder="Digite observações opcionais..."
                                        className="mt-1"
                                        rows={3}
                                    />
                                </div>
                            </CardContent>
                        </CollapsibleContent>
                    </Card>
                </Collapsible>

                {/* Músicas da Lista - Collapsible */}
                <Collapsible open={musicListOpen} onOpenChange={setMusicListOpen}>
                    <Card>
                        <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Music2 className="h-5 w-5" />
                                        Músicas da Lista
                                        <Badge variant="secondary">
                                            {list.items?.length || 0}
                                        </Badge>
                                    </span>
                                    {musicListOpen ? (
                                        <ChevronDown className="h-5 w-5" />
                                    ) : (
                                        <ChevronRight className="h-5 w-5" />
                                    )}
                                </CardTitle>
                            </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <CardContent>
                                {list.items && list.items.length > 0 ? (
                                    <DragDropContext onDragEnd={handleDragEnd}>
                                        <Droppable droppableId="music-list">
                                            {(provided) => (
                                                <div
                                                    {...provided.droppableProps}
                                                    ref={provided.innerRef}
                                                    className="overflow-x-auto"
                                                >
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr className="border-b text-xs text-muted-foreground">
                                                                <th className="text-left py-2 px-1 w-8"></th>
                                                                <th className="text-left py-2 px-1 w-10">#</th>
                                                                <th className="text-left py-2 px-2 min-w-[180px] max-w-[320px]">Música</th>
                                                                <th className="text-left py-2 px-2 hidden md:table-cell min-w-[140px] max-w-[220px]">Artista</th>
                                                                <th className="text-left py-2 px-2 hidden lg:table-cell min-w-[140px] max-w-[220px]">Categoria</th>
                                                                <th className="text-left py-2 px-2 hidden lg:table-cell min-w-[140px] max-w-[220px]">T. Litúrgico</th>
                                                                <th className="text-center py-2 px-1 w-14">Tom</th>
                                                                <th className="text-center py-2 px-1 w-20">Ordem</th>
                                                                <th className="text-right py-2 px-1 w-24">Ações</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(list.items ?? []).map((item, index) => (
                                                                <Draggable
                                                                    key={`item-${item.id}`}
                                                                    draggableId={`item-${item.id}`}
                                                                    index={index}
                                                                >
                                                                    {(provided, snapshot) => (
                                                                        <tr
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            className={`border-b transition-colors ${snapshot.isDragging ? 'bg-muted shadow-lg' : 'hover:bg-muted/50'}`}
                                                                        >
                                                                            <td className="py-2 px-1" {...provided.dragHandleProps}>
                                                                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                                                            </td>
                                                                            <td className="py-2 px-1">
                                                                                <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center text-xs">
                                                                                    {index + 1}
                                                                                </Badge>
                                                                            </td>
                                                                            <td className="py-2 px-2 min-w-[180px] max-w-[320px]">
                                                                                <div className="font-medium text-sm truncate">{item.music?.title || 'Sem título'}</div>
                                                                                <div className="text-xs text-muted-foreground md:hidden">{item.music?.artist || ''}</div>
                                                                            </td>
                                                                            <td className="py-2 px-2 hidden md:table-cell text-sm text-muted-foreground min-w-[140px] max-w-[220px]">
                                                                                {item.music?.artist || '-'}
                                                                            </td>
                                                                            <td className="py-2 px-2 hidden lg:table-cell min-w-[140px] max-w-[220px]">
                                                                                {item.music?.category ? (
                                                                                    <Badge variant="secondary" className="text-xs">{item.music.category}</Badge>
                                                                                ) : '-'}
                                                                            </td>
                                                                            <td className="py-2 px-2 hidden lg:table-cell min-w-[140px] max-w-[220px]">
                                                                                {item.music?.custom_filters && Object.keys(item.music.custom_filters).length > 0 ? (
                                                                                    <div className="flex flex-wrap gap-1">
                                                                                        {Object.values(item.music.custom_filters).flatMap((vals: any, gIdx: number) =>
                                                                                            (Array.isArray(vals) ? vals : vals.values || []).map((v: string, idx: number) => (
                                                                                                <Badge key={`${gIdx}-${idx}`} variant="outline" className="text-xs">{v}</Badge>
                                                                                            ))
                                                                                        )}
                                                                                    </div>
                                                                                ) : '-'}
                                                                            </td>
                                                                            <td className="py-2 px-1 text-center">
                                                                                {item.music?.musical_key ? (
                                                                                    <Badge className="text-xs">{item.music.musical_key}</Badge>
                                                                                ) : '-'}
                                                                            </td>
                                                                            <td className="py-2 px-1 text-center">
                                                                                <div className="flex gap-0.5 justify-center">
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-8 w-8"
                                                                                        onClick={() => handleMoveUp(index)}
                                                                                        disabled={index === 0}
                                                                                    >
                                                                                        <ArrowUp className="h-4 w-4" />
                                                                                    </Button>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-8 w-8"
                                                                                        onClick={() => handleMoveDown(index)}
                                                                                        disabled={index === (list.items?.length || 0) - 1}
                                                                                    >
                                                                                        <ArrowDown className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            </td>
                                                                            <td className="py-2 px-1">
                                                                                <div className="flex gap-0.5 justify-end">
                                                                                        <Tooltip>
                                                                                            <TooltipTrigger asChild>
                                                                                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                                                                    <Link href={`/music/${item.music_id}`} target="_blank">
                                                                                                        <FileText className="h-4 w-4" />
                                                                                                    </Link>
                                                                                                </Button>
                                                                                            </TooltipTrigger>
                                                                                            <TooltipContent><p>Ver detalhes</p></TooltipContent>
                                                                                        </Tooltip>
                                                                                        <Tooltip>
                                                                                            <TooltipTrigger asChild>
                                                                                                <Button
                                                                                                    variant="ghost"
                                                                                                    size="icon"
                                                                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                                                                    onClick={() => handleRemoveMusicClick(item.id)}
                                                                                                >
                                                                                                    <Trash2 className="h-4 w-4" />
                                                                                                </Button>
                                                                                            </TooltipTrigger>
                                                                                            <TooltipContent><p>Remover</p></TooltipContent>
                                                                                        </Tooltip>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </Draggable>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </DragDropContext>
                                ) : (
                                    <div className="text-center py-12">
                                        <Music2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                        <h3 className="text-lg font-medium mb-2">Lista vazia</h3>
                                        <p className="text-muted-foreground">
                                            Use a busca abaixo para adicionar músicas
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </CollapsibleContent>
                    </Card>
                </Collapsible>

                {/* Busca de Músicas - Collapsible */}
                <Collapsible open={searchOpen} onOpenChange={setSearchOpen}>
                    <Card>
                        <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Search className="h-5 w-5" />
                                        Buscar Músicas
                                    </span>
                                    {searchOpen ? (
                                        <ChevronDown className="h-5 w-5" />
                                    ) : (
                                        <ChevronRight className="h-5 w-5" />
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    Pesquise e adicione músicas à lista
                                </CardDescription>
                            </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <CardContent className="space-y-4">
                                {/* Barra de Filtros Compacta */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    {/* Busca por título */}
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar por título..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 pr-10"
                                        />
                                        {searchTerm && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                                                onClick={() => setSearchTerm('')}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>

                                    {/* Dropdown de Categorias */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="justify-between min-w-[160px]">
                                                <span className="flex items-center gap-2">
                                                    <Filter className="h-4 w-4" />
                                                    Categorias
                                                </span>
                                                {selectedCategories.length > 0 && (
                                                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                                                        {selectedCategories.length}
                                                    </Badge>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-0" align="start">
                                            <div className="p-2 border-b">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">Categorias</span>
                                                    {selectedCategories.length > 0 && (
                                                        <SimpleTooltip label="Limpar seleção">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs"
                                                                onClick={() => setSelectedCategories([])}
                                                            >
                                                                Limpar
                                                            </Button>
                                                        </SimpleTooltip>
                                                    )}
                                                </div>
                                            </div>
                                            <ScrollArea className="h-[200px]">
                                                <div className="p-2 space-y-1">
                                                    {(selectedCategories.length > 0 || selectedArtists.length > 0 
                                                        ? filteredOptions.categories 
                                                        : suggestions.categories
                                                    ).filter(c => c.slug && c.label.trim()).map((category) => (
                                                        <div
                                                            key={category.slug}
                                                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                                            onClick={() => {
                                                                if (selectedCategories.includes(category.slug)) {
                                                                    setSelectedCategories(selectedCategories.filter(c => c !== category.slug))
                                                                } else {
                                                                    setSelectedCategories([...selectedCategories, category.slug])
                                                                }
                                                            }}
                                                        >
                                                            <div className={`h-4 w-4 rounded border flex items-center justify-center ${selectedCategories.includes(category.slug) ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                                                {selectedCategories.includes(category.slug) && (
                                                                    <Check className="h-3 w-3 text-primary-foreground" />
                                                                )}
                                                            </div>
                                                            <span className="text-sm">{category.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </PopoverContent>
                                    </Popover>

                                    {/* Dropdown de Artistas */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="justify-between min-w-[140px]">
                                                <span className="flex items-center gap-2">
                                                    <User className="h-4 w-4" />
                                                    Artistas
                                                </span>
                                                {selectedArtists.length > 0 && (
                                                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                                                        {selectedArtists.length}
                                                    </Badge>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-0" align="start">
                                            <div className="p-2 border-b">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">Artistas</span>
                                                    {selectedArtists.length > 0 && (
                                                        <SimpleTooltip label="Limpar seleção">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs"
                                                                onClick={() => setSelectedArtists([])}
                                                            >
                                                                Limpar
                                                            </Button>
                                                        </SimpleTooltip>
                                                    )}
                                                </div>
                                            </div>
                                            <ScrollArea className="h-[200px]">
                                                <div className="p-2 space-y-1">
                                                    {(selectedCategories.length > 0 || selectedArtists.length > 0 
                                                        ? filteredOptions.artists 
                                                        : suggestions.artists
                                                    ).filter(a => a.slug && a.label.trim()).map((artist) => (
                                                        <div
                                                            key={artist.slug}
                                                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                                            onClick={() => {
                                                                if (selectedArtists.includes(artist.slug)) {
                                                                    setSelectedArtists(selectedArtists.filter(a => a !== artist.slug))
                                                                } else {
                                                                    setSelectedArtists([...selectedArtists, artist.slug])
                                                                }
                                                            }}
                                                        >
                                                            <div className={`h-4 w-4 rounded border flex items-center justify-center ${selectedArtists.includes(artist.slug) ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                                                {selectedArtists.includes(artist.slug) && (
                                                                    <Check className="h-3 w-3 text-primary-foreground" />
                                                                )}
                                                            </div>
                                                            <span className="text-sm truncate">{artist.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </PopoverContent>
                                    </Popover>

                                    {/* Dropdowns de Filtros Customizados */}
                                    {customFilterGroups.map((group) => {
                                        const selected = selectedCustomFilters[group.slug] || []
                                        return (
                                            <Popover key={group.slug}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="justify-between min-w-[140px]">
                                                        <span className="flex items-center gap-2">
                                                            <Tag className="h-4 w-4" />
                                                            {group.name}
                                                        </span>
                                                        {selected.length > 0 && (
                                                            <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                                                                {selected.length}
                                                            </Badge>
                                                        )}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-56 p-0" align="start">
                                                    <div className="p-2 border-b">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium">{group.name}</span>
                                                            {selected.length > 0 && (
                                                                <SimpleTooltip label="Limpar seleção">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 px-2 text-xs"
                                                                        onClick={() => setSelectedCustomFilters(prev => {
                                                                            const next = { ...prev }
                                                                            delete next[group.slug]
                                                                            return next
                                                                        })}
                                                                    >
                                                                        Limpar
                                                                    </Button>
                                                                </SimpleTooltip>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ScrollArea className="h-[200px]">
                                                        <div className="p-2 space-y-1">
                                                            {group.values.map((value) => (
                                                                <div
                                                                    key={value.slug}
                                                                    className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                                                    onClick={() => {
                                                                        setSelectedCustomFilters(prev => {
                                                                            const current = prev[group.slug] || []
                                                                            const updated = current.includes(value.slug)
                                                                                ? current.filter(s => s !== value.slug)
                                                                                : [...current, value.slug]
                                                                            return { ...prev, [group.slug]: updated }
                                                                        })
                                                                    }}
                                                                >
                                                                    <div className={`h-4 w-4 rounded border flex items-center justify-center ${selected.includes(value.slug) ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                                                        {selected.includes(value.slug) && (
                                                                            <Check className="h-3 w-3 text-primary-foreground" />
                                                                        )}
                                                                    </div>
                                                                    <span className="text-sm truncate">{value.name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </ScrollArea>
                                                </PopoverContent>
                                            </Popover>
                                        )
                                    })}

                                    {/* Indicador de busca */}
                                    {isSearching && (
                                        <div className="flex items-center">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        </div>
                                    )}
                                </div>

                                {/* Filtros ativos */}
                                {(selectedCategories.length > 0 || selectedArtists.length > 0 || Object.values(selectedCustomFilters).some(v => v.length > 0)) && (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCategories.map((catSlug) => (
                                            <Badge key={catSlug} variant="secondary" className="gap-1 pr-1">
                                                {getLabelBySlug(catSlug, suggestions.categories)}
                                                <SimpleTooltip label="Remover filtro">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-4 w-4 ml-1 hover:bg-transparent"
                                                        onClick={() => setSelectedCategories(selectedCategories.filter(c => c !== catSlug))}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </SimpleTooltip>
                                            </Badge>
                                        ))}
                                        {selectedArtists.map((artistSlug) => (
                                            <Badge key={artistSlug} variant="default" className="gap-1 pr-1">
                                                <User className="h-3 w-3" />
                                                {getLabelBySlug(artistSlug, suggestions.artists)}
                                                <SimpleTooltip label="Remover filtro">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-4 w-4 ml-1 hover:bg-transparent"
                                                        onClick={() => setSelectedArtists(selectedArtists.filter(a => a !== artistSlug))}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </SimpleTooltip>
                                            </Badge>
                                        ))}
                                        {Object.entries(selectedCustomFilters).flatMap(([groupSlug, valueSlugs]) => {
                                            const group = customFilterGroups.find(g => g.slug === groupSlug)
                                            return valueSlugs.map(valueSlug => {
                                                const valueName = group?.values.find(v => v.slug === valueSlug)?.name || valueSlug
                                                return (
                                                    <Badge key={`${groupSlug}-${valueSlug}`} variant="outline" className="gap-1 pr-1">
                                                        <Tag className="h-3 w-3" />
                                                        {valueName}
                                                        <SimpleTooltip label="Remover filtro">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-4 w-4 ml-1 hover:bg-transparent"
                                                                onClick={() => setSelectedCustomFilters(prev => ({
                                                                    ...prev,
                                                                    [groupSlug]: (prev[groupSlug] || []).filter(s => s !== valueSlug)
                                                                }))}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </SimpleTooltip>
                                                    </Badge>
                                                )
                                            })
                                        })}
                                        <SimpleTooltip label="Limpar todos os filtros">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-xs text-muted-foreground"
                                                onClick={() => {
                                                    setSelectedCategories([])
                                                    setSelectedArtists([])
                                                    setSelectedCustomFilters({})
                                                }}
                                            >
                                                Limpar todos
                                            </Button>
                                        </SimpleTooltip>
                                    </div>
                                )}

                                {/* Resultados */}
                                <div>
                                        {searchResults.length > 0 ? (
                                            <div className="max-h-96 overflow-y-auto">
                                                <table className="w-full">
                                                    <thead className="sticky top-0 bg-background">
                                                        <tr className="border-b text-xs text-muted-foreground">
                                                            <th className="text-left py-2 px-2">Música</th>
                                                            <th className="text-left py-2 px-2 hidden md:table-cell">Artista</th>
                                                            <th className="text-left py-2 px-2 hidden lg:table-cell">Categoria</th>
                                                            <th className="text-left py-2 px-2 hidden lg:table-cell">Filtros</th>
                                                            <th className="text-center py-2 px-1 w-14">Tom</th>
                                                            <th className="text-right py-2 px-1 w-32">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {searchResults.map((music) => (
                                                            <tr key={music.id} className="border-b hover:bg-muted/50">
                                                                <td className="py-2 px-2">
                                                                    <div className="font-medium text-sm truncate max-w-[200px]">{music.title}</div>
                                                                    <div className="text-xs text-muted-foreground md:hidden truncate">{music.artist || ''}</div>
                                                                </td>
                                                                <td className="py-2 px-2 hidden md:table-cell text-sm text-muted-foreground">
                                                                    <span className="truncate block max-w-[120px]">{music.artist || '-'}</span>
                                                                </td>
                                                                <td className="py-2 px-2 hidden lg:table-cell">
                                                                    {music.category ? (
                                                                        <Badge variant="secondary" className="text-xs">{music.category}</Badge>
                                                                    ) : '-'}
                                                                </td>
                                                                <td className="py-2 px-2 hidden lg:table-cell">
                                                                    {music.custom_filters && Object.keys(music.custom_filters).length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {Object.entries(music.custom_filters).flatMap(([slug, group]) =>
                                                                                group.values.map((v, idx) => (
                                                                                    <Badge key={`${slug}-${idx}`} variant="outline" className="text-xs">{v}</Badge>
                                                                                ))
                                                                            )}
                                                                        </div>
                                                                    ) : '-'}
                                                                </td>
                                                                <td className="py-2 px-1 text-center">
                                                                    {music.musical_key ? (
                                                                        <Badge className="text-xs">{music.musical_key}</Badge>
                                                                    ) : '-'}
                                                                </td>
                                                                                <td className="py-2 px-1">
                                                                                    <div className="flex gap-0.5 justify-end">
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                                                                        <Link href={`/music/${music.id}`} target="_blank">
                                                                                                            <FileText className="h-4 w-4" />
                                                                                                        </Link>
                                                                                                    </Button>
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent><p>Detalhes</p></TooltipContent>
                                                                                            </Tooltip>
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewPdf(music)}>
                                                                                                        <Eye className="h-4 w-4" />
                                                                                                    </Button>
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent><p>Ver PDF</p></TooltipContent>
                                                                                            </Tooltip>
                                                                                            {music.youtube_link && (
                                                                                                <Tooltip>
                                                                                                    <TooltipTrigger asChild>
                                                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openYouTube(music.youtube_link!)}>
                                                                                                            <Youtube className="h-4 w-4" />
                                                                                                        </Button>
                                                                                                    </TooltipTrigger>
                                                                                                    <TooltipContent><p>YouTube</p></TooltipContent>
                                                                                                </Tooltip>
                                                                                            )}
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <Button variant="default" size="icon" className="h-8 w-8" onClick={() => handleAddMusic(music)}>
                                                                                                        <Plus className="h-4 w-4" />
                                                                                                    </Button>
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent><p>Adicionar à lista</p></TooltipContent>
                                                                                            </Tooltip>
                                                                                    </div>
                                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <Music2 className="h-8 w-8 mx-auto mb-2" />
                                                <p>
                                                    {searchTerm || selectedCategories.length > 0 || selectedArtists.length > 0 || Object.values(selectedCustomFilters).some(v => v.length > 0)
                                                        ? 'Nenhuma música encontrada com os filtros aplicados'
                                                        : 'Use os filtros para buscar músicas'
                                                    }
                                                </p>
                                            </div>
                                        )}
                                </div>
                            </CardContent>
                        </CollapsibleContent>
                    </Card>
                </Collapsible>
            </div>

            {/* Confirm Remove Music Dialog */}
            <ConfirmDialog
                open={removeDialogOpen}
                onOpenChange={setRemoveDialogOpen}
                title="Remover Música"
                description="Tem certeza que deseja remover esta música da lista? Esta ação não pode ser desfeita."
                confirmText="Remover"
                cancelText="Cancelar"
                variant="destructive"
                onConfirm={handleRemoveMusicConfirm}
            />
        </MainLayout>
    )
}