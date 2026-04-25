'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Music2,
  FileText,
  Loader2,
  SlidersHorizontal,
  RefreshCw,
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
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { MusicFile, MusicList } from '@/types'
import { useAuth } from '@core/contexts/auth-context'
import { useWorkspace } from '@/contexts/workspace-context'

function MusicTypeIcon({ contentType }: { contentType?: string }) {
  if (contentType === 'chord') return <Music2 className="w-3 h-3 shrink-0 text-[hsl(var(--chord-accent))]" />
  if (contentType === 'chord_converting') return <Loader2 className="w-3 h-3 shrink-0 text-muted-foreground animate-spin" />
  return <FileText className="w-3 h-3 shrink-0 text-muted-foreground" />
}

interface LibraryRailProps {
  // Music data
  musics: MusicFile[]
  isLoadingMusics: boolean
  selectedMusicId: number | null
  onSelectMusic: (id: number) => void
  musicPagination?: { page: number; limit: number; total: number; pages: number }
  onMusicPageChange: (page: number) => void
  // Search / filter
  searchValue: string
  onSearchChange: (value: string) => void
  onOpenFilters: () => void
  onRefresh: () => void
  // Sort chips
  sortBy?: { field: string; order: 'asc' | 'desc' }
  onSortChange?: (sort: { field: string; order: 'asc' | 'desc' }) => void
  // Lists data
  lists: MusicList[]
  isLoadingLists: boolean
  selectedListId: number | null
  onSelectList: (id: number) => void
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
  selectedMusicId,
  onSelectMusic,
  musicPagination,
  onMusicPageChange,
  searchValue,
  onSearchChange,
  onOpenFilters,
  onRefresh,
  sortBy,
  onSortChange,
  lists,
  isLoadingLists,
  selectedListId,
  onSelectList,
  onOpenLogin,
}: LibraryRailProps) {
  const [activeTab, setActiveTab] = useState<RailTab>('musicas')
  const [listSearch, setListSearch] = useState('')
  const { isAuthenticated } = useAuth()
  const { activeWorkspace } = useWorkspace()

  const filteredLists = useMemo(() => {
    if (!listSearch) return lists
    const lower = listSearch.toLowerCase()
    return lists.filter((l) => l.name.toLowerCase().includes(lower))
  }, [lists, listSearch])

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
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onOpenFilters}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onRefresh}>
                <RefreshCw className="h-3.5 w-3.5" />
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
            onPageChange={onMusicPageChange}
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
        <div className="flex p-1.5 gap-1">
          <button
            onClick={() => setActiveTab('musicas')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-xs font-medium transition-colors',
              activeTab === 'musicas'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Music2 className="h-3 w-3" />
            Músicas
          </button>
          <button
            onClick={() => setActiveTab('listas')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-xs font-medium transition-colors',
              activeTab === 'listas'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <List className="h-3 w-3" />
            Listas
          </button>
        </div>

        {/* Actions row */}
        <div className="flex items-center px-1.5 pb-1.5 gap-1">
          <Button variant="ghost" size="sm" className="flex-1 gap-1.5 h-7 text-xs justify-start" asChild>
            <Link href="/settings">
              <Settings className="h-3 w-3" />
              Configurações
            </Link>
          </Button>
          {!isAuthenticated && (
            <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={onOpenLogin}>
              <LogIn className="h-3 w-3" />
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
  onPageChange,
}: {
  musics: MusicFile[]
  isLoading: boolean
  selectedId: number | null
  onSelect: (id: number) => void
  pagination?: { page: number; limit: number; total: number; pages: number }
  onPageChange: (page: number) => void
}) {
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
    <ScrollArea className="h-full">
      <div>
        {musics.map((music, index) => {
          const isSelected = music.id === selectedId
          const title = music.title || music.original_name
          const num = (pagination ? (pagination.page - 1) * pagination.limit : 0) + index + 1

          return (
            <button
              key={music.id}
              onClick={() => onSelect(music.id)}
              className={cn(
                'w-full text-left px-3 py-2 flex items-start gap-2 border-b border-border/30 transition-colors',
                'hover:bg-accent focus-visible:outline-none focus-visible:bg-accent',
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

      {pagination && pagination.pages > 1 && (
        <div className="p-2 border-t border-border">
          <Pagination
            page={pagination.page}
            pages={pagination.pages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={onPageChange}
            itemLabel="música"
          />
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
  const router = useRouter()

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
          action={{ label: 'Ir para Listas', onClick: () => router.push('/lists') }}
        />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div>
        {lists.map((list) => {
          const isSelected = list.id === selectedId
          const dateStr = list.updated_date
            ? new Date(list.updated_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
            : ''

          return (
            <button
              key={list.id}
              onClick={() => {
                onSelect(list.id)
                router.push(`/lists/${list.id}`)
              }}
              className={cn(
                'w-full text-left px-3 py-2.5 flex items-center gap-2 border-b border-border/30 transition-colors',
                'hover:bg-accent focus-visible:outline-none',
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
