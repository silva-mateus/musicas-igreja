'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Music2,
  FileText,
  Loader2,
  SlidersHorizontal,
  Plus,
  List,
  Settings,
  LogIn,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@core/components/ui/button'
import { Input } from '@core/components/ui/input'
import { Badge } from '@core/components/ui/badge'
import { Skeleton } from '@core/components/ui/skeleton'
import { ScrollArea } from '@core/components/ui/scroll-area'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { FilterOption, MusicFile, MusicList, SearchFilters } from '@/types'
import { useAuth } from '@core/contexts/auth-context'
import { useWorkspace } from '@/contexts/workspace-context'
import { getActiveWorkspaceId } from '@/lib/api'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh-indicator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type ThemeMode = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'musicas_theme'

function MusicTypeIcon({ contentType }: { contentType?: string }) {
  if (contentType === 'chord') return <Music2 className="w-3 h-3 shrink-0 text-[hsl(var(--chord-accent))]" />
  if (contentType === 'chord_converting') return <Loader2 className="w-3 h-3 shrink-0 text-muted-foreground animate-spin" />
  return <FileText className="w-3 h-3 shrink-0 text-muted-foreground" />
}

interface LibraryRailProps {
  // Music data
  musics: MusicFile[]
  isLoadingMusics: boolean
  isFetchingMore?: boolean
  hasMore?: boolean
  selectedMusicId: number | null
  onSelectMusic: (id: number) => void
  musicPagination?: { page: number; limit: number; total: number; pages: number }
  onLoadMore?: () => void
  // Search / filter
  searchValue: string
  onSearchChange: (value: string) => void
  onOpenFilters: () => void
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  // Sort chips
  sortBy?: { field: string; order: 'asc' | 'desc' }
  onSortChange?: (sort: { field: string; order: 'asc' | 'desc' }) => void
  // Lists data
  lists: MusicList[]
  isLoadingLists: boolean
  selectedListId: number | null
  onSelectList: (id: number) => void
  // Rail tab (controlled from parent for URL sync)
  activeRailTab: RailTab
  onRailTabChange: (tab: RailTab) => void
  // Auth gate for login button
  onOpenLogin: () => void
}

type RailTab = 'musicas' | 'listas'

const SORT_CHIPS = [
  { label: 'Recentes', field: 'upload_date', order: 'desc' as const },
  { label: 'A–Z', field: 'title', order: 'asc' as const },
  { label: 'Artista', field: 'artist', order: 'asc' as const },
]

export function LibraryRail({
  musics,
  isLoadingMusics,
  isFetchingMore,
  hasMore,
  selectedMusicId,
  onSelectMusic,
  musicPagination,
  onLoadMore,
  searchValue,
  onSearchChange,
  onOpenFilters,
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  lists,
  isLoadingLists,
  selectedListId,
  onSelectList,
  activeRailTab,
  onRailTabChange,
  onOpenLogin,
}: LibraryRailProps) {
  const activeTab = activeRailTab
  const setActiveTab = onRailTabChange
  const [listSearch, setListSearch] = useState('')
  const [isFilterLoading, setIsFilterLoading] = useState(false)
  const [filterOptions, setFilterOptions] = useState<{
    categories: FilterOption[]
    tempoLiturgico: FilterOption[]
    tempoLabel: string
  }>({
    categories: [],
    tempoLiturgico: [],
    tempoLabel: 'Tempo litúrgico',
  })
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system'
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null
    return stored || 'system'
  })
  const { isAuthenticated } = useAuth()
  const { activeWorkspace } = useWorkspace()

  const filteredLists = useMemo(() => {
    if (!listSearch) return lists
    const lower = listSearch.toLowerCase()
    return lists.filter((l) => l.name.toLowerCase().includes(lower))
  }, [lists, listSearch])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    const applyTheme = (isDark: boolean) => {
      root.classList.toggle('dark', isDark)
    }

    localStorage.setItem(THEME_STORAGE_KEY, themeMode)

    if (themeMode === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(media.matches)
      const handler = (event: MediaQueryListEvent) => applyTheme(event.matches)
      if (media.addEventListener) {
        media.addEventListener('change', handler)
        return () => media.removeEventListener('change', handler)
      }
      media.addListener(handler)
      return () => media.removeListener(handler)
    }

    applyTheme(themeMode === 'dark')
  }, [themeMode])

  useEffect(() => {
    let isMounted = true
    const loadFilterOptions = async () => {
      setIsFilterLoading(true)
      try {
        const params = new URLSearchParams()
        params.append('workspace_id', String(getActiveWorkspaceId()))
        const response = await fetch(`/api/filters/suggestions?${params.toString()}`)
        const data = await response.json()

        const toFilterOptions = (values: unknown): FilterOption[] =>
          (Array.isArray(values) ? values : [])
            .filter((v: any) => v && v.slug && v.label)
            .map((v: any) => ({ slug: v.slug, label: v.label }))

        const groups = Array.isArray(data.custom_filter_groups) ? data.custom_filter_groups : []
        const tempoGroup = groups.find((g: any) => g.slug === 'tempo-liturgico')
        const tempoValues = Array.isArray(tempoGroup?.values)
          ? tempoGroup.values
              .filter((v: any) => v && v.slug)
              .map((v: any) => ({ slug: v.slug, label: v.name ?? v.label ?? v.slug }))
          : []

        if (!isMounted) return
        setFilterOptions({
          categories: toFilterOptions(data.categories),
          tempoLiturgico: tempoValues,
          tempoLabel: tempoGroup?.name ?? 'Tempo litúrgico',
        })
      } catch {
        if (!isMounted) return
        setFilterOptions({
          categories: [],
          tempoLiturgico: [],
          tempoLabel: 'Tempo litúrgico',
        })
      } finally {
        if (isMounted) setIsFilterLoading(false)
      }
    }

    loadFilterOptions()
    return () => {
      isMounted = false
    }
  }, [activeWorkspace?.id])

  const selectedCategories = Array.isArray(filters.category)
    ? filters.category
    : filters.category
    ? [filters.category]
    : []
  const selectedTempo = filters.custom_filters?.['tempo-liturgico'] || []

  const toggleCategory = (slug: string) => {
    const next = selectedCategories.includes(slug)
      ? selectedCategories.filter((item) => item !== slug)
      : [...selectedCategories, slug]
    const nextFilters = { ...filters }
    if (next.length === 0) {
      delete nextFilters.category
    } else {
      nextFilters.category = next
    }
    onFiltersChange(nextFilters)
  }

  const toggleTempo = (slug: string) => {
    const next = selectedTempo.includes(slug)
      ? selectedTempo.filter((item) => item !== slug)
      : [...selectedTempo, slug]
    const nextFilters = { ...filters }
    const customFilters = { ...(nextFilters.custom_filters || {}) }
    if (next.length === 0) {
      delete customFilters['tempo-liturgico']
    } else {
      customFilters['tempo-liturgico'] = next
    }
    if (Object.keys(customFilters).length === 0) {
      delete nextFilters.custom_filters
    } else {
      nextFilters.custom_filters = customFilters
    }
    onFiltersChange(nextFilters)
  }

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Rail header */}
      <div className="shrink-0 px-4 pt-4 pb-2 border-b border-border space-y-3">
        {/* Workspace eyebrow + section title */}
        <div>
          {activeWorkspace && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
              {activeWorkspace.name}
            </p>
          )}
          <h2
            className="text-base font-normal tracking-wider uppercase"
            style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontVariant: 'small-caps' }}
          >
            {activeTab === 'musicas' ? 'Músicas' : 'Listas'}
          </h2>
        </div>

        {/* Search */}
        <div className="flex items-center gap-1">
          {activeTab === 'musicas' ? (
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar músicas…"
                className="h-8 pl-8 text-sm bg-background rounded-full"
              />
            </div>
          ) : (
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Buscar listas…"
                className="h-8 pl-8 text-sm bg-background rounded-full"
              />
            </div>
          )}
          {activeTab === 'musicas' && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden md:flex h-8 gap-2 px-2.5 shrink-0">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span className="text-xs">Filtros</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Filtros rápidos
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Categoria</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56 max-h-64 overflow-y-auto">
                      {isFilterLoading && <DropdownMenuItem disabled>Carregando…</DropdownMenuItem>}
                      {!isFilterLoading && filterOptions.categories.length === 0 && (
                        <DropdownMenuItem disabled>Nenhuma categoria</DropdownMenuItem>
                      )}
                      {filterOptions.categories.map((category) => (
                        <DropdownMenuCheckboxItem
                          key={category.slug}
                          checked={selectedCategories.includes(category.slug)}
                          onCheckedChange={() => toggleCategory(category.slug)}
                        >
                          {category.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  {filterOptions.tempoLiturgico.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>{filterOptions.tempoLabel}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56 max-h-64 overflow-y-auto">
                        {filterOptions.tempoLiturgico.map((tempo) => (
                          <DropdownMenuCheckboxItem
                            key={tempo.slug}
                            checked={selectedTempo.includes(tempo.slug)}
                            onCheckedChange={() => toggleTempo(tempo.slug)}
                          >
                            {tempo.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 md:hidden"
                onClick={onOpenFilters}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {activeTab === 'listas' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
              <Link href="/lists?action=create">
                <Plus className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>

        {/* Filter chips — musicas only */}
        {activeTab === 'musicas' && onSortChange && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {SORT_CHIPS.map((chip) => {
              const isActive = sortBy?.field === chip.field && sortBy?.order === chip.order
              return (
                <button
                  key={chip.label}
                  onClick={() => onSortChange({ field: chip.field, order: chip.order })}
                  className={cn(
                    'shrink-0 h-6 px-2.5 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
                  )}
                >
                  {chip.label}
                </button>
              )
            })}
            {musicPagination && (
              <span className="shrink-0 text-[10px] text-muted-foreground ml-auto">
                {musicPagination.total}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'musicas' ? (
          <MusicList
            musics={musics}
            isLoading={isLoadingMusics}
            selectedId={selectedMusicId}
            onSelect={onSelectMusic}
            pagination={musicPagination}
            hasMore={hasMore}
            isFetchingMore={isFetchingMore}
            onLoadMore={onLoadMore}
          />
        ) : (
          <ListsList
            lists={filteredLists}
            isLoading={isLoadingLists}
            selectedId={selectedListId}
            onSelect={onSelectList}
          />
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border">
        {/* Músicas / Listas toggle */}
        <div className="px-2 py-2">
          <div className="flex items-center bg-muted rounded-full p-1 gap-1">
            <button
              onClick={() => onRailTabChange('musicas')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 h-7 rounded-full text-xs font-medium transition-colors',
                activeTab === 'musicas'
                  ? 'bg-card text-foreground border border-border shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Music2 className="h-3 w-3" />
              Músicas
            </button>
            <button
              onClick={() => onRailTabChange('listas')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 h-7 rounded-full text-xs font-medium transition-colors',
                activeTab === 'listas'
                  ? 'bg-card text-foreground border border-border shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="h-3 w-3" />
              Listas
            </button>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2 px-2 pb-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 gap-2 h-8 text-xs">
                <Settings className="h-3.5 w-3.5" />
                Configurações
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Configurações</DialogTitle>
                <DialogDescription>Personalize o tema da interface.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Tema</p>
                  <p className="text-xs text-muted-foreground">
                    Escolha o modo claro, escuro ou siga o sistema.
                  </p>
                  <div className="flex items-center bg-muted rounded-full p-1 gap-1">
                    {(['light', 'dark', 'system'] as ThemeMode[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={themeMode === value}
                        onClick={() => setThemeMode(value)}
                        className={cn(
                          'flex-1 h-8 rounded-full text-xs font-medium transition-colors',
                          themeMode === value
                            ? 'bg-card text-foreground border border-border shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {value === 'light' ? 'Claro' : value === 'dark' ? 'Escuro' : 'Sistema'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          {!isAuthenticated && (
            <Button size="sm" className="flex-1 gap-2 h-8 text-xs" onClick={onOpenLogin}>
              <LogIn className="h-3.5 w-3.5" />
              Entrar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Music list ────────────────────────────────────────────────────────────────

function MusicList({
  musics,
  isLoading,
  selectedId,
  onSelect,
  pagination,
  hasMore,
  isFetchingMore,
  onLoadMore,
}: {
  musics: MusicFile[]
  isLoading: boolean
  selectedId: number | null
  onSelect: (id: number) => void
  pagination?: { page: number; limit: number; total: number; pages: number }
  hasMore?: boolean
  isFetchingMore?: boolean
  onLoadMore?: () => void
}) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  
  // Pull to refresh functionality
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      // Trigger a refresh by calling onLoadMore and resetting the list
      // In practice, this would trigger a refetch of the first page
      window.location.reload()
    },
    disabled: isLoading || isFetchingMore
  })

  useEffect(() => {
    if (!hasMore || !onLoadMore) return
    const element = loadMoreRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingMore) {
          onLoadMore()
        }
      },
      { root: null, rootMargin: '200px' }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [hasMore, isFetchingMore, onLoadMore])

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-0">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="px-3 py-2.5 border-b border-border/40 space-y-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          ))}
        </div>
      </ScrollArea>
    )
  }

  if (!musics.length) {
    return (
      <div className="p-6">
        <EmptyState title="Nenhuma música" description="Tente ajustar os filtros" />
      </div>
    )
  }

  return (
    <ScrollArea 
      className="h-full" 
      ref={(el) => pullToRefresh.attachToElement(el?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement)}
    >
      <PullToRefreshIndicator 
        isPulling={pullToRefresh.isPulling}
        canRefresh={pullToRefresh.canRefresh}
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        style={pullToRefresh.pullIndicatorStyle}
        className="border-b border-border/30"
      />
      <div>
        {musics.map((music, index) => {
          const isSelected = music.id === selectedId
          const title = music.title || music.original_name
          const num = index + 1

          return (
            <button
              key={music.id}
              onClick={() => onSelect(music.id)}
              className={cn(
                'w-full text-left px-3 py-2 flex items-start gap-2 border-b border-border/30 transition-colors',
                'hover:bg-accent focus-visible:outline-none focus-visible:bg-accent focus-visible:ring-1 focus-visible:ring-border/80',
                isSelected && 'border-l-2 pl-[10px]'
              )}
              style={isSelected ? {
                background: 'color-mix(in srgb, hsl(var(--chord-accent)) 10%, transparent)',
                borderLeftColor: 'hsl(var(--chord-accent))',
              } : undefined}
            >
              {/* Number */}
              <span className="text-[10px] font-mono text-muted-foreground/60 w-7 shrink-0 pt-0.5 text-right leading-tight">
                {String(num).padStart(3, '0')}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <span className={cn('text-[13px] font-medium leading-snug truncate', isSelected && 'text-foreground')}>
                    {title}
                  </span>
                  {music.musical_key && (
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0 h-4 px-1 font-mono leading-none border-border/50 mt-0.5"
                    >
                      {music.musical_key}
                    </Badge>
                  )}
                </div>
                {music.artist && (
                  <span className="text-[11px] text-muted-foreground truncate block mt-0.5 leading-tight">
                    {music.artist}
                  </span>
                )}
              </div>

              {/* Type icon */}
              <div className="mt-0.5 shrink-0">
                <MusicTypeIcon contentType={music.content_type} />
              </div>
            </button>
          )
        })}
      </div>
      <div ref={loadMoreRef} className="h-10" />
      {isFetchingMore && (
        <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando mais músicas…
        </div>
      )}
      {!hasMore && musics.length > 0 && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground">
          Fim da lista
        </div>
      )}
    </ScrollArea>
  )
}

// ── Lists list ────────────────────────────────────────────────────────────────

function ListsList({
  lists,
  isLoading,
  selectedId,
  onSelect,
}: {
  lists: MusicList[]
  isLoading: boolean
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  // Pull to refresh functionality
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      // Trigger a refresh of the lists
      window.location.reload()
    },
    disabled: isLoading
  })
  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-3 py-2.5 border-b border-border/40 space-y-1">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        ))}
      </ScrollArea>
    )
  }

  if (!lists.length) {
    return (
      <div className="p-6">
        <EmptyState
          title="Nenhuma lista"
          description="Crie sua primeira lista"
          action={{ label: 'Ir para Listas', onClick: () => window.location.assign('/lists') }}
        />
      </div>
    )
  }

  return (
    <ScrollArea 
      className="h-full" 
      ref={(el) => pullToRefresh.attachToElement(el?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement)}
    >
      <PullToRefreshIndicator 
        isPulling={pullToRefresh.isPulling}
        canRefresh={pullToRefresh.canRefresh}
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        style={pullToRefresh.pullIndicatorStyle}
        className="border-b border-border/30"
      />
      <div>
        {lists.map((list) => {
          const isSelected = list.id === selectedId
          const dateStr = list.updated_date
            ? new Date(list.updated_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
            : ''

          return (
            <button
              key={list.id}
              onClick={() => onSelect(list.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 flex items-center gap-2 border-b border-border/30 transition-colors',
                'hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border/80',
                isSelected && 'bg-muted border-l-2 border-l-foreground pl-[10px]'
              )}
            >
              <List className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[13px] font-medium truncate">{list.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                    {list.file_count ?? 0}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">{dateStr}</span>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            </button>
          )
        })}
      </div>
      <div className="p-3 border-t border-border/50">
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" asChild>
          <Link href="/lists">
            <List className="h-3 w-3" />
            Gerenciar todas as listas
          </Link>
        </Button>
      </div>
    </ScrollArea>
  )
}
