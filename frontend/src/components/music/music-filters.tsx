'use client'

import { useState, useEffect } from 'react'
import { Button } from '@core/components/ui/button'
import { Input } from '@core/components/ui/input'
import { Label } from '@core/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@core/components/ui/select'
import { Badge } from '@core/components/ui/badge'
import { dashboardApi, categoriesApi, customFiltersApi, handleApiError } from '@/lib/api'
import type { SearchFilters } from '@/types'
import { Filter, RotateCcw, X } from 'lucide-react'

interface MusicFiltersProps {
    filters: SearchFilters
    onFiltersChange: (filters: SearchFilters) => void
}

interface CustomFilterGroupOption {
    id: number
    name: string
    slug: string
    values: Array<{ name: string; slug: string }>
}

interface Suggestions {
    artists: string[]
    categories: string[]
    customFilterGroups: CustomFilterGroupOption[]
    musical_keys: string[]
}

export function MusicFilters({ filters, onFiltersChange }: MusicFiltersProps) {
    const [localFilters, setLocalFilters] = useState<SearchFilters>(filters)
    const [suggestions, setSuggestions] = useState<Suggestions>({
        artists: [],
        categories: [],
        customFilterGroups: [],
        musical_keys: ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'],
    })
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        loadSuggestions()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setLocalFilters(filters)
    }, [filters])

    const loadSuggestions = async () => {
        try {
            setIsLoading(true)
            // Buscar artistas, categorias e tempos reais
            const [artistsResult, catsResult, filterGroupsResult] = await Promise.all([
                dashboardApi.getArtists().catch((err) => {
                    console.error('Erro ao carregar artistas:', err)
                    return []
                }),
                categoriesApi.getCategories().catch((err) => {
                    console.error('Erro ao carregar categorias:', err)
                    return { data: [] }
                }),
                customFiltersApi.getGroups().catch((err) => {
                    console.error('Erro ao carregar grupos de filtro:', err)
                    return []
                }),
            ])
            
            const artists = Array.isArray(artistsResult) ? artistsResult : []
            const categories = Array.isArray(catsResult?.data) ? catsResult.data : (Array.isArray(catsResult) ? catsResult : [])
            const filterGroups = Array.isArray(filterGroupsResult) ? filterGroupsResult : []
            
            setSuggestions(prev => ({
                ...prev,
                artists,
                categories,
                customFilterGroups: filterGroups,
            }))
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
            ; (newFilters as any)[key] = value
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

    const hasActiveFilters = Object.values(localFilters).some(value =>
        value !== '' && value !== null && value !== undefined && value !== false
    )

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-base font-medium flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros Avançados
                </Label>
                {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearAllFilters} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Limpar Filtros
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Artist Filter */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between min-h-[24px]">
                        <Label htmlFor="artist">Artista {isLoading && <span className="text-xs text-muted-foreground">(carregando...)</span>}</Label>
                        {localFilters.artist && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => clearFilter('artist')} className="h-6 w-6 p-0">
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    <Select value={(Array.isArray(localFilters.artist) ? localFilters.artist[0] : localFilters.artist) || ''} onValueChange={(value) => handleFilterChange('artist', value)}>
                        <SelectTrigger>
                            <SelectValue placeholder={isLoading ? "Carregando..." : "Selecionar artista"} />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-[300px]">
                            {isLoading ? (
                                <div className="py-2 px-3 text-sm text-muted-foreground">Carregando artistas...</div>
                            ) : suggestions.artists.length === 0 ? (
                                <div className="py-2 px-3 text-sm text-muted-foreground">Nenhum artista encontrado</div>
                            ) : (
                                suggestions.artists.map((artist) => (
                                    <SelectItem key={artist} value={artist}>
                                        {artist}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between min-h-[24px]">
                        <Label htmlFor="category">Categoria {isLoading && <span className="text-xs text-muted-foreground">(carregando...)</span>}</Label>
                        {localFilters.category && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => clearFilter('category')} className="h-6 w-6 p-0">
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    <Select value={(Array.isArray(localFilters.category) ? localFilters.category[0] : localFilters.category) || ''} onValueChange={(value) => handleFilterChange('category', value)}>
                        <SelectTrigger>
                            <SelectValue placeholder={isLoading ? "Carregando..." : "Selecionar categoria"} />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-[300px]">
                            {isLoading ? (
                                <div className="py-2 px-3 text-sm text-muted-foreground">Carregando categorias...</div>
                            ) : suggestions.categories.length === 0 ? (
                                <div className="py-2 px-3 text-sm text-muted-foreground">Nenhuma categoria encontrada</div>
                            ) : (
                                suggestions.categories.map((category) => (
                                    <SelectItem key={category} value={category}>
                                        {category}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Dynamic Custom Filter Groups */}
                {suggestions.customFilterGroups.map(group => {
                    const selectedValue = localFilters.custom_filters?.[group.slug]?.[0] || ''
                    return (
                        <div key={group.slug} className="space-y-2">
                            <div className="flex items-center justify-between min-h-[24px]">
                                <Label>{group.name} {isLoading && <span className="text-xs text-muted-foreground">(carregando...)</span>}</Label>
                                {selectedValue && (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                                        const newCustomFilters = { ...(localFilters.custom_filters || {}) }
                                        delete newCustomFilters[group.slug]
                                        handleFilterChange('custom_filters' as keyof SearchFilters, Object.keys(newCustomFilters).length > 0 ? newCustomFilters as any : undefined as any)
                                    }} className="h-6 w-6 p-0">
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                            <Select value={selectedValue} onValueChange={(value) => {
                                const newCustomFilters = { ...(localFilters.custom_filters || {}) }
                                if (value) {
                                    newCustomFilters[group.slug] = [value]
                                } else {
                                    delete newCustomFilters[group.slug]
                                }
                                handleFilterChange('custom_filters' as keyof SearchFilters, Object.keys(newCustomFilters).length > 0 ? newCustomFilters as any : undefined as any)
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder={`Selecionar ${group.name.toLowerCase()}`} />
                                </SelectTrigger>
                                <SelectContent position="popper" className="max-h-[300px]">
                                    {group.values.length === 0 ? (
                                        <div className="py-2 px-3 text-sm text-muted-foreground">Nenhum valor encontrado</div>
                                    ) : (
                                        group.values.map((val) => (
                                            <SelectItem key={val.slug} value={val.slug}>
                                                {val.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )
                })}

                {/* Musical Key Filter */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between min-h-[24px]">
                        <Label htmlFor="musical_key">Tonalidade</Label>
                        {localFilters.musical_key && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => clearFilter('musical_key')} className="h-6 w-6 p-0">
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    <Select value={localFilters.musical_key || ''} onValueChange={(value) => handleFilterChange('musical_key', value)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecionar tonalidade" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-[300px]">
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
                    <div className="flex items-center justify-between min-h-[24px]">
                        <Label htmlFor="has_youtube">YouTube</Label>
                        {(localFilters.has_youtube !== undefined && localFilters.has_youtube !== null) && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => clearFilter('has_youtube')} className="h-6 w-6 p-0">
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
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
                        <SelectContent position="popper" className="max-h-[300px]">
                            <SelectItem value="true">Com link do YouTube</SelectItem>
                            <SelectItem value="false">Sem link do YouTube</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Custom Title Search */}
            <div className="space-y-2">
                <div className="flex items-center justify-between min-h-[24px]">
                    <Label htmlFor="title">Busca no Título (customizada)</Label>
                    {localFilters.title && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => clearFilter('title')} className="h-6 w-6 p-0">
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>
                <Input id="title" placeholder="Digite parte do título..." value={localFilters.title || ''} onChange={(e) => handleFilterChange('title', e.target.value)} />
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Filtros ativos:</span>
                    {Object.entries(localFilters).map(([key, value]) => (
                        <Badge key={key} variant="outline">
                            {key === 'has_youtube' ? (value ? 'Com YouTube' : 'Sem YouTube') : `${key}: ${value}`}
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    )
}