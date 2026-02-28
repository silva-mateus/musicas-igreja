'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@core/components/ui/button'
import { Input } from '@core/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@core/components/ui/select'
import { Badge } from '@core/components/ui/badge'
import { Card, CardContent } from '@core/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { MultiSelect } from '@/components/ui/multi-select'
import { dashboardApi, categoriesApi, customFiltersApi, handleApiError, getActiveWorkspaceId } from '@/lib/api'
import type { SearchFilters, FilterOption } from '@/types'
import { Search, X, Filter, ChevronDown, RotateCcw, ArrowUpDown, Music2, Hash, Youtube } from 'lucide-react'
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
    artists: FilterOption[]
    categories: FilterOption[]
    customFilterGroups: Array<{ id: number; name: string; slug: string; values: FilterOption[] }>
    musicalKeys: string[]
}

const MUSICAL_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']

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
    const [options, setOptions] = useState<FilterOptions>({
        artists: [],
        categories: [],
        customFilterGroups: [],
        musicalKeys: MUSICAL_KEYS
    })

    // Load filter options on mount and when filters change
    useEffect(() => {
        loadFilterOptions()
    }, [filters.category, filters.artist, filters.musical_key])

    // Sync search term with filters
    useEffect(() => {
        setSearchTerm(filters.title || '')
    }, [filters.title])

    const loadFilterOptions = async () => {
        try {
            const params = new URLSearchParams()
            if (filters.category) {
                const categories = Array.isArray(filters.category) ? filters.category : [filters.category]
                categories.forEach(cat => params.append('category', cat))
            }
            if (filters.artist) {
                const artists = Array.isArray(filters.artist) ? filters.artist : [filters.artist]
                artists.forEach(artist => params.append('artist', artist))
            }
            if (filters.musical_key) params.append('musical_key', filters.musical_key)
            params.append('workspace_id', String(getActiveWorkspaceId()))

            const response = await fetch(`/api/filters/suggestions?${params.toString()}`)
            const data = await response.json()

            const toFilterOptions = (values: unknown): FilterOption[] =>
                (Array.isArray(values) ? values : [])
                    .filter((v: any) => v && v.slug && v.label)
                    .map((v: any) => ({ slug: v.slug, label: v.label }))

            setOptions({
                artists: toFilterOptions(data.artists),
                categories: toFilterOptions(data.categories),
                customFilterGroups: (data.custom_filter_groups || []).map((g: any) => ({
                    id: g.id,
                    name: g.name,
                    slug: g.slug,
                    values: (g.values || []).map((v: any) => ({ slug: v.slug, label: v.name })),
                })),
                musicalKeys: Array.isArray(data.musical_keys) && data.musical_keys.length > 0 ? data.musical_keys : MUSICAL_KEYS
            })
        } catch (error) {
            console.error('Erro ao carregar opções de filtro:', handleApiError(error))
            setOptions({
                artists: [],
                categories: [],
                customFilterGroups: [],
                musicalKeys: MUSICAL_KEYS
            })
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

    const handleFilterChange = (key: keyof SearchFilters, value: string | boolean | string[] | undefined) => {
        const newFilters = { ...filters }
        if (value === '' || value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
            delete newFilters[key]
        } else {
            (newFilters as any)[key] = value
        }
        onFiltersChange(newFilters)
    }

    const handleFilterValueRemove = (key: keyof SearchFilters, value: string) => {
        const current = filters[key]
        if (!Array.isArray(current)) {
            clearFilter(key)
            return
        }
        const next = current.filter((item) => item !== value)
        handleFilterChange(key, next)
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

    const activeFilterCount = Object.keys(filters).reduce((count, k) => {
        const val = filters[k as keyof SearchFilters]
        if (val === undefined || val === null || val === '') return count
        if (k === 'custom_filters' && typeof val === 'object' && !Array.isArray(val)) {
            return count + Object.values(val as Record<string, string[]>).reduce((sum, arr) => sum + arr.length, 0)
        }
        if (Array.isArray(val)) return val.length > 0 ? count + val.length : count
        return count + 1
    }, 0)

    const hasActiveFilters = activeFilterCount > 0

    const allFilterValues = options.customFilterGroups.flatMap(g => g.values)
    const allOptions = [...options.categories, ...allFilterValues, ...options.artists]
    const slugToLabel = (slug: string): string => {
        const opt = allOptions.find(o => o.slug === slug)
        return opt?.label ?? slug
    }

    const getFilterLabel = (key: string, value: any): string => {
        const labels: Record<string, string> = {
            title: 'Busca',
            artist: 'Artista',
            category: 'Categoria',
            musical_key: 'Tom',
            has_youtube: value ? 'Com YouTube' : 'Sem YouTube'
        }
        
        if (key === 'has_youtube') return labels[key]
        if (key === 'category' || key === 'artist') {
            return `${labels[key] || key}: ${slugToLabel(value)}`
        }
        return `${labels[key] || key}: ${value}`
    }

    const getCustomFilterGroupName = (slug: string): string => {
        const group = options.customFilterGroups.find(g => g.slug === slug)
        return group?.name ?? slug
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
                        <MultiSelect
                            options={options.categories.map(o => ({ value: o.slug, label: o.label }))}
                            value={Array.isArray(filters.category) ? filters.category : filters.category ? [filters.category] : []}
                            onChange={(values) => handleFilterChange('category', values)}
                            placeholder="Categoria"
                            className="w-52"
                        />

                        <MultiSelect
                            options={options.artists.map(o => ({ value: o.slug, label: o.label }))}
                            value={Array.isArray(filters.artist) ? filters.artist : filters.artist ? [filters.artist] : []}
                            onChange={(values) => handleFilterChange('artist', values)}
                            placeholder="Artista"
                            className="w-52"
                        />
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
                                {sortFields.flatMap(field => [
                                    <SelectItem key={`${field.value}:asc`} value={`${field.value}:asc`}>
                                        {field.label} - Crescente
                                    </SelectItem>,
                                    <SelectItem key={`${field.value}:desc`} value={`${field.value}:desc`}>
                                        {field.label} - Decrescente
                                    </SelectItem>
                                ])}
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
                                         <MultiSelect
                                             options={options.categories.map(o => ({ value: o.slug, label: o.label }))}
                                             value={Array.isArray(filters.category) ? filters.category : filters.category ? [filters.category] : []}
                                             onChange={(values) => handleFilterChange('category', values)}
                                             placeholder="Categoria"
                                             className="w-full"
                                         />
                                     </div>

                                     {/* Artist (mobile/tablet) */}
                                     <div className="lg:hidden">
                                         <MultiSelect
                                             options={options.artists.map(o => ({ value: o.slug, label: o.label }))}
                                             value={Array.isArray(filters.artist) ? filters.artist : filters.artist ? [filters.artist] : []}
                                             onChange={(values) => handleFilterChange('artist', values)}
                                             placeholder="Artista"
                                             className="w-full"
                                         />
                                     </div>

                                    {/* Dynamic Custom Filter Groups */}
                                    {options.customFilterGroups.map(group => (
                                         <MultiSelect
                                             key={group.slug}
                                             options={group.values.map(v => ({ value: v.slug, label: v.label }))}
                                             value={filters.custom_filters?.[group.slug] || []}
                                             onChange={(values) => {
                                                 const newCustomFilters = { ...(filters.custom_filters || {}) }
                                                 if (values.length > 0) {
                                                     newCustomFilters[group.slug] = values
                                                 } else {
                                                     delete newCustomFilters[group.slug]
                                                 }
                                                 handleFilterChange('custom_filters', Object.keys(newCustomFilters).length > 0 ? newCustomFilters : undefined)
                                             }}
                                             placeholder={group.name}
                                             className="w-full"
                                         />
                                    ))}

                                    {/* Musical Key */}
                                     <Select 
                                         value={filters.musical_key || '__all__'} 
                                         onValueChange={(v) => handleFilterChange('musical_key', v === '__all__' ? undefined : v)}
                                     >
                                        <SelectTrigger className="gap-2">
                                            <Hash className="h-4 w-4 shrink-0" />
                                            <SelectValue placeholder="Tom" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">Todos tons</SelectItem>
                                            {options.musicalKeys.map(key => (
                                                <SelectItem key={key} value={key}>{key}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {/* YouTube Filter */}
                                     <Select 
                                         value={filters.has_youtube === undefined ? '__all__' : filters.has_youtube.toString()} 
                                        onValueChange={(v) => {
                                             if (v === '__all__') handleFilterChange('has_youtube', undefined)
                                            else handleFilterChange('has_youtube', v === 'true')
                                        }}
                                    >
                                        <SelectTrigger className="gap-2">
                                            <Youtube className="h-4 w-4 shrink-0" />
                                            <SelectValue placeholder="YouTube" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">Todos</SelectItem>
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
                        {Object.entries(filters).flatMap(([key, value]) => {
                            if (value === undefined || value === null || value === '') return []

                            if (key === 'custom_filters' && typeof value === 'object' && !Array.isArray(value)) {
                                return Object.entries(value as Record<string, string[]>).flatMap(([groupSlug, vals]) =>
                                    vals.map((v) => (
                                        <Badge
                                            key={`cf:${groupSlug}:${v}`}
                                            variant="secondary"
                                            className="gap-1 cursor-pointer hover:bg-destructive/20"
                                            onClick={() => {
                                                const newCf = { ...(filters.custom_filters || {}) }
                                                newCf[groupSlug] = newCf[groupSlug]?.filter(x => x !== v) || []
                                                if (newCf[groupSlug].length === 0) delete newCf[groupSlug]
                                                handleFilterChange('custom_filters', Object.keys(newCf).length > 0 ? newCf : undefined)
                                            }}
                                        >
                                            {getCustomFilterGroupName(groupSlug)}: {slugToLabel(v)}
                                            <X className="h-3 w-3" />
                                        </Badge>
                                    ))
                                )
                            }

                            if (Array.isArray(value)) {
                                return value.map((item) => (
                                    <Badge 
                                        key={`${key}:${item}`} 
                                        variant="secondary" 
                                        className="gap-1 cursor-pointer hover:bg-destructive/20"
                                        onClick={() => handleFilterValueRemove(key as keyof SearchFilters, item)}
                                    >
                                        {getFilterLabel(key, item)}
                                        <X className="h-3 w-3" />
                                    </Badge>
                                ))
                            }
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
