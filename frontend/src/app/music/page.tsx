'use client'

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { MusicUnifiedFilters } from '@/components/music/music-unified-filters'
import { MusicTable } from '@/components/music/music-table'
import { MusicGroupedView } from '@/components/music/music-grouped-view'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import { musicApi, handleApiError, request } from '@/lib/api'
import type { MusicFile, SearchFilters, PaginationParams, PaginatedResponse } from '@/types'
import { Music, Upload, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

type TabValue = 'all' | 'by-artist' | 'by-category' | 'by-liturgical-time'

interface GroupedData {
    groups: any[]
    isLoading: boolean
    error: string | null
}

export default function MusicPage() {
    const { canUpload } = useAuth()
    const [activeTab, setActiveTab] = useState<TabValue>('all')
    
    // Unified filters state (shared across tabs)
    const [filters, setFilters] = useState<SearchFilters>({})
    
    // All tab data
    const [musics, setMusics] = useState<PaginatedResponse<MusicFile>>({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    })
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [pagination, setPagination] = useState<PaginationParams>({
        page: 1,
        limit: 20,
        sort_by: 'upload_date',
        sort_order: 'desc',
    })

    // Grouped tabs data
    const [byArtist, setByArtist] = useState<GroupedData>({ groups: [], isLoading: false, error: null })
    const [byCategory, setByCategory] = useState<GroupedData>({ groups: [], isLoading: false, error: null })
    const [byLiturgicalTime, setByLiturgicalTime] = useState<GroupedData>({ groups: [], isLoading: false, error: null })

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

    const loadByArtist = useCallback(async () => {
        try {
            setByArtist(prev => ({ ...prev, isLoading: true, error: null }))
            const data = await request<any>('/files/grouped/by-artist')
            setByArtist({ groups: data.groups || [], isLoading: false, error: null })
        } catch (error) {
            setByArtist({ groups: [], isLoading: false, error: handleApiError(error) })
        }
    }, [])

    const loadByCategory = useCallback(async () => {
        try {
            setByCategory(prev => ({ ...prev, isLoading: true, error: null }))
            const data = await request<any>('/files/grouped/by-category')
            setByCategory({ groups: data.groups || [], isLoading: false, error: null })
        } catch (error) {
            setByCategory({ groups: [], isLoading: false, error: handleApiError(error) })
        }
    }, [])

    const loadByLiturgicalTime = useCallback(async () => {
        try {
            setByLiturgicalTime(prev => ({ ...prev, isLoading: true, error: null }))
            const data = await request<any>('/files/grouped/by-liturgical-time')
            setByLiturgicalTime({ groups: data.groups || [], isLoading: false, error: null })
        } catch (error) {
            setByLiturgicalTime({ groups: [], isLoading: false, error: handleApiError(error) })
        }
    }, [])

    // Load data based on active tab
    useEffect(() => {
        if (activeTab === 'all') {
            loadMusics()
        } else if (activeTab === 'by-artist' && byArtist.groups.length === 0 && !byArtist.isLoading) {
            loadByArtist()
        } else if (activeTab === 'by-category' && byCategory.groups.length === 0 && !byCategory.isLoading) {
            loadByCategory()
        } else if (activeTab === 'by-liturgical-time' && byLiturgicalTime.groups.length === 0 && !byLiturgicalTime.isLoading) {
            loadByLiturgicalTime()
        }
    }, [activeTab, loadMusics, loadByArtist, loadByCategory, loadByLiturgicalTime, byArtist.groups.length, byArtist.isLoading, byCategory.groups.length, byCategory.isLoading, byLiturgicalTime.groups.length, byLiturgicalTime.isLoading])

    // Reset pagination when filters change
    const handleFiltersChange = (newFilters: SearchFilters) => {
        setFilters(newFilters)
        setPagination((prev) => ({ ...prev, page: 1 }))
    }

    const handlePageChange = (page: number) => {
        setPagination((prev) => ({ ...prev, page }))
    }

    const handleSortChange = (sort_by: string, sort_order: 'asc' | 'desc') => {
        setPagination((prev) => ({ ...prev, sort_by, sort_order, page: 1 }))
    }

    const handleRefreshAll = () => {
        // Reset grouped data to force reload
        setByArtist({ groups: [], isLoading: false, error: null })
        setByCategory({ groups: [], isLoading: false, error: null })
        setByLiturgicalTime({ groups: [], isLoading: false, error: null })
        
        // Reload current tab
        if (activeTab === 'all') {
            loadMusics()
        } else if (activeTab === 'by-artist') {
            loadByArtist()
        } else if (activeTab === 'by-category') {
            loadByCategory()
        } else if (activeTab === 'by-liturgical-time') {
            loadByLiturgicalTime()
        }
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    icon={Music}
                    title="Músicas"
                    description="Busque, visualize e organize suas músicas"
                    actions={
                        <>
                            <Button onClick={handleRefreshAll} variant="outline" size="sm" className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                <span className="hidden sm:inline">Atualizar</span>
                            </Button>
                            {canUpload && (
                                <Button asChild>
                                    <Link href="/upload" className="gap-2">
                                        <Upload className="h-4 w-4" />
                                        Upload
                                    </Link>
                                </Button>
                            )}
                        </>
                    }
                />

                {/* Unified Search and Filters */}
                <MusicUnifiedFilters 
                    filters={filters} 
                    onFiltersChange={handleFiltersChange}
                    showAdvanced={true}
                    sortBy={{ field: pagination.sort_by || 'upload_date', order: pagination.sort_order || 'desc' }}
                    onSortChange={(sort) => handleSortChange(sort.field, sort.order)}
                />

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="all" className="text-xs sm:text-sm">
                            Todas
                        </TabsTrigger>
                        <TabsTrigger value="by-artist" className="text-xs sm:text-sm">
                            <span className="hidden sm:inline">Por&nbsp;</span>Artista
                        </TabsTrigger>
                        <TabsTrigger value="by-category" className="text-xs sm:text-sm">
                            <span className="hidden sm:inline">Por&nbsp;</span>Categoria
                        </TabsTrigger>
                        <TabsTrigger value="by-liturgical-time" className="text-xs sm:text-sm">
                            <span className="hidden sm:inline">Por&nbsp;</span>Tempo
                        </TabsTrigger>
                    </TabsList>

                    {/* All Music Tab */}
                    <TabsContent value="all" className="space-y-4">
                        <Card>
                            <CardHeader className="py-4">
                                <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-base">
                                    <span>
                                        {musics?.pagination?.total || 0} música{(musics?.pagination?.total || 0) !== 1 ? 's' : ''} encontrada{(musics?.pagination?.total || 0) !== 1 ? 's' : ''}
                                    </span>
                                    <span className="text-sm font-normal text-muted-foreground">
                                        Página {musics?.pagination?.page || 1} de {musics?.pagination?.pages || 1}
                                    </span>
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
                                        onMusicUpdate={loadMusics}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* By Artist Tab */}
                    <TabsContent value="by-artist">
                        <Card>
                            <CardHeader className="py-4">
                                <CardTitle className="text-base">
                                    Músicas por Artista
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <MusicGroupedView
                                    groupType="artist"
                                    groups={byArtist.groups}
                                    isLoading={byArtist.isLoading}
                                    error={byArtist.error}
                                    onRefresh={loadByArtist}
                                    filters={filters}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* By Category Tab */}
                    <TabsContent value="by-category">
                        <Card>
                            <CardHeader className="py-4">
                                <CardTitle className="text-base">
                                    Músicas por Categoria
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <MusicGroupedView
                                    groupType="category"
                                    groups={byCategory.groups}
                                    isLoading={byCategory.isLoading}
                                    error={byCategory.error}
                                    onRefresh={loadByCategory}
                                    filters={filters}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* By Liturgical Time Tab */}
                    <TabsContent value="by-liturgical-time">
                        <Card>
                            <CardHeader className="py-4">
                                <CardTitle className="text-base">
                                    Músicas por Tempo Litúrgico
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <MusicGroupedView
                                    groupType="liturgical-time"
                                    groups={byLiturgicalTime.groups}
                                    isLoading={byLiturgicalTime.isLoading}
                                    error={byLiturgicalTime.error}
                                    onRefresh={loadByLiturgicalTime}
                                    filters={filters}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </MainLayout>
    )
}
