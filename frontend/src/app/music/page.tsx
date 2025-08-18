'use client'

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { MusicSearch } from '@/components/music/music-search'
import { MusicTable } from '@/components/music/music-table'
import { MusicFilters } from '@/components/music/music-filters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { musicApi, handleApiError } from '@/lib/api'
import type { MusicFile, SearchFilters, PaginationParams, PaginatedResponse } from '@/types'
import { Music, Filter, Search, Upload, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function MusicPage() {
    const [musics, setMusics] = useState<PaginatedResponse<MusicFile>>({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    })
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [filters, setFilters] = useState<SearchFilters>({})
    const [pagination, setPagination] = useState<PaginationParams>({
        page: 1,
        limit: 20,
        sort_by: 'upload_date',
        sort_order: 'desc',
    })
    const [showFilters, setShowFilters] = useState(false)

    const loadMusics = useCallback(async () => {
        try {
            setIsLoading(true)
            setError('')
            const data = await musicApi.search(filters, pagination)
            setMusics(data)
        } catch (error) {
            setError(handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }, [filters, pagination])

    useEffect(() => {
        loadMusics()
    }, [loadMusics])

    const handleSearch = (searchFilters: SearchFilters) => {
        setFilters(searchFilters)
        setPagination((prev) => ({ ...prev, page: 1 }))
    }

    const handlePageChange = (page: number) => {
        setPagination((prev) => ({ ...prev, page }))
    }

    const handleSortChange = (sort_by: string, sort_order: 'asc' | 'desc') => {
        setPagination((prev) => ({ ...prev, sort_by, sort_order, page: 1 }))
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Music className="h-8 w-8 text-primary" />
                            Gerenciar Músicas
                        </h1>
                        <p className="text-muted-foreground mt-2">Busque, visualize e organize suas músicas</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={loadMusics} variant="outline" size="sm" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Atualizar
                        </Button>
                        <Button asChild>
                            <Link href="/upload" className="gap-2">
                                <Upload className="h-4 w-4" />
                                Upload
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Search and Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Search className="h-5 w-5" />
                                Buscar Músicas
                            </span>
                            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
                                <Filter className="h-4 w-4" />
                                {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <MusicSearch onSearch={handleSearch} initialFilters={filters} />

                        {showFilters && (
                            <>
                                <Separator />
                                <MusicFilters filters={filters} onFiltersChange={setFilters} />
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Results */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>
                                Resultados ({musics?.pagination?.total || 0} música{(musics?.pagination?.total || 0) !== 1 ? 's' : ''})
                            </span>
                            <div className="text-sm text-muted-foreground">
                                Página {musics?.pagination?.page || 1} de {musics?.pagination?.pages || 1}
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {error ? (
                            <div className="text-center py-8">
                                <p className="text-destructive">{error}</p>
                                <Button onClick={loadMusics} className="mt-4">
                                    Tentar novamente
                                </Button>
                            </div>
                        ) : (
                            <MusicTable
                                musics={musics?.data || []}
                                isLoading={isLoading}
                                pagination={musics?.pagination}
                                onPageChange={handlePageChange}
                                onSortChange={handleSortChange}
                                onMusicUpdate={loadMusics}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}