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
    Download,
    ExternalLink,
    Youtube,
    Plus,
    FileText
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

interface FilterSuggestions {
    categories: string[]
    liturgical_times: string[]
    artists: string[]
    musical_keys: string[]
}

export default function EditListPage() {
    const router = useRouter()
    const params = useParams()
    const { toast } = useToast()
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
                console.log('💾 [SAVE] Salvando ordem das músicas...')
                await listsApi.reorderList(list.id, list.items.map(item => ({ id: item.id })))
                console.log('✅ [SAVE] Ordem salva com sucesso')
            }

            toast({
                title: "Lista atualizada",
                description: "As informações e ordem foram salvas com sucesso.",
            })
            router.push(`/lists/${list.id}`)
        } catch (error) {
            console.error('❌ [SAVE] Erro ao salvar:', error)
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
            await listsApi.addMusicToList(list.id, music.id)

            // Atualizar lista localmente sem recarregar
            const newItem = {
                id: Date.now(), // Temporary ID
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

    const handleDragEnd = (result: DropResult) => {
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

        // TODO: Enviar para o backend a nova ordem
        // Por enquanto, apenas mostra um toast
        toast({
            title: "Ordem alterada",
            description: "A ordem das músicas foi atualizada. Lembre-se de salvar.",
        })
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

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
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
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" asChild>
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
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2">
                                <List className="h-8 w-8 text-primary" />
                                Editar Lista
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Modifique as informações e músicas da lista
                            </p>
                        </div>
                    </div>

                    <TooltipProvider>
                        <div className="flex gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving || !name.trim()}
                                        className="gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        {isSaving ? 'Salvando...' : 'Salvar'}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Salvar alterações da lista</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </TooltipProvider>
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
                                                    className="space-y-3"
                                                >
                                                    {(list.items ?? []).map((item, index) => (
                                                        <Draggable
                                                            key={`item-${item.id}`}
                                                            draggableId={`item-${item.id}`}
                                                            index={index}
                                                        >
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${snapshot.isDragging
                                                                        ? 'bg-muted shadow-lg'
                                                                        : 'hover:bg-muted/50'
                                                                        }`}
                                                                >
                                                                    <div {...provided.dragHandleProps}>
                                                                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                                                    </div>
                                                                    <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                                                                        {index + 1}
                                                                    </Badge>
                                                                    <div className="flex-1">
                                                                        <h4 className="font-medium">{item.music?.title || 'Título não disponível'}</h4>
                                                                        {item.music?.artist && (
                                                                            <p className="text-sm text-muted-foreground">{item.music.artist}</p>
                                                                        )}
                                                                    </div>
                                                                    <TooltipProvider>
                                                                        <div className="flex gap-1">
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button variant="ghost" size="sm" asChild>
                                                                                        <Link href={`/music/${item.music_id}`} target="_blank">
                                                                                            <FileText className="h-4 w-4" />
                                                                                        </Link>
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>
                                                                                    <p>Ver detalhes da música</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        onClick={() => handleRemoveMusic(item.id)}
                                                                                        className="text-destructive hover:text-destructive"
                                                                                    >
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>
                                                                                    <p>Remover da lista</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </div>
                                                                    </TooltipProvider>
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    ))}
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
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                            )}
                                        </div>

                                        {searchResults.length > 0 ? (
                                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                                {searchResults.map((music) => (
                                                    <div
                                                        key={music.id}
                                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                                                    >
                                                        <div className="flex-1">
                                                            <h5 className="font-medium">{music.title}</h5>
                                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                                {music.artist && <span>{music.artist}</span>}
                                                                {music.musical_key && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {music.musical_key}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <TooltipProvider>
                                                            <div className="flex gap-1">
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button variant="ghost" size="sm" asChild>
                                                                            <Link href={`/music/${music.id}`} target="_blank">
                                                                                <FileText className="h-4 w-4" />
                                                                            </Link>
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Ver detalhes da música</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleViewPdf(music)}
                                                                        >
                                                                            <Eye className="h-4 w-4" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Visualizar PDF</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                                {music.youtube_link && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => openYouTube(music.youtube_link!)}
                                                                            >
                                                                                <Youtube className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Abrir vídeo no YouTube</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleDownload(music)}
                                                                        >
                                                                            <Download className="h-4 w-4" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Baixar PDF</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => handleAddMusic(music)}
                                                                            className="gap-1"
                                                                        >
                                                                            <Plus className="h-4 w-4" />
                                                                            Adicionar
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Adicionar à lista</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </div>
                                                        </TooltipProvider>
                                                    </div>
                                                ))}
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