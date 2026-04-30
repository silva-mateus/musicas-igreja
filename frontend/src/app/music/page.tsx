'use client'

import { useMemo, Suspense, useState, useRef, useEffect, useCallback } from 'react'
import { MusicShell } from '@/components/layout/music-shell'
import { LibraryRail } from '@/components/layout/library-rail'
import { MusicUnifiedFilters } from '@/components/music/music-unified-filters'
import { MusicPanelViewer } from '@/components/music/music-panel-viewer'
import { ListPanelViewer } from '@/components/music/list-panel-viewer'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { LoginModal } from '@/components/auth/login-modal'
import { useInfiniteMusic } from '@/hooks/use-music'
import { useLists } from '@/hooks/use-lists'
import type { SearchFilters, PaginationParams } from '@/types'
import { Filter, Music } from 'lucide-react'
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
        page: 1,
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
        const updates: Record<string, string | undefined> = { page: undefined }
        if (patch.limit !== undefined) updates.limit = patch.limit === 20 ? undefined : String(patch.limit)
        if (patch.sort_by !== undefined) updates.sort_by = patch.sort_by === 'upload_date' ? undefined : patch.sort_by
        if (patch.sort_order !== undefined) updates.sort_order = patch.sort_order === 'desc' ? undefined : patch.sort_order
        setParams(updates)
    }

    const selectedMusicId = parseNumber(searchParams, 'm') ?? null
    const selectedListId = parseNumber(searchParams, 'l') ?? null
    const railTab = (parseString(searchParams, 'rail') ?? 'musicas') as 'musicas' | 'listas'

    const setSelectedMusic = (id: number | null) =>
        setParams({ m: id ? String(id) : undefined, l: undefined })

    const setSelectedList = (id: number | null) =>
        setParams({ l: id ? String(id) : undefined, m: undefined, rail: 'listas' })

    const setRailTab = (tab: 'musicas' | 'listas') =>
        setParams({ rail: tab === 'musicas' ? undefined : tab })

    return { activeTab, setActiveTab, filters, setFilters, pagination, setPagination, selectedMusicId, selectedListId, railTab, setSelectedMusic, setSelectedList, setRailTab }
}

export default function MusicPage() {
    return (
        <Suspense>
            <MusicPageContent />
        </Suspense>
    )
}

function MusicPageContent() {
    const { filters, setFilters, pagination, setPagination, selectedMusicId, selectedListId, railTab, setSelectedMusic, setSelectedList, setRailTab } = useFiltersFromUrl()
    const [mode, setMode] = useState<'read' | 'edit'>('read')
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [railOpen, setRailOpen] = useState(false)
    const [railCollapsed, setRailCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false
        return localStorage.getItem('rail_collapsed') === 'true'
    })

    useEffect(() => {
        localStorage.setItem('rail_collapsed', String(railCollapsed))
    }, [railCollapsed])

    // Reset to read mode when selected music changes
    const prevMusicIdRef = useRef<number | null>(null)
    if (selectedMusicId !== prevMusicIdRef.current) {
        prevMusicIdRef.current = selectedMusicId
        if (mode === 'edit') setMode('read')
    }
    // Close mobile drawer when a music is selected
    const prevRailOpenRef = useRef(false)
    if (selectedMusicId && railOpen && !prevRailOpenRef.current) {
        setRailOpen(false)
    }
    prevRailOpenRef.current = railOpen

    const [loginModalOpen, setLoginModalOpen] = useState(false)

    const {
        data: musics,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteMusic(filters, pagination)

    const { data: listsData, isLoading: isLoadingLists } = useLists({ page: 1, limit: 100 })

    const handleRailSearch = (value: string) => {
        setFilters({ ...filters, title: value || undefined })
        setPagination({ page: 1 })
    }

    const handleRailFiltersChange = (nextFilters: SearchFilters) => {
        setFilters(nextFilters)
        setPagination({ page: 1 })
    }

    const flatMusics = useMemo(() => musics?.pages.flatMap((page) => page.data) ?? [], [musics])
    const musicPagination = useMemo(() => musics?.pages[0]?.pagination, [musics])

    const handleLoadMore = useCallback(() => {
        if (!hasNextPage || isFetchingNextPage) return
        fetchNextPage()
    }, [fetchNextPage, hasNextPage, isFetchingNextPage])

    const rail = (
        <LibraryRail
            musics={flatMusics}
            isLoadingMusics={isLoading}
            isFetchingMore={isFetchingNextPage}
            hasMore={!!hasNextPage}
            selectedMusicId={selectedMusicId}
            onSelectMusic={(id) => { setSelectedMusic(id); setRailOpen(false) }}
            musicPagination={musicPagination}
            onLoadMore={handleLoadMore}
            searchValue={filters.title ?? ''}
            onSearchChange={handleRailSearch}
            onOpenFilters={() => setFiltersOpen(true)}
            filters={filters}
            onFiltersChange={handleRailFiltersChange}
            sortBy={{ field: pagination.sort_by || 'upload_date', order: pagination.sort_order || 'desc' }}
            onSortChange={(sort) => setPagination({ sort_by: sort.field, sort_order: sort.order, page: 1 })}
            lists={listsData?.data || []}
            isLoadingLists={isLoadingLists}
            selectedListId={selectedListId}
            onSelectList={(id) => { setSelectedList(id); setRailOpen(false) }}
            activeRailTab={railTab}
            onRailTabChange={setRailTab}
            onOpenLogin={() => setLoginModalOpen(true)}
        />
    )

    const content = (
        <div className="flex flex-col h-full">
            {/* Advanced filter sheet */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                <SheetContent side="left" className="w-[320px] p-0 flex flex-col">
                    <SheetHeader className="px-4 py-3 border-b bg-card">
                        <SheetTitle className="flex items-center gap-2 text-sm">
                            <Filter className="h-4 w-4" /> Filtros avançados
                        </SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-4 py-4">
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

            {selectedMusicId ? (
                <MusicPanelViewer musicId={selectedMusicId} mode={mode} onExitEdit={() => setMode('read')} onEnterEdit={() => setMode('edit')} />
            ) : selectedListId ? (
                <ListPanelViewer listId={selectedListId} />
            ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground select-none">
                    <Music className="h-14 w-14 opacity-15" />
                    <p className="text-sm">Selecione uma música para visualizar</p>
                </div>
            )}
        </div>
    )

    return (
        <>
            <div className="h-screen">
                <MusicShell
                    rail={rail}
                    mode={mode}
                    onModeChange={setMode}
                    railOpen={railOpen}
                    onRailOpenChange={setRailOpen}
                    railCollapsed={railCollapsed}
                    onRailCollapse={setRailCollapsed}
                    hasSelectedContent={!!(selectedMusicId || selectedListId)}
                >
                    {content}
                </MusicShell>
            </div>
            <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
        </>
    )
}
