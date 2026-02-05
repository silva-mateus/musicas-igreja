'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MainLayout } from '@/components/layout/main-layout'
import { MusicUnifiedFilters } from '@/components/music/music-unified-filters'
import { MusicTable } from '@/components/music/music-table'
import { MusicGroupedView } from '@/components/music/music-grouped-view'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import { useMusic, musicKeys } from '@/hooks/use-music'
import { request } from '@/lib/api'
import type { SearchFilters, PaginationParams } from '@/types'
import { Music, Upload, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { InstructionsModal, PAGE_INSTRUCTIONS } from '@/components/ui/instructions-modal'
import { useQuery } from '@tanstack/react-query'

type TabValue = 'all' | 'by-artist' | 'by-category' | 'by-liturgical-time'

export default function MusicPage() {
    const { canUpload } = useAuth()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<TabValue>('all')
    
    // Unified filters state (shared across tabs)
    const [filters, setFilters] = useState<SearchFilters>({})
    const [pagination, setPagination] = useState<PaginationParams>({
        page: 1,
        limit: 20,
        sort_by: 'upload_date',
        sort_order: 'desc',
    })

    // All tab data using TanStack Query
    const { 
        data: musics, 
        isLoading, 
        error,
        refetch: refetchMusics 
    } = useMusic(filters, pagination)

    // Grouped data queries
    const byArtistQuery = useQuery({
        queryKey: ['music', 'grouped', 'by-artist'],
        queryFn: () => request<{ groups: any[] }>('/files/grouped/by-artist'),
        enabled: activeTab === 'by-artist',
        staleTime: 5 * 60 * 1000,
    })

    const byCategoryQuery = useQuery({
        queryKey: ['music', 'grouped', 'by-category'],
        queryFn: () => request<{ groups: any[] }>('/files/grouped/by-category'),
        enabled: activeTab === 'by-category',
        staleTime: 5 * 60 * 1000,
    })

    const byLiturgicalTimeQuery = useQuery({
        queryKey: ['music', 'grouped', 'by-liturgical-time'],
        queryFn: () => request<{ groups: any[] }>('/files/grouped/by-liturgical-time'),
        enabled: activeTab === 'by-liturgical-time',
        staleTime: 5 * 60 * 1000,
    })

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
        // Invalidate all music queries
        queryClient.invalidateQueries({ queryKey: musicKeys.all })
        queryClient.invalidateQueries({ queryKey: ['music', 'grouped'] })
    }

    const handleMusicUpdate = () => {
        refetchMusics()
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    icon={Music}
                    title="Músicas"
                    description="Busque, visualize e organize suas músicas"
                    actions={
                        <div className="flex items-center gap-2">
                            <InstructionsModal
                                title={PAGE_INSTRUCTIONS.musicList.title}
                                description={PAGE_INSTRUCTIONS.musicList.description}
                                sections={PAGE_INSTRUCTIONS.musicList.sections}
                            />
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
                        </div>
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
                                        <p className="text-destructive">{error instanceof Error ? error.message : 'Erro ao carregar músicas'}</p>
                                        <Button onClick={() => refetchMusics()} className="mt-4">
                                            Tentar novamente
                                        </Button>
                                    </div>
                                ) : (
                                    <MusicTable
                                        musics={musics?.data || []}
                                        isLoading={isLoading}
                                        pagination={musics?.pagination}
                                        onPageChange={handlePageChange}
                                        onMusicUpdate={handleMusicUpdate}
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
                                    groups={byArtistQuery.data?.groups || []}
                                    isLoading={byArtistQuery.isLoading}
                                    error={byArtistQuery.error?.message || null}
                                    onRefresh={() => byArtistQuery.refetch()}
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
                                    groups={byCategoryQuery.data?.groups || []}
                                    isLoading={byCategoryQuery.isLoading}
                                    error={byCategoryQuery.error?.message || null}
                                    onRefresh={() => byCategoryQuery.refetch()}
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
                                    groups={byLiturgicalTimeQuery.data?.groups || []}
                                    isLoading={byLiturgicalTimeQuery.isLoading}
                                    error={byLiturgicalTimeQuery.error?.message || null}
                                    onRefresh={() => byLiturgicalTimeQuery.refetch()}
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
