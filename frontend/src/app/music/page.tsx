'use client'

import { useMemo, Suspense, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MainLayout } from '@/components/layout/main-layout'
import { MusicShell } from '@/components/layout/music-shell'
import { LibraryRail } from '@/components/layout/library-rail'
import { MusicUnifiedFilters } from '@/components/music/music-unified-filters'
import { MusicTable } from '@/components/music/music-table'
import { MusicGroupedView } from '@/components/music/music-grouped-view'
import { MusicListPanel } from '@/components/music/music-list-panel'
import { MusicPanelViewer } from '@/components/music/music-panel-viewer'
import { Button } from '@core/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@core/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@core/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@core/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { LoginModal } from '@/components/auth/login-modal'
import { useMusic, musicKeys } from '@/hooks/use-music'
import { useLists } from '@/hooks/use-lists'
import { request, getActiveWorkspaceId, customFiltersApi } from '@/lib/api'
import type { MusicFile, SearchFilters, PaginationParams } from '@/types'
import { Filter, Music, Music2, RefreshCw, SlidersHorizontal, Upload } from 'lucide-react'
import { useAuth } from '@core/contexts/auth-context'
import { useWorkspace } from '@/contexts/workspace-context'
import Link from 'next/link'
import { InstructionsModal, PAGE_INSTRUCTIONS } from '@/components/ui/instructions-modal'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { useQuery } from '@tanstack/react-query'
import {
    useUrlParams,
    parseString,
    parseNumber,
    parseBoolean,
    parseCommaSeparated,
    serialiseCommaSeparated,
    serialiseBoolean,
} from '@/hooks/use-url-state'

const CF_PREFIX = 'cf_'

function useFiltersFromUrl() {
    const { searchParams, setParams } = useUrlParams()

    const activeTab = parseString(searchParams, 'tab') ?? 'all'

    const filters = useMemo<SearchFilters>(() => {
        const f: SearchFilters = {}
        const title = parseString(searchParams, 'title')
        if (title) f.title = title
        const artist = parseCommaSeparated(searchParams, 'artist')
        if (artist) f.artist = artist
        const category = parseCommaSeparated(searchParams, 'category')
        if (category) f.category = category
        const musicalKey = parseString(searchParams, 'key')
        if (musicalKey) f.musical_key = musicalKey
        const hasYoutube = parseBoolean(searchParams, 'youtube')
        if (hasYoutube !== undefined) f.has_youtube = hasYoutube

        const customFilters: Record<string, string[]> = {}
        searchParams.forEach((value, key) => {
            if (key.startsWith(CF_PREFIX) && value) {
                const slug = key.slice(CF_PREFIX.length)
                const arr = value.split(',').filter(Boolean)
                if (arr.length > 0) customFilters[slug] = arr
            }
        })
        if (Object.keys(customFilters).length > 0) f.custom_filters = customFilters

        return f
    }, [searchParams])

    const pagination = useMemo<PaginationParams>(() => ({
        page: parseNumber(searchParams, 'page') ?? 1,
        limit: parseNumber(searchParams, 'limit') ?? 20,
        sort_by: parseString(searchParams, 'sort_by') ?? 'upload_date',
        sort_order: (parseString(searchParams, 'sort_order') as 'asc' | 'desc') ?? 'desc',
    }), [searchParams])

    const setActiveTab = (tab: string) => {
        setParams({ tab: tab === 'all' ? undefined : tab })
    }

    const setFilters = (newFilters: SearchFilters) => {
        const updates: Record<string, string | undefined> = {
            title: newFilters.title || undefined,
            artist: serialiseCommaSeparated(newFilters.artist),
            category: serialiseCommaSeparated(newFilters.category),
            key: newFilters.musical_key || undefined,
            youtube: serialiseBoolean(newFilters.has_youtube),
            page: undefined,
        }

        searchParams.forEach((_v, k) => {
            if (k.startsWith(CF_PREFIX)) updates[k] = undefined
        })
        if (newFilters.custom_filters) {
            for (const [slug, vals] of Object.entries(newFilters.custom_filters)) {
                if (vals.length > 0) updates[`${CF_PREFIX}${slug}`] = vals.join(',')
            }
        }

        setParams(updates)
    }

    const setPagination = (patch: Partial<PaginationParams>) => {
        const updates: Record<string, string | undefined> = {}
        if (patch.page !== undefined) updates.page = patch.page <= 1 ? undefined : String(patch.page)
        if (patch.limit !== undefined) updates.limit = patch.limit === 20 ? undefined : String(patch.limit)
        if (patch.sort_by !== undefined) updates.sort_by = patch.sort_by === 'upload_date' ? undefined : patch.sort_by
        if (patch.sort_order !== undefined) updates.sort_order = patch.sort_order === 'desc' ? undefined : patch.sort_order
        setParams(updates)
    }

    return { activeTab, setActiveTab, filters, setFilters, pagination, setPagination }
}

export default function MusicPage() {
    return (
        <Suspense>
            <MusicPageContent />
        </Suspense>
    )
}

function MusicPageContent() {
    const { hasPermission } = useAuth()
    const { activeWorkspace } = useWorkspace()
    const canUpload = hasPermission('music:upload')
    const queryClient = useQueryClient()
    const { activeTab, setActiveTab, filters, setFilters, pagination, setPagination } = useFiltersFromUrl()
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [selectedListId, setSelectedListId] = useState<number | null>(null)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [loginModalOpen, setLoginModalOpen] = useState(false)

    const {
        data: musics,
        isLoading,
        error,
        refetch: refetchMusics,
    } = useMusic(filters, pagination)

    const { data: listsData, isLoading: isLoadingLists } = useLists({ page: 1, limit: 100 })

    const wsId = activeWorkspace?.id ?? getActiveWorkspaceId()

    const byArtistQuery = useQuery({
        queryKey: ['music', 'grouped', 'by-artist', wsId],
        queryFn: () => request<{ groups: any[] }>(`/files/grouped/by-artist?workspace_id=${wsId}`),
        enabled: activeTab === 'by-artist',
        staleTime: 5 * 60 * 1000,
    })

    const byCategoryQuery = useQuery({
        queryKey: ['music', 'grouped', 'by-category', wsId],
        queryFn: () => request<{ groups: any[] }>(`/files/grouped/by-category?workspace_id=${wsId}`),
        enabled: activeTab === 'by-category',
        staleTime: 5 * 60 * 1000,
    })

    const customFilterGroupsQuery = useQuery({
        queryKey: ['custom-filter-groups', wsId],
        queryFn: () => customFiltersApi.getGroups(wsId),
        staleTime: 5 * 60 * 1000,
    })

    const tabGroups = useMemo(
        () => (customFilterGroupsQuery.data?.groups || []).filter((g) => g.show_as_tab),
        [customFilterGroupsQuery.data],
    )

    const handleRefreshAll = () => {
        queryClient.invalidateQueries({ queryKey: musicKeys.all })
        queryClient.invalidateQueries({ queryKey: ['music', 'grouped'] })
    }

    const handleMusicUpdate = () => refetchMusics()
    const handleSelectMusic = (music: MusicFile) => setSelectedId(music.id)
    const handleSelectFileId = (id: number) => setSelectedId(id)

    const handleRailSearch = (value: string) => {
        setFilters({ ...filters, title: value || undefined })
        setPagination({ page: 1 })
    }

    const totalTabCols = 3 + tabGroups.length

    // ── Desktop: MusicShell with LibraryRail ──────────────────────────────────
    const rail = (
        <LibraryRail
            musics={musics?.data || []}
            isLoadingMusics={isLoading}
            selectedMusicId={selectedId}
            onSelectMusic={setSelectedId}
            musicPagination={musics?.pagination}
            onMusicPageChange={(page) => setPagination({ page })}
            searchValue={filters.title ?? ''}
            onSearchChange={handleRailSearch}
            onOpenFilters={() => setFiltersOpen(true)}
            onRefresh={handleRefreshAll}
            sortBy={{ field: pagination.sort_by || 'upload_date', order: pagination.sort_order || 'desc' }}
            onSortChange={(sort) => setPagination({ sort_by: sort.field, sort_order: sort.order, page: 1 })}
            lists={listsData?.data || []}
            isLoadingLists={isLoadingLists}
            selectedListId={selectedListId}
            onSelectList={setSelectedListId}
            onOpenLogin={() => setLoginModalOpen(true)}
        />
    )

    const desktopContent = (
        <div className="flex flex-col h-full">
            {/* Filter Sheet */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                <SheetContent side="left" className="w-80 p-0 pt-0">
                    <SheetHeader className="px-4 py-3 border-b">
                        <SheetTitle className="flex items-center gap-2 text-sm">
                            <Filter className="h-4 w-4" /> Filtros avançados
                        </SheetTitle>
                    </SheetHeader>
                    <div className="p-4 overflow-y-auto h-full">
                        <MusicUnifiedFilters
                            filters={filters}
                            onFiltersChange={(f) => { setFilters(f); setFiltersOpen(false) }}
                            showAdvanced={true}
                            sortBy={{ field: pagination.sort_by || 'upload_date', order: pagination.sort_order || 'desc' }}
                            onSortChange={(sort) => setPagination({ sort_by: sort.field, sort_order: sort.order, page: 1 })}
                        />
                    </div>
                </SheetContent>
            </Sheet>

            {/* Right panel */}
            {selectedId ? (
                <MusicPanelViewer musicId={selectedId} />
            ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground select-none">
                    <Music className="h-14 w-14 opacity-15" />
                    <p className="text-sm">Selecione uma música para visualizar</p>
                </div>
            )}
        </div>
    )

    const desktopLayout = (
        <MusicShell rail={rail}>
            {desktopContent}
        </MusicShell>
    )

    // ── Mobile: classic MainLayout with full page ─────────────────────────────
    const mobileLayout = (
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
                            <SimpleTooltip label="Recarregar lista de músicas">
                                <Button onClick={handleRefreshAll} variant="outline" size="sm" className="gap-2">
                                    <RefreshCw className="h-4 w-4" />
                                    <span className="hidden sm:inline">Atualizar</span>
                                </Button>
                            </SimpleTooltip>
                            {canUpload && (
                                <>
                                    <Button asChild variant="outline">
                                        <Link href="/music/new-chord" className="gap-2">
                                            <Music2 className="h-4 w-4" />
                                            <span className="hidden sm:inline">Digitar Cifra</span>
                                        </Link>
                                    </Button>
                                    <Button asChild>
                                        <Link href="/upload" className="gap-2">
                                            <Upload className="h-4 w-4" />
                                            Upload
                                        </Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    }
                />
                <MusicUnifiedFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    showAdvanced={true}
                    sortBy={{ field: pagination.sort_by || 'upload_date', order: pagination.sort_order || 'desc' }}
                    onSortChange={(sort) => setPagination({ sort_by: sort.field, sort_order: sort.order, page: 1 })}
                />
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${totalTabCols}, minmax(0, 1fr))` }}>
                        <TabsTrigger value="all" className="text-xs sm:text-sm">Todas</TabsTrigger>
                        <TabsTrigger value="by-artist" className="text-xs sm:text-sm">
                            <span className="hidden sm:inline">Por&nbsp;</span>Artista
                        </TabsTrigger>
                        <TabsTrigger value="by-category" className="text-xs sm:text-sm">
                            <span className="hidden sm:inline">Por&nbsp;</span>Categoria
                        </TabsTrigger>
                        {tabGroups.map((g) => (
                            <TabsTrigger key={g.slug} value={`custom-${g.slug}`} className="text-xs sm:text-sm">
                                <span className="hidden sm:inline">Por&nbsp;</span>{g.name}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <TabsContent value="all" className="space-y-4">
                        <Card>
                            <CardHeader className="py-4">
                                <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-base">
                                    <span>{musics?.pagination?.total || 0} música{(musics?.pagination?.total || 0) !== 1 ? 's' : ''} encontrada{(musics?.pagination?.total || 0) !== 1 ? 's' : ''}</span>
                                    <span className="text-sm font-normal text-muted-foreground">
                                        Página {musics?.pagination?.page || 1} de {musics?.pagination?.pages || 1}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {error ? (
                                    <div className="text-center py-8">
                                        <p className="text-destructive">{error instanceof Error ? error.message : 'Erro ao carregar músicas'}</p>
                                        <Button onClick={() => refetchMusics()} className="mt-4">Tentar novamente</Button>
                                    </div>
                                ) : (
                                    <MusicTable
                                        musics={musics?.data || []}
                                        isLoading={isLoading}
                                        pagination={musics?.pagination}
                                        onPageChange={(page) => setPagination({ page })}
                                        onMusicUpdate={handleMusicUpdate}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="by-artist">
                        <Card>
                            <CardHeader className="py-4"><CardTitle className="text-base">Músicas por Artista</CardTitle></CardHeader>
                            <CardContent>
                                <MusicGroupedView groupType="artist" groups={byArtistQuery.data?.groups || []} isLoading={byArtistQuery.isLoading} error={byArtistQuery.error?.message || null} onRefresh={() => byArtistQuery.refetch()} filters={filters} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="by-category">
                        <Card>
                            <CardHeader className="py-4"><CardTitle className="text-base">Músicas por Categoria</CardTitle></CardHeader>
                            <CardContent>
                                <MusicGroupedView groupType="category" groups={byCategoryQuery.data?.groups || []} isLoading={byCategoryQuery.isLoading} error={byCategoryQuery.error?.message || null} onRefresh={() => byCategoryQuery.refetch()} filters={filters} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    {tabGroups.map((group) => (
                        <CustomFilterTab key={group.slug} slug={group.slug} name={group.name} wsId={wsId} activeTab={activeTab} filters={filters} />
                    ))}
                </Tabs>
            </div>
        </MainLayout>
    )

    return (
        <>
            <div className="lg:hidden">{mobileLayout}</div>
            <div className="hidden lg:block h-screen">{desktopLayout}</div>
            <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
        </>
    )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function CustomFilterTab({ slug, name, wsId, activeTab, filters }: {
    slug: string; name: string; wsId: number; activeTab: string; filters: SearchFilters
}) {
    const tabValue = `custom-${slug}`
    const query = useQuery({
        queryKey: ['music', 'grouped', 'custom', slug, wsId],
        queryFn: () => request<{ groups: any[] }>(`/files/grouped/by-custom-filter/${slug}?workspace_id=${wsId}`),
        enabled: activeTab === tabValue,
        staleTime: 5 * 60 * 1000,
    })
    return (
        <TabsContent value={tabValue}>
            <Card>
                <CardHeader className="py-4"><CardTitle className="text-base">Músicas por {name}</CardTitle></CardHeader>
                <CardContent>
                    <MusicGroupedView groupType="custom" groupLabel={name.toLowerCase()} groups={query.data?.groups || []} isLoading={query.isLoading} error={query.error?.message || null} onRefresh={() => query.refetch()} filters={filters} />
                </CardContent>
            </Card>
        </TabsContent>
    )
}
