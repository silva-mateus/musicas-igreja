'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { listsApi, musicApi, handleApiError } from '@/lib/api'
import type { MusicList, MusicFile } from '@/types'
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
    User
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { InstructionsModal, PAGE_INSTRUCTIONS } from '@/components/ui/instructions-modal'

interface FilterSuggestions {
    categories: string[]
    liturgical_times: string[]
    artists: string[]
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
    const { canEdit, isAuthenticated } = useAuth()
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
    const [selectedLiturgicalTimes, setSelectedLiturgicalTimes] = useState<string[]>([])
    const [selectedArtists, setSelectedArtists] = useState<string[]>([])
    const [searchResults, setSearchResults] = useState<MusicFile[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [suggestions, setSuggestions] = useState<FilterSuggestions>({
        categories: [],
        liturgical_times: [],
        artists: [],
        musical_keys: []
    })
    // Filtered options based on current search results
    const [filteredOptions, setFilteredOptions] = useState<FilterSuggestions>({
        categories: [],
        liturgical_times: [],
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
            const response = await fetch('/api/filters/suggestions')
            const data = await response.json()
            setSuggestions(data)
        } catch (error) {
            console.error('Erro ao carregar sugestões:', error)
        }
    }

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

            if (selectedLiturgicalTimes.length > 0) {
                filters.liturgical_time = selectedLiturgicalTimes
            }

            if (selectedArtists.length > 0) {
                filters.artist = selectedArtists
            }

            const response = await musicApi.search(filters, { page: 1, limit: 50 })
            setSearchResults(response.data)

            // Update filtered options based on results
            updateFilteredOptions(response.data)
        } catch (error) {
            console.error('Erro ao buscar músicas:', error)
        } finally {
            setIsSearching(false)
        }
    }

    // Update available filter options based on search results
    const updateFilteredOptions = (results: MusicFile[]) => {
        const hasActiveFilters = selectedCategories.length > 0 || selectedLiturgicalTimes.length > 0 || selectedArtists.length > 0

        if (!hasActiveFilters) {
            // No filters active, show all options
            setFilteredOptions(suggestions)
            return
        }

        // Extract unique values from results
        const categories = new Set<string>()
        const liturgicalTimes = new Set<string>()
        const artists = new Set<string>()

        results.forEach(music => {
            // Categories
            if (music.categories && music.categories.length > 0) {
                music.categories.forEach(cat => cat && categories.add(cat))
            } else if (music.category) {
                categories.add(music.category)
            }

            // Liturgical times
            if (music.liturgical_times && music.liturgical_times.length > 0) {
                music.liturgical_times.forEach(time => time && liturgicalTimes.add(time))
            } else if (music.liturgical_time) {
                liturgicalTimes.add(music.liturgical_time)
            }

            // Artists
            if (music.artist) {
                artists.add(music.artist)
            }
        })

        // Keep selected values + available values from results
        setFilteredOptions({
            categories: Array.from(new Set([...selectedCategories, ...Array.from(categories)])).filter(c => suggestions.categories.includes(c)),
            liturgical_times: Array.from(new Set([...selectedLiturgicalTimes, ...Array.from(liturgicalTimes)])).filter(t => suggestions.liturgical_times.includes(t)),
            artists: Array.from(new Set([...selectedArtists, ...Array.from(artists)])).filter(a => suggestions.artists.includes(a)),
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
    }, [searchTerm, selectedCategories, selectedLiturgicalTimes, selectedArtists])

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
                            <TooltipProvider>
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
                            </TooltipProvider>
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

                        <TooltipProvider>
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
                        </TooltipProvider>
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
                                                                                {item.music?.liturgical_time ? (
                                                                                    <Badge variant="outline" className="text-xs">{item.music.liturgical_time}</Badge>
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
                                                                                    <TooltipProvider>
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
                                                                                    </TooltipProvider>
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
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 text-xs"
                                                            onClick={() => setSelectedCategories([])}
                                                        >
                                                            Limpar
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <ScrollArea className="h-[200px]">
                                                <div className="p-2 space-y-1">
                                                    {(selectedCategories.length > 0 || selectedLiturgicalTimes.length > 0 || selectedArtists.length > 0 
                                                        ? filteredOptions.categories 
                                                        : suggestions.categories
                                                    ).filter(c => c && c.trim()).map((category) => (
                                                        <div
                                                            key={category}
                                                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                                            onClick={() => {
                                                                if (selectedCategories.includes(category)) {
                                                                    setSelectedCategories(selectedCategories.filter(c => c !== category))
                                                                } else {
                                                                    setSelectedCategories([...selectedCategories, category])
                                                                }
                                                            }}
                                                        >
                                                            <div className={`h-4 w-4 rounded border flex items-center justify-center ${selectedCategories.includes(category) ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                                                {selectedCategories.includes(category) && (
                                                                    <Check className="h-3 w-3 text-primary-foreground" />
                                                                )}
                                                            </div>
                                                            <span className="text-sm">{category}</span>
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
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 text-xs"
                                                            onClick={() => setSelectedArtists([])}
                                                        >
                                                            Limpar
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <ScrollArea className="h-[200px]">
                                                <div className="p-2 space-y-1">
                                                    {(selectedCategories.length > 0 || selectedLiturgicalTimes.length > 0 || selectedArtists.length > 0 
                                                        ? filteredOptions.artists 
                                                        : suggestions.artists
                                                    ).filter(a => a && a.trim()).map((artist) => (
                                                        <div
                                                            key={artist}
                                                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                                            onClick={() => {
                                                                if (selectedArtists.includes(artist)) {
                                                                    setSelectedArtists(selectedArtists.filter(a => a !== artist))
                                                                } else {
                                                                    setSelectedArtists([...selectedArtists, artist])
                                                                }
                                                            }}
                                                        >
                                                            <div className={`h-4 w-4 rounded border flex items-center justify-center ${selectedArtists.includes(artist) ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                                                {selectedArtists.includes(artist) && (
                                                                    <Check className="h-3 w-3 text-primary-foreground" />
                                                                )}
                                                            </div>
                                                            <span className="text-sm truncate">{artist}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </PopoverContent>
                                    </Popover>

                                    {/* Dropdown de Tempos Litúrgicos */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="justify-between min-w-[180px]">
                                                <span className="flex items-center gap-2">
                                                    <Filter className="h-4 w-4" />
                                                    T. Litúrgicos
                                                </span>
                                                {selectedLiturgicalTimes.length > 0 && (
                                                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                                                        {selectedLiturgicalTimes.length}
                                                    </Badge>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-0" align="start">
                                            <div className="p-2 border-b">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">Tempos Litúrgicos</span>
                                                    {selectedLiturgicalTimes.length > 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 text-xs"
                                                            onClick={() => setSelectedLiturgicalTimes([])}
                                                        >
                                                            Limpar
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <ScrollArea className="h-[200px]">
                                                <div className="p-2 space-y-1">
                                                    {(selectedCategories.length > 0 || selectedLiturgicalTimes.length > 0 || selectedArtists.length > 0 
                                                        ? filteredOptions.liturgical_times 
                                                        : suggestions.liturgical_times
                                                    ).filter(t => t && t.trim()).map((time) => (
                                                        <div
                                                            key={time}
                                                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                                            onClick={() => {
                                                                if (selectedLiturgicalTimes.includes(time)) {
                                                                    setSelectedLiturgicalTimes(selectedLiturgicalTimes.filter(t => t !== time))
                                                                } else {
                                                                    setSelectedLiturgicalTimes([...selectedLiturgicalTimes, time])
                                                                }
                                                            }}
                                                        >
                                                            <div className={`h-4 w-4 rounded border flex items-center justify-center ${selectedLiturgicalTimes.includes(time) ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                                                {selectedLiturgicalTimes.includes(time) && (
                                                                    <Check className="h-3 w-3 text-primary-foreground" />
                                                                )}
                                                            </div>
                                                            <span className="text-sm">{time}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </PopoverContent>
                                    </Popover>

                                    {/* Indicador de busca */}
                                    {isSearching && (
                                        <div className="flex items-center">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        </div>
                                    )}
                                </div>

                                {/* Filtros ativos */}
                                {(selectedCategories.length > 0 || selectedLiturgicalTimes.length > 0 || selectedArtists.length > 0) && (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCategories.map((cat) => (
                                            <Badge key={cat} variant="secondary" className="gap-1 pr-1">
                                                {cat}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4 ml-1 hover:bg-transparent"
                                                    onClick={() => setSelectedCategories(selectedCategories.filter(c => c !== cat))}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </Badge>
                                        ))}
                                        {selectedArtists.map((artist) => (
                                            <Badge key={artist} variant="default" className="gap-1 pr-1">
                                                <User className="h-3 w-3" />
                                                {artist}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4 ml-1 hover:bg-transparent"
                                                    onClick={() => setSelectedArtists(selectedArtists.filter(a => a !== artist))}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </Badge>
                                        ))}
                                        {selectedLiturgicalTimes.map((time) => (
                                            <Badge key={time} variant="outline" className="gap-1 pr-1">
                                                {time}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4 ml-1 hover:bg-transparent"
                                                    onClick={() => setSelectedLiturgicalTimes(selectedLiturgicalTimes.filter(t => t !== time))}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </Badge>
                                        ))}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-xs text-muted-foreground"
                                            onClick={() => {
                                                setSelectedCategories([])
                                                setSelectedLiturgicalTimes([])
                                                setSelectedArtists([])
                                            }}
                                        >
                                            Limpar todos
                                        </Button>
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
                                                            <th className="text-left py-2 px-2 hidden lg:table-cell">T. Litúrgico</th>
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
                                                                    {music.liturgical_time ? (
                                                                        <Badge variant="outline" className="text-xs">{music.liturgical_time}</Badge>
                                                                    ) : '-'}
                                                                </td>
                                                                <td className="py-2 px-1 text-center">
                                                                    {music.musical_key ? (
                                                                        <Badge className="text-xs">{music.musical_key}</Badge>
                                                                    ) : '-'}
                                                                </td>
                                                                                <td className="py-2 px-1">
                                                                                    <div className="flex gap-0.5 justify-end">
                                                                                        <TooltipProvider>
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
                                                                                        </TooltipProvider>
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
                                                    {searchTerm || selectedCategories.length > 0 || selectedLiturgicalTimes.length > 0
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