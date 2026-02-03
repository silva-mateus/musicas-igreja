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
    Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

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

    // Form data
    const [name, setName] = useState('')
    const [observations, setObservations] = useState('')

    // Collapsible states
    const [infoOpen, setInfoOpen] = useState(true)
    const [musicListOpen, setMusicListOpen] = useState(true)
    const [searchOpen, setSearchOpen] = useState(true)

    // Search & filters
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [selectedLiturgicalTimes, setSelectedLiturgicalTimes] = useState<string[]>([])
    const [searchResults, setSearchResults] = useState<MusicFile[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [suggestions, setSuggestions] = useState<FilterSuggestions>({
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

            const response = await musicApi.search(filters, { page: 1, limit: 50 })
            setSearchResults(response.data)
        } catch (error) {
            console.error('Erro ao buscar músicas:', error)
        } finally {
            setIsSearching(false)
        }
    }

    useEffect(() => {
        if (listId) {
            loadList()
            loadSuggestions()
        }
    }, [listId])

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchMusic()
        }, 300)
        return () => clearTimeout(timeoutId)
    }, [searchTerm, selectedCategories, selectedLiturgicalTimes])

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

    const handleRemoveMusic = async (itemId: number) => {
        if (!list) return

        // Verificar se é um item temporário (adicionado dinamicamente)
        const item = list.items?.find(item => item.id === itemId)
        const isTemporaryItem = itemId > 1000000000000 // IDs temporários são gerados com Date.now()

        try {
            // Se não é temporário, remover do backend
            if (!isTemporaryItem) {
                await listsApi.removeMusicFromList(list.id, itemId)
            }

            // Atualizar lista localmente sempre
            setList(prev => prev ? {
                ...prev,
                items: prev.items?.filter(item => item.id !== itemId) || []
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
                            <div className="flex gap-2 shrink-0">
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
                                                                <th className="text-left py-2 px-2">Música</th>
                                                                <th className="text-left py-2 px-2 hidden md:table-cell">Artista</th>
                                                                <th className="text-left py-2 px-2 hidden lg:table-cell">Categoria</th>
                                                                <th className="text-left py-2 px-2 hidden lg:table-cell">T. Litúrgico</th>
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
                                                                                <Badge variant="outline" className="w-7 h-7 rounded-full flex items-center justify-center text-xs">
                                                                                    {index + 1}
                                                                                </Badge>
                                                                            </td>
                                                                            <td className="py-2 px-2">
                                                                                <div className="font-medium text-sm">{item.music?.title || 'Sem título'}</div>
                                                                                <div className="text-xs text-muted-foreground md:hidden">{item.music?.artist || ''}</div>
                                                                            </td>
                                                                            <td className="py-2 px-2 hidden md:table-cell text-sm text-muted-foreground">
                                                                                {item.music?.artist || '-'}
                                                                            </td>
                                                                            <td className="py-2 px-2 hidden lg:table-cell">
                                                                                {item.music?.category ? (
                                                                                    <Badge variant="secondary" className="text-xs">{item.music.category}</Badge>
                                                                                ) : '-'}
                                                                            </td>
                                                                            <td className="py-2 px-2 hidden lg:table-cell">
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
                                                                                        className="h-7 w-7"
                                                                                        onClick={() => handleMoveUp(index)}
                                                                                        disabled={index === 0}
                                                                                    >
                                                                                        <ArrowUp className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-7 w-7"
                                                                                        onClick={() => handleMoveDown(index)}
                                                                                        disabled={index === (list.items?.length || 0) - 1}
                                                                                    >
                                                                                        <ArrowDown className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                </div>
                                                                            </td>
                                                                            <td className="py-2 px-1">
                                                                                <div className="flex gap-0.5 justify-end">
                                                                                    <TooltipProvider>
                                                                                        <Tooltip>
                                                                                            <TooltipTrigger asChild>
                                                                                                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                                                                    <Link href={`/music/${item.music_id}`} target="_blank">
                                                                                                        <FileText className="h-3.5 w-3.5" />
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
                                                                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                                                                    onClick={() => handleRemoveMusic(item.id)}
                                                                                                >
                                                                                                    <Trash2 className="h-3.5 w-3.5" />
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
                            <CardContent>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                                    {/* Filtros */}
                                    <div className="space-y-4">
                                        <h4 className="font-medium">Filtros</h4>

                                        {/* Busca por título */}
                                        <div>
                                            <Label htmlFor="search">Buscar por título</Label>
                                            <div className="relative mt-1">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="search"
                                                    placeholder="Digite o título da música..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="pl-10"
                                                />
                                                {searchTerm && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                                                        onClick={() => setSearchTerm('')}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Categorias */}
                                        <div>
                                            <Label>Categorias</Label>
                                            <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                                                {suggestions.categories.map((category) => (
                                                    <div key={category} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`cat-${category}`}
                                                            checked={selectedCategories.includes(category)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setSelectedCategories([...selectedCategories, category])
                                                                } else {
                                                                    setSelectedCategories(selectedCategories.filter(c => c !== category))
                                                                }
                                                            }}
                                                        />
                                                        <Label htmlFor={`cat-${category}`} className="text-sm">{category}</Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Tempos Litúrgicos */}
                                        <div>
                                            <Label>Tempos Litúrgicos</Label>
                                            <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                                                {suggestions.liturgical_times.map((time) => (
                                                    <div key={time} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`time-${time}`}
                                                            checked={selectedLiturgicalTimes.includes(time)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setSelectedLiturgicalTimes([...selectedLiturgicalTimes, time])
                                                                } else {
                                                                    setSelectedLiturgicalTimes(selectedLiturgicalTimes.filter(t => t !== time))
                                                                }
                                                            }}
                                                        />
                                                        <Label htmlFor={`time-${time}`} className="text-sm">{time}</Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resultados */}
                                    <div className="lg:col-span-2">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="font-medium">Resultados</h4>
                                            {isSearching && (
                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            )}
                                        </div>

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
                                                                                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                                                        <Link href={`/music/${music.id}`} target="_blank">
                                                                                            <FileText className="h-3.5 w-3.5" />
                                                                                        </Link>
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent><p>Detalhes</p></TooltipContent>
                                                                            </Tooltip>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewPdf(music)}>
                                                                                        <Eye className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent><p>Ver PDF</p></TooltipContent>
                                                                            </Tooltip>
                                                                            {music.youtube_link && (
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openYouTube(music.youtube_link!)}>
                                                                                            <Youtube className="h-3.5 w-3.5 text-red-500" />
                                                                                        </Button>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent><p>YouTube</p></TooltipContent>
                                                                                </Tooltip>
                                                                            )}
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button size="sm" className="h-7 gap-1" onClick={() => handleAddMusic(music)}>
                                                                                        <Plus className="h-3.5 w-3.5" />
                                                                                        <span className="hidden sm:inline">Add</span>
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent><p>Adicionar</p></TooltipContent>
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
                                </div>
                            </CardContent>
                        </CollapsibleContent>
                    </Card>
                </Collapsible>
            </div>
        </MainLayout>
    )
}