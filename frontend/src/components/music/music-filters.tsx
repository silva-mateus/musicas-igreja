'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { dashboardApi, handleApiError } from '@/lib/api'
import type { SearchFilters } from '@/types'
import { Filter, RotateCcw, X } from 'lucide-react'

interface MusicFiltersProps {
    filters: SearchFilters
    onFiltersChange: (filters: SearchFilters) => void
}

interface Suggestions {
    artists: string[]
    categories: string[]
    liturgical_times: string[]
    musical_keys: string[]
}

export function MusicFilters({ filters, onFiltersChange }: MusicFiltersProps) {
    const [localFilters, setLocalFilters] = useState<SearchFilters>(filters)
    const [suggestions, setSuggestions] = useState<Suggestions>({
        artists: [],
        categories: [],
        liturgical_times: [],
        musical_keys: []
    })
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        loadSuggestions()
    }, [])

    useEffect(() => {
        setLocalFilters(filters)
    }, [filters])

    const loadSuggestions = async () => {
        try {
            setIsLoading(true)
            const data = await dashboardApi.getSearchSuggestions()
            setSuggestions(data)
        } catch (error) {
            console.error('Erro ao carregar sugestões:', handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }

    const handleFilterChange = (key: keyof SearchFilters, value: string | boolean) => {
        const newFilters = { ...localFilters }

        if (value === '' || value === null || value === undefined) {
            delete newFilters[key]
        } else {
            (newFilters as any)[key] = value
        }

        setLocalFilters(newFilters)
        onFiltersChange(newFilters)
    }

    const clearFilter = (key: keyof SearchFilters) => {
        const newFilters = { ...localFilters }
        delete newFilters[key]
        setLocalFilters(newFilters)
        onFiltersChange(newFilters)
    }

    const clearAllFilters = () => {
        setLocalFilters({})
        onFiltersChange({})
    }

    const hasActiveFilters = Object.keys(localFilters).length > 0

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-base font-medium flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros Avançados
                </Label>
                {hasActiveFilters && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllFilters}
                        className="gap-2"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Limpar Filtros
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Artist Filter */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="artist">Artista</Label>
                        {localFilters.artist && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => clearFilter('artist')}
                                className="h-6 w-6 p-0"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    <Select
                        value={localFilters.artist || ''}
                        onValueChange={(value) => handleFilterChange('artist', value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecionar artista" />
                        </SelectTrigger>
                        <SelectContent>
                            {suggestions.artists.map((artist) => (
                                <SelectItem key={artist} value={artist}>
                                    {artist}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                        value={localFilters.category || ''}
                        onValueChange={(value) => handleFilterChange('category', value)}
                    >
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

                {/* Liturgical Time Filter */}
                <div className="space-y-2">
                    <Label htmlFor="liturgical_time">Tempo Litúrgico</Label>
                    <Select
                        value={localFilters.liturgical_time || ''}
                        onValueChange={(value) => handleFilterChange('liturgical_time', value)}
                    >
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

                {/* Musical Key Filter */}
                <div className="space-y-2">
                    <Label htmlFor="musical_key">Tonalidade</Label>
                    <Select
                        value={localFilters.musical_key || ''}
                        onValueChange={(value) => handleFilterChange('musical_key', value)}
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

                {/* YouTube Filter */}
                <div className="space-y-2">
                    <Label htmlFor="has_youtube">YouTube</Label>
                    <Select
                        value={localFilters.has_youtube?.toString() || ''}
                        onValueChange={(value) => {
                            if (value === '') {
                                handleFilterChange('has_youtube', '')
                            } else {
                                handleFilterChange('has_youtube', value === 'true')
                            }
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Filtrar por YouTube" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="true">Com link do YouTube</SelectItem>
                            <SelectItem value="false">Sem link do YouTube</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Custom Title Search */}
            <div className="space-y-2">
                <Label htmlFor="title">Busca no Título (customizada)</Label>
                <Input
                    id="title"
                    placeholder="Digite parte do título..."
                    value={localFilters.title || ''}
                    onChange={(e) => handleFilterChange('title', e.target.value)}
                />
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Filtros ativos:</span>
                    {Object.entries(localFilters).map(([key, value]) => (
                        <Badge key={key} variant="outline">
                            {key === 'has_youtube'
                                ? (value ? 'Com YouTube' : 'Sem YouTube')
                                : `${key}: ${value}`
                            }
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    )
}