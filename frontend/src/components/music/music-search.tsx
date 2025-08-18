'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { SearchFilters } from '@/types'
import { Search, X } from 'lucide-react'
import { debounce } from '@/lib/utils'

interface MusicSearchProps {
    onSearch: (filters: SearchFilters) => void
    initialFilters?: SearchFilters
}

export function MusicSearch({ onSearch, initialFilters = {} }: MusicSearchProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [activeFilters, setActiveFilters] = useState<SearchFilters>(initialFilters)

    // Debounce search
    const debouncedSearch = debounce((term: string) => {
        const newFilters = { ...activeFilters }

        if (term.trim()) {
            // Search in title by default, but could be enhanced to search multiple fields
            newFilters.title = term.trim()
        } else {
            delete newFilters.title
        }

        setActiveFilters(newFilters)
        onSearch(newFilters)
    }, 500)

    useEffect(() => {
        debouncedSearch(searchTerm)
    }, [searchTerm])

    const handleClearSearch = () => {
        setSearchTerm('')
        setActiveFilters({})
        onSearch({})
    }

    const removeFilter = (key: keyof SearchFilters) => {
        const newFilters = { ...activeFilters }
        delete newFilters[key]
        setActiveFilters(newFilters)
        onSearch(newFilters)

        // Clear search term if removing title filter
        if (key === 'title') {
            setSearchTerm('')
        }
    }

    const getFilterLabel = (key: keyof SearchFilters, value: any): string => {
        const labels: Record<string, string> = {
            title: 'Título',
            artist: 'Artista',
            category: 'Categoria',
            liturgical_time: 'Tempo Litúrgico',
            musical_key: 'Tonalidade',
            has_youtube: 'Com YouTube'
        }

        if (key === 'has_youtube') {
            return value ? 'Com YouTube' : 'Sem YouTube'
        }

        return `${labels[key] || key}: ${value}`
    }

    return (
        <div className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por título da música..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                {(searchTerm || Object.keys(activeFilters).length > 0) && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleClearSearch}
                        title="Limpar busca"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Active Filters */}
            {Object.keys(activeFilters).length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <Label className="text-sm text-muted-foreground">Filtros ativos:</Label>
                    {Object.entries(activeFilters).map(([key, value]) => (
                        <Badge
                            key={key}
                            variant="secondary"
                            className="gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => removeFilter(key as keyof SearchFilters)}
                        >
                            {getFilterLabel(key as keyof SearchFilters, value)}
                            <X className="h-3 w-3" />
                        </Badge>
                    ))}
                </div>
            )}

            {/* Quick Search Tips */}
            {!searchTerm && Object.keys(activeFilters).length === 0 && (
                <div className="text-xs text-muted-foreground">
                    💡 <strong>Dica:</strong> Use os filtros avançados para busca mais específica por artista, categoria, etc.
                </div>
            )}
        </div>
    )
}