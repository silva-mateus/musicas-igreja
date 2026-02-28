'use client'

import { useState, useEffect } from 'react'
import { Button } from '@core/components/ui/button'
import { Input } from '@core/components/ui/input'
import { Label } from '@core/components/ui/label'
import { Textarea } from '@core/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@core/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@core/components/ui/card'
import { Badge } from '@core/components/ui/badge'
import { FileText, Edit3, Check, X, Plus, AlertTriangle, Loader2, Copy, CheckCircle2, HelpCircle, Sparkles } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@core/components/ui/tooltip'
import { useToast } from '@core/hooks/use-toast'
import { formatFileSize } from '@/lib/utils'
import { getActiveWorkspaceId } from '@/lib/api'
import { MultiSelect } from '@/components/ui/multi-select'

interface FileMetadata {
    file: File
    title: string
    artist: string
    new_artist?: string
    category: string
    categories: string[]
    custom_filters: Record<string, string[]>
    musical_key: string
    youtube_link: string
    observations: string
    new_categories?: string[]
    duplicateStatus?: 'checking' | 'unique' | 'duplicate' | 'error'
    duplicateMessage?: string
}

interface UploadMetadataEditorProps {
    files: File[]
    onMetadataChange: (metadata: FileMetadata[]) => void
    onRemoveFile: (index: number) => void
}

interface CustomFilterGroupOption {
    id: number
    name: string
    slug: string
    values: Array<{ name: string; slug: string }>
}

interface FilterSuggestions {
    categories: string[]
    customFilterGroups: CustomFilterGroupOption[]
    artists: string[]
    musical_keys: string[]
}

const DEFAULT_MUSICAL_KEYS = [
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
    'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'
]

export function UploadMetadataEditor({ files, onMetadataChange, onRemoveFile }: UploadMetadataEditorProps) {
    const { toast } = useToast()
    const [metadata, setMetadata] = useState<FileMetadata[]>([])
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
    const [suggestions, setSuggestions] = useState<FilterSuggestions>({
        categories: [],
        customFilterGroups: [],
        artists: [],
        musical_keys: DEFAULT_MUSICAL_KEYS
    })
    const [newCategoryInputs, setNewCategoryInputs] = useState<{ [key: number]: string }>({})
    const [showNewCategoryInput, setShowNewCategoryInput] = useState<Set<number>>(new Set())

    const [batchValues, setBatchValues] = useState<{
        categories: string[]
        custom_filters: Record<string, string[]>
        artist: string
        musical_key: string
    }>({
        categories: [],
        custom_filters: {},
        artist: '',
        musical_key: ''
    })

    // Carregar sugestões da API
    useEffect(() => {
        const loadSuggestions = async () => {
            try {
                const response = await fetch(`/api/filters/suggestions?workspace_id=${getActiveWorkspaceId()}`)
                const data = await response.json()
                setSuggestions({
                    categories: data.categories || [],
                    customFilterGroups: (data.custom_filter_groups || []).map((g: any) => ({
                        id: g.id,
                        name: g.name,
                        slug: g.slug,
                        values: (g.values || []).map((v: any) => ({ name: v.name, slug: v.slug })),
                    })),
                    artists: data.artists || [],
                    musical_keys: data.musical_keys || DEFAULT_MUSICAL_KEYS
                })
            } catch (error) {
                console.error('Erro ao carregar sugestões:', error)
                setSuggestions(prev => ({ ...prev, musical_keys: DEFAULT_MUSICAL_KEYS }))
            }
        }
        loadSuggestions()
    }, [])

    // Inicializar metadata quando files mudarem - preservando dados existentes
    useEffect(() => {
        setMetadata(prevMetadata => {
            // Create a map of existing metadata by file identifier (name + size)
            const existingMap = new Map(
                prevMetadata.map(m => [m.file.name + m.file.size, m])
            )
            
            // Map files to metadata, preserving existing data or creating new
            const newMetadata = files.map((file) => {
                const key = file.name + file.size
                const existing = existingMap.get(key)
                
                if (existing) {
                    // Preserve existing metadata, just update the file reference
                    return { ...existing, file }
                }
                
                // Create new metadata for new files
                return {
                    file,
                    title: file.name.replace(/\.[^/.]+$/, ""), // Remove extensão
                    artist: '',
                    new_artist: '',
                    category: '',
                    musical_key: '',
                    youtube_link: '',
                    observations: '',
                    categories: [],
                    custom_filters: {},
                    new_categories: [],
                    duplicateStatus: 'checking' as const,
                    duplicateMessage: ''
                }
            })
            
            return newMetadata
        })
        
        // Only reset UI state if this is a completely new set of files
        if (files.length === 0) {
            setExpandedItems(new Set())
            setNewCategoryInputs({})
            setShowNewCategoryInput(new Set())
        }
    }, [files])

    // Verificar duplicados para novos arquivos
    useEffect(() => {
        const checkDuplicates = async () => {
            const filesToCheck = metadata.filter(m => m.duplicateStatus === 'checking')
            if (filesToCheck.length === 0) return

            for (const item of filesToCheck) {
                try {
                    // Check by file name (simple duplicate check)
                    const response = await fetch(`/api/files?search=${encodeURIComponent(item.file.name.replace(/\.[^/.]+$/, ""))}&limit=5`)
                    const data = await response.json()
                    
                    const possibleDuplicates = data.data?.filter((f: any) => 
                        f.original_name?.toLowerCase() === item.file.name.toLowerCase() ||
                        f.title?.toLowerCase() === item.title.toLowerCase()
                    ) || []

                    setMetadata(prev => prev.map(m => 
                        m.file.name === item.file.name && m.file.size === item.file.size
                            ? {
                                ...m,
                                duplicateStatus: possibleDuplicates.length > 0 ? 'duplicate' : 'unique',
                                duplicateMessage: possibleDuplicates.length > 0 
                                    ? `Possível duplicado: "${possibleDuplicates[0].title}"`
                                    : 'Arquivo único'
                            }
                            : m
                    ))
                } catch (error) {
                    console.error('Erro ao verificar duplicados:', error)
                    setMetadata(prev => prev.map(m => 
                        m.file.name === item.file.name && m.file.size === item.file.size
                            ? { ...m, duplicateStatus: 'error', duplicateMessage: 'Erro ao verificar' }
                            : m
                    ))
                }
            }
        }

        checkDuplicates()
    }, [metadata.map(m => m.duplicateStatus === 'checking').join(',')])

    // Notificar mudanças de metadata
    useEffect(() => {
        if (metadata.length > 0) {
            onMetadataChange(metadata)
        }
    }, [metadata]) // Removido onMetadataChange das dependências para evitar loop

    const updateMetadata = (
        index: number,
        field: keyof Omit<FileMetadata, 'file'>,
        value: string | string[]
    ) => {
        setMetadata(prev => prev.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ))
    }

    const addNewCategory = (index: number) => {
        const newCategory = newCategoryInputs[index]?.trim()
        if (!newCategory || suggestions.categories.includes(newCategory)) return

        // Adicionar à lista de sugestões localmente
        setSuggestions(prev => ({
            ...prev,
            categories: [...prev.categories, newCategory].sort()
        }))

        // Adicionar à lista de categorias do item
        setMetadata(prev => prev.map((item, i) =>
            i === index
                ? {
                    ...item,
                    categories: [...item.categories, newCategory],
                    new_categories: [...(item.new_categories || []), newCategory]
                }
                : item
        ))

        // Limpar input e esconder
        setNewCategoryInputs(prev => ({ ...prev, [index]: '' }))
        setShowNewCategoryInput(prev => {
            const newSet = new Set(prev)
            newSet.delete(index)
            return newSet
        })
    }

    const toggleExpanded = (index: number) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev)
            if (newSet.has(index)) {
                newSet.delete(index)
            } else {
                newSet.add(index)
            }
            return newSet
        })
    }

    const isFormValid = (item: FileMetadata) => item.title.trim().length > 0 && item.categories.length > 0

    const expandAll = () => {
        setExpandedItems(new Set(metadata.map((_, index) => index)))
    }

    const collapseAll = () => {
        setExpandedItems(new Set())
    }

    const applyToAll = (field: keyof Omit<FileMetadata, 'file' | 'title'>, value: string) => {
        setMetadata(prev => prev.map(item => ({ ...item, [field]: value })))
    }

    // Aplicar valores em lote a todos os arquivos
    const applyBatchValues = () => {
        setMetadata(prev => prev.map(item => {
            const updated = { ...item }
            
            // Adicionar categorias (merge, não substituir)
            if (batchValues.categories.length > 0) {
                updated.categories = Array.from(new Set([...item.categories, ...batchValues.categories]))
            }
            
            // Merge custom filters
            if (Object.keys(batchValues.custom_filters).length > 0) {
                const merged = { ...item.custom_filters }
                for (const [groupSlug, values] of Object.entries(batchValues.custom_filters)) {
                    merged[groupSlug] = Array.from(new Set([...(merged[groupSlug] || []), ...values]))
                }
                updated.custom_filters = merged
            }
            
            // Artista (substituir apenas se definido)
            if (batchValues.artist.trim()) {
                updated.artist = batchValues.artist
            }
            
            // Tom (substituir apenas se definido)
            if (batchValues.musical_key) {
                updated.musical_key = batchValues.musical_key
            }
            
            return updated
        }))
        
        // Feedback visual
        const totalFilterValues = Object.values(batchValues.custom_filters).reduce((sum, v) => sum + v.length, 0)
        const appliedCount = [
            batchValues.categories.length > 0 ? `${batchValues.categories.length} categoria(s)` : null,
            totalFilterValues > 0 ? `${totalFilterValues} filtro(s)` : null,
            batchValues.artist ? 'artista' : null,
            batchValues.musical_key ? 'tom' : null
        ].filter(Boolean).join(', ')

        toast({
            title: '✓ Aplicado com sucesso!',
            description: `${appliedCount} aplicado(s) a ${metadata.length} arquivo(s)`,
        })
        
        // Limpar valores após aplicar
        setBatchValues({
            categories: [],
            custom_filters: {},
            artist: '',
            musical_key: ''
        })
    }

    const hasBatchValues = batchValues.categories.length > 0 || 
                           Object.values(batchValues.custom_filters).some(v => v.length > 0) || 
                           batchValues.artist.trim() !== '' || 
                           batchValues.musical_key !== ''

    // Criar nova categoria nas sugestões
    const handleCreateCategory = (newCategory: string) => {
        if (!suggestions.categories.includes(newCategory)) {
            setSuggestions(prev => ({
                ...prev,
                categories: [...prev.categories, newCategory].sort()
            }))
        }
    }

    if (files.length === 0) return null

    return (
        <div className="space-y-4">
            {/* Ações em lote */}
            <Card className="bg-muted/30 border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Copy className="h-4 w-4" />
                            Aplicar a Todos os Arquivos
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <p>Selecione os valores e clique em &quot;Aplicar&quot; para adicionar a todos os arquivos.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {hasBatchValues && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setBatchValues({
                                        categories: [],
                                        custom_filters: {},
                                        artist: '',
                                        musical_key: ''
                                    })}
                                    className="text-xs text-muted-foreground"
                                >
                                    <X className="h-3 w-3 mr-1" />
                                    Limpar
                                </Button>
                            )}
                            <Button
                                size="sm"
                                onClick={applyBatchValues}
                                disabled={!hasBatchValues}
                                className="gap-2"
                            >
                                <Check className="h-4 w-4" />
                                Aplicar a Todos
                                {hasBatchValues && (
                                    <Badge variant="secondary" className="ml-1 text-xs">
                                        {metadata.length}
                                    </Badge>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1 text-xs">
                                Categorias
                                {batchValues.categories.length > 0 && (
                                    <Badge variant="default" className="text-xs ml-1 bg-primary/80">
                                        +{batchValues.categories.length}
                                    </Badge>
                                )}
                            </Label>
                            <MultiSelect
                                options={suggestions.categories.filter(c => c && c.trim())}
                                value={batchValues.categories}
                                onChange={(values) => setBatchValues(prev => ({ ...prev, categories: values }))}
                                onCreateNew={handleCreateCategory}
                                createLabel="Criar categoria"
                                placeholder="Selecionar categorias..."
                            />
                        </div>
                        {suggestions.customFilterGroups.map(group => (
                            <div key={group.slug} className="space-y-2">
                                <Label className="flex items-center gap-1 text-xs">
                                    {group.name}
                                    {(batchValues.custom_filters[group.slug]?.length || 0) > 0 && (
                                        <Badge variant="default" className="text-xs ml-1 bg-primary/80">
                                            +{batchValues.custom_filters[group.slug].length}
                                        </Badge>
                                    )}
                                </Label>
                                <MultiSelect
                                    options={group.values.map(v => v.name)}
                                    value={batchValues.custom_filters[group.slug] || []}
                                    onChange={(values) => setBatchValues(prev => {
                                        const newFilters = { ...prev.custom_filters }
                                        if (values.length > 0) {
                                            newFilters[group.slug] = values
                                        } else {
                                            delete newFilters[group.slug]
                                        }
                                        return { ...prev, custom_filters: newFilters }
                                    })}
                                    placeholder={`Selecionar ${group.name.toLowerCase()}...`}
                                />
                            </div>
                        ))}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1 text-xs">
                                Artista
                                {batchValues.artist && (
                                    <Badge variant="default" className="text-xs ml-1 bg-primary/80">
                                        ✓
                                    </Badge>
                                )}
                            </Label>
                            <Input
                                list="batch-artists-list"
                                placeholder="Selecione ou digite..."
                                value={batchValues.artist}
                                onChange={(e) => setBatchValues(prev => ({ ...prev, artist: e.target.value }))}
                                className="h-9"
                            />
                            <datalist id="batch-artists-list">
                                {suggestions.artists.map((a) => (
                                    <option key={a} value={a} />
                                ))}
                            </datalist>
                        </div>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1 text-xs">
                                Tom
                                {batchValues.musical_key && (
                                    <Badge variant="default" className="text-xs ml-1 bg-primary/80">
                                        ✓
                                    </Badge>
                                )}
                            </Label>
                            <Select 
                                value={batchValues.musical_key}
                                onValueChange={(value) => setBatchValues(prev => ({ ...prev, musical_key: value }))}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Selecionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {suggestions.musical_keys.filter(k => k && k.trim()).map((key) => (
                                        <SelectItem key={key} value={key}>
                                            {key}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    {/* Preview do que será aplicado */}
                    {hasBatchValues && (
                        <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                            <p className="text-xs text-muted-foreground mb-2">
                                Será aplicado a {metadata.length} arquivo(s):
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {batchValues.categories.map(cat => (
                                    <Badge key={cat} variant="outline" className="text-xs">
                                        📁 {cat}
                                    </Badge>
                                ))}
                                {Object.entries(batchValues.custom_filters).flatMap(([slug, values]) =>
                                    values.map(val => (
                                        <Badge key={`${slug}-${val}`} variant="outline" className="text-xs">
                                            🏷️ {val}
                                        </Badge>
                                    ))
                                )}
                                {batchValues.artist && (
                                    <Badge variant="outline" className="text-xs">
                                        👤 {batchValues.artist}
                                    </Badge>
                                )}
                                {batchValues.musical_key && (
                                    <Badge variant="outline" className="text-xs">
                                        🎵 {batchValues.musical_key}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Botões de Expandir/Recolher */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {metadata.length} arquivo(s) • {metadata.filter(isFormValid).length} válido(s)
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={expandAll} className="text-xs gap-1">
                        <Plus className="h-3 w-3" />
                        Expandir Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs gap-1">
                        <X className="h-3 w-3" />
                        Recolher Todos
                    </Button>
                </div>
            </div>

            {/* Lista de arquivos para edição */}
            <div className="space-y-3">
                {metadata.map((item, index) => (
                    <Card key={index} className="transition-all duration-200">
                        <CardHeader className="pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm sm:text-base truncate">{item.file.name}</div>
                                        <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                                            <span>{formatFileSize(item.file.size)}</span>
                                            {/* Status de Duplicado */}
                                            {item.duplicateStatus === 'checking' && (
                                                <Badge variant="outline" className="text-xs gap-1">
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    <span className="hidden sm:inline">Verificando...</span>
                                                </Badge>
                                            )}
                                            {item.duplicateStatus === 'unique' && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Badge variant="outline" className="text-xs gap-1 border-green-500 text-green-600">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                <span className="hidden sm:inline">Único</span>
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Nenhum arquivo duplicado encontrado</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                            {item.duplicateStatus === 'duplicate' && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Badge variant="outline" className="text-xs gap-1 border-amber-500 text-amber-600">
                                                                <AlertTriangle className="h-3 w-3" />
                                                                <span className="hidden sm:inline">Possível duplicado</span>
                                                                <span className="sm:hidden">Dup.</span>
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{item.duplicateMessage}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                            {item.duplicateStatus === 'error' && (
                                                <Badge variant="outline" className="text-xs gap-1 border-gray-400 text-gray-500">
                                                    <HelpCircle className="h-3 w-3" />
                                                    <span className="hidden sm:inline">Não verificado</span>
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    {isFormValid(item) ? (
                                        <Badge variant="default" className="bg-green-500 shrink-0 text-xs">
                                            <Check className="h-3 w-3 mr-1" />
                                            <span className="hidden sm:inline">Válido</span>
                                            <span className="sm:hidden">OK</span>
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive" className="shrink-0 text-xs">
                                            <X className="h-3 w-3 mr-1" />
                                            <span className="hidden sm:inline">Incompleto</span>
                                            <span className="sm:hidden">!</span>
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleExpanded(index)}
                                        className="text-xs sm:text-sm gap-1"
                                    >
                                        <Edit3 className="h-4 w-4" />
                                        <span>{expandedItems.has(index) ? 'Recolher' : 'Editar'}</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onRemoveFile(index)}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        {expandedItems.has(index) && (
                            <CardContent className="pt-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor={`title-${index}`}>Título *</Label>
                                        <Input
                                            id={`title-${index}`}
                                            value={item.title}
                                            onChange={(e) => updateMetadata(index, 'title', e.target.value)}
                                            placeholder="Título da música"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`artist-${index}`}>Artista</Label>
                                        <Input
                                            id={`artist-${index}`}
                                            list={`artists-list-${index}`}
                                            value={item.artist}
                                            onChange={(e) => updateMetadata(index, 'artist', e.target.value)}
                                            placeholder="Digite para usar um novo artista ou selecione um existente"
                                        />
                                        <datalist id={`artists-list-${index}`}>
                                            {suggestions.artists.map((a) => (
                                                <option key={a} value={a} />
                                            ))}
                                        </datalist>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`category-${index}`}>Categorias *</Label>
                                        <div className="flex gap-2">
                                            <MultiSelect
                                                options={suggestions.categories}
                                                value={item.categories}
                                                onChange={(value) => updateMetadata(index, 'categories', value)}
                                                placeholder="Selecionar categorias"
                                                className="flex-1"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setShowNewCategoryInput(prev => {
                                                        const newSet = new Set(prev)
                                                        newSet.add(index)
                                                        return newSet
                                                    })
                                                }}
                                                className="px-2"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {showNewCategoryInput.has(index) && (
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Nova categoria"
                                                    value={newCategoryInputs[index] || ''}
                                                    onChange={(e) => setNewCategoryInputs(prev => ({ ...prev, [index]: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            addNewCategory(index)
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => addNewCategory(index)}
                                                    disabled={!newCategoryInputs[index]?.trim()}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setShowNewCategoryInput(prev => {
                                                            const newSet = new Set(prev)
                                                            newSet.delete(index)
                                                            return newSet
                                                        })
                                                        setNewCategoryInputs(prev => ({ ...prev, [index]: '' }))
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {suggestions.customFilterGroups.map(group => (
                                        <div key={group.slug} className="space-y-2">
                                            <Label>{group.name}</Label>
                                            <MultiSelect
                                                options={group.values.map(v => v.name)}
                                                value={item.custom_filters[group.slug] || []}
                                                onChange={(values) => {
                                                    const newFilters = { ...item.custom_filters }
                                                    if (values.length > 0) {
                                                        newFilters[group.slug] = values
                                                    } else {
                                                        delete newFilters[group.slug]
                                                    }
                                                    updateMetadata(index, 'custom_filters' as any, newFilters as any)
                                                }}
                                                placeholder={`Selecionar ${group.name.toLowerCase()}`}
                                                className="flex-1"
                                            />
                                        </div>
                                    ))}

                                    <div className="space-y-2">
                                        <Label htmlFor={`musical_key-${index}`}>Tonalidade</Label>
                                        <Select
                                            value={item.musical_key}
                                            onValueChange={(value) => updateMetadata(index, 'musical_key', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecionar tonalidade" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {suggestions.musical_keys.filter(k => k && k.trim()).map((key) => (
                                                    <SelectItem key={key} value={key}>
                                                        {key}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`youtube_link-${index}`}>Link do YouTube</Label>
                                        <Input
                                            id={`youtube_link-${index}`}
                                            value={item.youtube_link}
                                            onChange={(e) => updateMetadata(index, 'youtube_link', e.target.value)}
                                            placeholder="https://youtube.com/watch?v=..."
                                            type="url"
                                        />
                                    </div>

                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor={`observations-${index}`}>Observações</Label>
                                        <Textarea
                                            id={`observations-${index}`}
                                            value={item.observations}
                                            onChange={(e) => updateMetadata(index, 'observations', e.target.value)}
                                            placeholder="Observações adicionais sobre a música..."
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    )
}