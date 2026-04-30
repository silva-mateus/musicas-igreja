'use client'

import Link from 'next/link'
import { ExternalLink, List, Loader2, Music2 } from 'lucide-react'
import { Button } from '@core/components/ui/button'
import { Badge } from '@core/components/ui/badge'
import { ScrollArea } from '@core/components/ui/scroll-area'
import { Skeleton } from '@core/components/ui/skeleton'
import { useListDetail } from '@/hooks/use-lists'
import type { MusicListItem } from '@/types'

interface ListPanelViewerProps {
    listId: number
}

export function ListPanelViewer({ listId }: ListPanelViewerProps) {
    const { data: list, isLoading, error } = useListDetail(listId)

    if (isLoading) {
        return (
            <div className="flex flex-col h-full p-6 gap-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <div className="space-y-2 mt-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                    ))}
                </div>
            </div>
        )
    }

    if (error || !list) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <List className="h-14 w-14 opacity-15" />
                <p className="text-sm">Lista não encontrada</p>
            </div>
        )
    }

    const items = list.items ?? []

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-border flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <List className="h-4 w-4 text-muted-foreground shrink-0" />
                        <h2 className="text-base font-semibold truncate">{list.name}</h2>
                        <Badge variant="outline" className="text-xs shrink-0">
                            {items.length} música{items.length !== 1 ? 's' : ''}
                        </Badge>
                    </div>
                    {list.observations && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{list.observations}</p>
                    )}
                </div>
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs" asChild>
                    <Link href={`/lists/${listId}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir
                    </Link>
                </Button>
            </div>

            {/* Music list */}
            <ScrollArea className="flex-1 min-h-0">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                        <Music2 className="h-10 w-10 opacity-20" />
                        <p className="text-sm">Lista vazia</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/50">
                        {(items as MusicListItem[]).map((item, index) => {
                            const music = item.music
                            const title = music?.title ?? music?.original_name ?? `#${item.music_id}`
                            const key = item.key_override ?? music?.musical_key
                            return (
                                <div key={item.id} className="flex items-center gap-3 px-6 py-2.5">
                                    <span className="text-[11px] font-mono text-muted-foreground/50 w-7 shrink-0 text-right">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <Link
                                            href={`/music/${item.music_id}`}
                                            className="text-[13px] font-medium hover:underline truncate block"
                                        >
                                            {title}
                                        </Link>
                                        {music?.artist && (
                                            <span className="text-[11px] text-muted-foreground truncate block">
                                                {music.artist}
                                            </span>
                                        )}
                                    </div>
                                    {key && (
                                        <Badge variant="outline" className="text-[10px] shrink-0 h-4 px-1 font-mono">
                                            {key}
                                        </Badge>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}
