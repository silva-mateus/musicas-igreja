'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { dashboardApi, categoriesApi, liturgicalTimesApi, handleApiError } from '@/lib/api'
import type { SearchFilters } from '@/types'
import { Search, X, Filter, ChevronDown, RotateCcw, ArrowUpDown } from 'lucide-react'
import { debounce } from '@/lib/utils'

interface SortOption {
    field: string
    order: 'asc' | 'desc'
}

interface MusicUnifiedFiltersProps {
    filters: SearchFilters
    onFiltersChange: (filters: SearchFilters) => void
    showAdvanced?: boolean
    sortBy?: SortOption
    onSortChange?: (sort: SortOption) => void
    sortFields?: { value: string; label: string }[]
}

interface FilterOptions {
    artists: string[]
    categories: string[]
    liturgicalTimes: string[]
    musicalKeys: string[]
}

const MUSICAL_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']

// Special value for "all" option since Radix Select doesn't allow empty string
const ALL_VALUE = '__all__'

const DEFAULT_SORT_FIELDS = [
    { value: 'title', label: 'Título' },
    { value: 'artist', label: 'Artista' },
    { value: 'upload_date', label: 'Data de Upload' },
    { value: 'category', label: 'Categoria' },
]

export function MusicUnifiedFilters({ 
    filters, 
    onFiltersChange, 
    showAdvanced = true,
    sortBy,
    onSortChange,
    sortFields = DEFAULT_SORT_FIELDS
}: MusicUnifiedFiltersProps) {
    const [searchTerm, setSearchTerm] = useState(filters.title || '')
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [options, setOptions] = useState<FilterOptions>({
        artists: [],
        categories: [],
        liturgicalTimes: [],
        musicalKeys: MUSICAL_KEYS
    })

    // Load filter options on mount
    useEffect(() => {
        loadFilterOptions()
    }, [])

    // Sync search term with filters
    useEffect(() => {
        setSearchTerm(filters.title || '')
    }, [filters.title])

    const loadFilterOptions = async () => {
        try {
            setIsLoading(true)
            const [artistsResult, catsResult, timesResult] = await Promise.all([
                dashboardApi.getArtists().catch(() => []),
                categoriesApi.getCategories().catch(() => ({ data: [] })),
                liturgicalTimesApi.getLiturgicalTimes().catch(() => ({ data: [] })),
            ])

            setOptions({
                artists: Array.isArray(artistsResult) ? artistsResult : [],
                categories: Array.isArray(catsResult?.data) ? catsResult.data : [],
                liturgicalTimes: Array.isArray(timesResult?.data) ? timesResult.data : [],
                musicalKeys: MUSICAL_KEYS
            })
        } catch (error) {
            console.error('Erro ao carregar opções de filtro:', handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }

    // Debounced search
    const debouncedSearch = useCallback(
        debounce((term: string) => {
            const newFilters = { ...filters }
            if (term.trim()) {
                newFilters.title = term.trim()
            } else {
                delete newFilters.title
            }
            onFiltersChange(newFilters)
        }, 400),
        [filters, onFiltersChange]
    )

    const handleSearchChange = (value: string) => {
        setSearchTerm(value)
        debouncedSearch(value)
    }

    const handleFilterChange = (key: keyof SearchFilters, value: string | boolean | undefined) => {
        const newFilters = { ...filters }
        if (value === '' || value === undefined || value === null) {
            delete newFilters[key]
        } else {
            (newFilters as any)[key] = value
        }
        onFiltersChange(newFilters)
    }

    const clearFilter = (key: keyof SearchFilters) => {
        const newFilters = { ...filters }
        delete newFilters[key]
        if (key === 'title') {
            setSearchTerm('')
        }
        onFiltersChange(newFilters)
    }

    const clearAllFilters = () => {
        setSearchTerm('')
        onFiltersChange({})
    }

    const activeFilterCount = Object.keys(filters).filter(k => {
        const val = filters[k as keyof SearchFilters]
        return val !== undefined && val !== null && val !== ''
    }).length

    const hasActiveFilters = activeFilterCount > 0

    const getFilterLabel = (key: string, value: any): string => {
        const labels: Record<string, string> = {
            title: 'Busca',
            artist: 'Artista',
            category: 'Categoria',
            liturgical_time: 'Tempo',
            musical_key: 'Tom',
            has_youtube: value ? 'Com YouTube' : 'Sem YouTube'
        }
        
        if (key === 'has_youtube') return labels[key]
        return `${labels[key] || key}: ${value}`
    }

    return (
        <Card>
            <CardContent className="pt-4 space-y-4">
                {/* Main Search Row */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por título ou nome da música..."
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-10 pr-10"
                        />
                        {searchTerm && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                onClick={() => handleSearchChange('')}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* Quick Filters (always visible on desktop) */}
                    <div className="hidden lg:flex gap-2">
                        <Select 
                            value={filters.category || ALL_VALUE} 
                            onValueChange={(v) => handleFilterChange('category', v === ALL_VALUE ? undefined : v)}
                        >
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>Todas categorias</SelectItem>
                                {options.categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select 
                            value={filters.artist || ALL_VALUE} 
                            onValueChange={(v) => handleFilterChange('artist', v === ALL_VALUE ? undefined : v)}
                        >
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Artista" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>Todos artistas</SelectItem>
                                {options.artists.map(artist => (
                                    <SelectItem key={artist} value={artist}>{artist}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Sort Dropdown */}
                    {sortBy && onSortChange && (
                        <Select 
                            value={`${sortBy.field}:${sortBy.order}`}
                            onValueChange={(v) => {
                                const [field, order] = v.split(':')
                                onSortChange({ field, order: order as 'asc' | 'desc' })
                            }}
                        >
                            <SelectTrigger className="w-auto min-w-[180px] gap-2">
                                <ArrowUpDown className="h-4 w-4" />
                                <SelectValue placeholder="Ordenar" />
                            </SelectTrigger>
                            <SelectContent>
                                {sortFields.map(field => (
                                    <>
                                        <SelectItem key={`${field.value}:asc`} value={`${field.value}:asc`}>
                                            {field.label} - Crescente
                                        </SelectItem>
                                        <SelectItem key={`${field.value}:desc`} value={`${field.value}:desc`}>
                                            {field.label} - Decrescente
                                        </SelectItem>
                                    </>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Advanced Filters Toggle */}
                    {showAdvanced && (
                        <Button 
                            variant="outline" 
                            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                            className="gap-2 shrink-0"
                        >
                            <Filter className="h-4 w-4" />
                            <span className="hidden sm:inline">Filtros</span>
                            {activeFilterCount > 0 && (
                                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                                    {activeFilterCount}
                                </Badge>
                            )}
                            <ChevronDown className={`h-4 w-4 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
                        </Button>
                    )}

                    {hasActiveFilters && (
                        <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={clearAllFilters}
                            title="Limpar todos os filtros"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Advanced Filters Panel */}
                {showAdvanced && (
                    <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                        <CollapsibleContent>
                            <div className="pt-4 border-t space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {/* Category (mobile/tablet) */}
                                    <div className="lg:hidden">
                                        <Select 
                                            value={filters.category || ALL_VALUE} 
                                            onValueChange={(v) => handleFilterChange('category', v === ALL_VALUE ? undefined : v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Categoria" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={ALL_VALUE}>Todas categorias</SelectItem>
                                                {options.categories.map(cat => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Artist (mobile/tablet) */}
                                    <div className="lg:hidden">
                                        <Select 
                                            value={filters.artist || ALL_VALUE} 
                                            onValueChange={(v) => handleFilterChange('artist', v === ALL_VALUE ? undefined : v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Artista" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={ALL_VALUE}>Todos artistas</SelectItem>
                                                {options.artists.map(artist => (
                                                    <SelectItem key={artist} value={artist}>{artist}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Liturgical Time */}
                                    <Select 
                                        value={filters.liturgical_time || ALL_VALUE} 
                                        onValueChange={(v) => handleFilterChange('liturgical_time', v === ALL_VALUE ? undefined : v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tempo Litúrgico" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_VALUE}>Todos tempos</SelectItem>
                                            {options.liturgicalTimes.map(time => (
                                                <SelectItem key={time} value={time}>{time}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {/* Musical Key */}
                                    <Select 
                                        value={filters.musical_key || ALL_VALUE} 
                                        onValueChange={(v) => handleFilterChange('musical_key', v === ALL_VALUE ? undefined : v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tom" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_VALUE}>Todos tons</SelectItem>
                                            {options.musicalKeys.map(key => (
                                                <SelectItem key={key} value={key}>{key}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {/* YouTube Filter */}
                                    <Select 
                                        value={filters.has_youtube === undefined ? ALL_VALUE : filters.has_youtube.toString()} 
                                        onValueChange={(v) => {
                                            if (v === ALL_VALUE) handleFilterChange('has_youtube', undefined)
                                            else handleFilterChange('has_youtube', v === 'true')
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="YouTube" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                                            <SelectItem value="true">Com YouTube</SelectItem>
                                            <SelectItem value="false">Sem YouTube</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                {/* Active Filters Display */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">Filtros:</span>
                        {Object.entries(filters).map(([key, value]) => {
                            if (value === undefined || value === null || value === '') return null
                            return (
                                <Badge 
                                    key={key} 
                                    variant="secondary" 
                                    className="gap-1 cursor-pointer hover:bg-destructive/20"
                                    onClick={() => clearFilter(key as keyof SearchFilters)}
                                >
                                    {getFilterLabel(key, value)}
                                    <X className="h-3 w-3" />
                                </Badge>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
