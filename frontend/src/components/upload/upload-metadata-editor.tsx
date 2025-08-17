'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { FileText, Edit3, Check, X, Plus } from 'lucide-react'
import { formatFileSize } from '@/lib/utils'
import { MultiSelect } from '@/components/ui/multi-select'

interface FileMetadata {
    file: File
    title: string
    artist: string
    new_artist?: string
    category: string // Legacy single category
    liturgical_time: string // Legacy single liturgical time
    categories: string[] // Multiple categories
    liturgical_times: string[] // Multiple liturgical times
    musical_key: string
    youtube_link: string
    observations: string
    new_categories?: string[]
    new_liturgical_times?: string[]
}

interface UploadMetadataEditorProps {
    files: File[]
    onMetadataChange: (metadata: FileMetadata[]) => void
    onRemoveFile: (index: number) => void
}

interface FilterSuggestions {
    categories: string[]
    liturgical_times: string[]
    artists: string[]
    musical_keys: string[]
}

const DEFAULT_MUSICAL_KEYS = [
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
    'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'
]

export function UploadMetadataEditor({ files, onMetadataChange, onRemoveFile }: UploadMetadataEditorProps) {
    const [metadata, setMetadata] = useState<FileMetadata[]>([])
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
    const [suggestions, setSuggestions] = useState<FilterSuggestions>({
        categories: [],
        liturgical_times: [],
        artists: [],
        musical_keys: DEFAULT_MUSICAL_KEYS
    })
    const [newCategoryInputs, setNewCategoryInputs] = useState<{ [key: number]: string }>({})
    const [newLiturgicalInputs, setNewLiturgicalInputs] = useState<{ [key: number]: string }>({})
    const [showNewCategoryInput, setShowNewCategoryInput] = useState<Set<number>>(new Set())
    const [showNewLiturgicalInput, setShowNewLiturgicalInput] = useState<Set<number>>(new Set())

    // Carregar sugestões da API
    useEffect(() => {
        const loadSuggestions = async () => {
            try {
                const response = await fetch('/api/filters/suggestions')
                const data = await response.json()
                setSuggestions({
                    categories: data.categories || [],
                    liturgical_times: data.liturgical_times || [],
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

    // Inicializar metadata quando files mudarem
    useEffect(() => {
        const initialMetadata = files.map((file, index) => ({
            file,
            title: file.name.replace(/\.[^/.]+$/, ""), // Remove extensão
            artist: '',
            new_artist: '',
            category: '',
            liturgical_time: '',
            musical_key: '',
            youtube_link: '',
            observations: '',
            categories: [],
            liturgical_times: [],
            new_categories: [],
            new_liturgical_times: []
        }))
        setMetadata(initialMetadata)
        setExpandedItems(new Set())
        setNewCategoryInputs({})
        setNewLiturgicalInputs({})
        setShowNewCategoryInput(new Set())
        setShowNewLiturgicalInput(new Set())
    }, [files])

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

    const addNewLiturgicalTime = (index: number) => {
        const newTime = newLiturgicalInputs[index]?.trim()
        if (!newTime || suggestions.liturgical_times.includes(newTime)) return

        // Adicionar à lista de sugestões localmente
        setSuggestions(prev => ({
            ...prev,
            liturgical_times: [...prev.liturgical_times, newTime].sort()
        }))

        // Adicionar à lista de tempos litúrgicos do item
        setMetadata(prev => prev.map((item, i) =>
            i === index
                ? {
                    ...item,
                    liturgical_times: [...item.liturgical_times, newTime],
                    new_liturgical_times: [...(item.new_liturgical_times || []), newTime]
                }
                : item
        ))

        // Limpar input e esconder
        setNewLiturgicalInputs(prev => ({ ...prev, [index]: '' }))
        setShowNewLiturgicalInput(prev => {
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

    if (files.length === 0) return null

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Editar Informações dos Arquivos</h3>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={expandAll}>
                        Expandir Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={collapseAll}>
                        Recolher Todos
                    </Button>
                </div>
            </div>

            {/* Ações em lote */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Aplicar a Todos os Arquivos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Select onValueChange={(value) => applyToAll('category', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecionar categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suggestions.categories.map((category) => (
                                        <SelectItem key={category} value={category}>
                                            {category}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Tempo Litúrgico</Label>
                            <Select onValueChange={(value) => applyToAll('liturgical_time', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecionar tempo" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suggestions.liturgical_times.map((time) => (
                                        <SelectItem key={time} value={time}>
                                            {time}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Artista</Label>
                            <div className="grid grid-cols-1 gap-2">
                                <Input
                                    placeholder="Selecione ou digite um novo (usará o texto como novo artista)"
                                    onChange={(e) => applyToAll('artist', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Separator />

            {/* Lista de arquivos para edição */}
            <div className="space-y-3">
                {metadata.map((item, index) => (
                    <Card key={index} className="transition-all duration-200">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-blue-500" />
                                    <div>
                                        <div className="font-medium">{item.file.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {formatFileSize(item.file.size)}
                                        </div>
                                    </div>
                                    {isFormValid(item) ? (
                                        <Badge variant="default" className="bg-green-500">
                                            <Check className="h-3 w-3 mr-1" />
                                            Válido
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive">
                                            <X className="h-3 w-3 mr-1" />
                                            Incompleto
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleExpanded(index)}
                                    >
                                        <Edit3 className="h-4 w-4" />
                                        {expandedItems.has(index) ? 'Recolher' : 'Editar'}
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

                                    <div className="space-y-2">
                                        <Label htmlFor={`liturgical_time-${index}`}>Tempos Litúrgicos</Label>
                                        <div className="flex gap-2">
                                            <MultiSelect
                                                options={suggestions.liturgical_times}
                                                value={item.liturgical_times}
                                                onChange={(value) => updateMetadata(index, 'liturgical_times', value)}
                                                placeholder="Selecionar tempos litúrgicos"
                                                className="flex-1"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setShowNewLiturgicalInput(prev => {
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
                                        {showNewLiturgicalInput.has(index) && (
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Novo tempo litúrgico"
                                                    value={newLiturgicalInputs[index] || ''}
                                                    onChange={(e) => setNewLiturgicalInputs(prev => ({ ...prev, [index]: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            addNewLiturgicalTime(index)
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => addNewLiturgicalTime(index)}
                                                    disabled={!newLiturgicalInputs[index]?.trim()}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setShowNewLiturgicalInput(prev => {
                                                            const newSet = new Set(prev)
                                                            newSet.delete(index)
                                                            return newSet
                                                        })
                                                        setNewLiturgicalInputs(prev => ({ ...prev, [index]: '' }))
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

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
                                                {suggestions.musical_keys.map((key) => (
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