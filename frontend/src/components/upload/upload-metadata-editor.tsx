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
import { FileText, Edit3, Check, X } from 'lucide-react'
import { formatFileSize } from '@/lib/utils'

interface FileMetadata {
    file: File
    title: string
    artist: string
    category: string
    liturgical_time: string
    musical_key: string
    youtube_link: string
    observations: string
}

interface UploadMetadataEditorProps {
    files: File[]
    onMetadataChange: (metadata: FileMetadata[]) => void
    onRemoveFile: (index: number) => void
}

const CATEGORIES = [
    'Adoração', 'Louvor', 'Comunhão', 'Entrada', 'Ofertório', 'Final', 'Santíssimo', 'Missa'
]

const LITURGICAL_TIMES = [
    'Advento', 'Natal', 'Quaresma', 'Páscoa', 'Tempo Comum'
]

const MUSICAL_KEYS = [
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
    'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'
]

export function UploadMetadataEditor({ files, onMetadataChange, onRemoveFile }: UploadMetadataEditorProps) {
    const [metadata, setMetadata] = useState<FileMetadata[]>([])
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

    // Inicializar metadata quando files mudarem
    useEffect(() => {
        const initialMetadata = files.map((file, index) => ({
            file,
            title: file.name.replace(/\.[^/.]+$/, ""), // Remove extensão
            artist: '',
            category: '',
            liturgical_time: '',
            musical_key: '',
            youtube_link: '',
            observations: ''
        }))
        setMetadata(initialMetadata)
        setExpandedItems(new Set())
    }, [files])

    // Notificar mudanças de metadata
    useEffect(() => {
        if (metadata.length > 0) {
            onMetadataChange(metadata)
        }
    }, [metadata]) // Removido onMetadataChange das dependências para evitar loop

    const updateMetadata = (index: number, field: keyof Omit<FileMetadata, 'file'>, value: string) => {
        setMetadata(prev => prev.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ))
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

    const isFormValid = (item: FileMetadata) => {
        return item.title.trim().length > 0 && item.category.length > 0
    }

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
                                    {CATEGORIES.map((category) => (
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
                                    {LITURGICAL_TIMES.map((time) => (
                                        <SelectItem key={time} value={time}>
                                            {time}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Artista</Label>
                            <Input
                                placeholder="Nome do artista"
                                onChange={(e) => applyToAll('artist', e.target.value)}
                            />
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
                                            value={item.artist}
                                            onChange={(e) => updateMetadata(index, 'artist', e.target.value)}
                                            placeholder="Nome do artista"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`category-${index}`}>Categoria *</Label>
                                        <Select
                                            value={item.category}
                                            onValueChange={(value) => updateMetadata(index, 'category', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecionar categoria" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CATEGORIES.map((category) => (
                                                    <SelectItem key={category} value={category}>
                                                        {category}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`liturgical_time-${index}`}>Tempo Litúrgico</Label>
                                        <Select
                                            value={item.liturgical_time}
                                            onValueChange={(value) => updateMetadata(index, 'liturgical_time', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecionar tempo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LITURGICAL_TIMES.map((time) => (
                                                    <SelectItem key={time} value={time}>
                                                        {time}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
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
                                                {MUSICAL_KEYS.map((key) => (
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