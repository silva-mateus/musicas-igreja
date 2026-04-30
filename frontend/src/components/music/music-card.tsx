'use client'

import { Badge } from '@core/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@core/components/ui/dropdown-menu'
import { AddToListModal } from './add-to-list-modal'
import { TouchTarget } from '@/components/ui/touch-target'
import type { MusicFile } from '@/types'
import {
    Eye,
    Download,
    Edit,
    Youtube,
    ListPlus,
    MoreHorizontal,
    Music2,
    FileText,
    Loader
} from 'lucide-react'
import { useAuth } from '@core/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useSwipe } from '@/hooks/use-swipe'
import { hapticFeedback } from '@/lib/haptic-feedback'

interface MusicCardProps {
    music: MusicFile
    onMusicUpdate: () => void
}

export function MusicCard({ music, onMusicUpdate }: MusicCardProps) {
    const router = useRouter()
    const { hasPermission } = useAuth()
    const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')
    const canManageLists = hasPermission('lists:manage')
    
    // Swipe gestures
    const swipeHandlers = useSwipe({
        onSwipeRight: () => {
            // Quick action: View music
            hapticFeedback('medium')
            window.open(`/music/${music.id}`, '_blank')
        },
        onSwipeLeft: () => {
            // Quick action: Edit music (if allowed)
            if (canEdit) {
                hapticFeedback('medium')
                router.push(`/music/${music.id}/edit`)
            }
        }
    }, {
        threshold: 100, // Require longer swipe to prevent accidental actions
        preventDefaultTouchmove: false
    })

    const handleView = () => {
        window.open(`/music/${music.id}`, '_blank')
    }

    const handleEdit = () => {
        router.push(`/music/${music.id}/edit`)
    }

    const handleDownload = () => {
        const link = document.createElement('a')
        link.href = `/api/files/${music.id}/download`
        link.download = music.original_name || music.filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const getContentTypeIcon = (contentType?: string) => {
        if (contentType === 'chord') return <Music2 className="w-4 h-4 text-blue-600" />
        if (contentType === 'chord_converting') return <Loader className="w-4 h-4 text-yellow-600 animate-spin" />
        return <FileText className="w-4 h-4 text-red-600" />
    }

    return (
        <div
            className="bg-card border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={handleView}
            {...swipeHandlers}
        >
            {/* Header: Title + Action Menu */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2 mb-1">
                        {getContentTypeIcon(music.content_type)}
                        <h3 className="font-medium text-sm leading-tight line-clamp-2">
                            {music.title || music.original_name}
                        </h3>
                    </div>
                    {music.artist && (
                        <p className="text-xs text-muted-foreground truncate">
                            {music.artist}
                        </p>
                    )}
                </div>

                {/* Action Menu */}
                <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <TouchTarget
                                variant="icon"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Abrir menu</span>
                            </TouchTarget>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={handleView}>
                                <Eye className="mr-2 h-4 w-4" />
                                Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDownload}>
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </DropdownMenuItem>
                            {music.youtube_link ? (
                                <DropdownMenuItem asChild>
                                    <a
                                        href={music.youtube_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center text-destructive"
                                    >
                                        <Youtube className="mr-2 h-4 w-4" />
                                        Ver no YouTube
                                    </a>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem disabled className="text-muted-foreground">
                                    <Youtube className="mr-2 h-4 w-4" />
                                    Sem YouTube
                                </DropdownMenuItem>
                            )}
                            {canManageLists && (
                                <>
                                    <DropdownMenuSeparator />
                                    <AddToListModal
                                        musicId={music.id}
                                        musicTitle={music.title || music.original_name}
                                        onSuccess={onMusicUpdate}
                                        trigger={
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                <ListPlus className="mr-2 h-4 w-4" />
                                                Adicionar à Lista
                                            </DropdownMenuItem>
                                        }
                                    />
                                </>
                            )}
                            {canEdit && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleEdit}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Editar
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Metadata: Key, Categories, Custom Filters */}
            <div className="space-y-2">
                {/* Musical Key */}
                {music.musical_key && (
                    <div>
                        <Badge variant="outline" className="text-xs">
                            Tom: {music.musical_key}
                        </Badge>
                    </div>
                )}

                {/* Categories */}
                {(music.categories && music.categories.length > 0) || music.category ? (
                    <div className="flex flex-wrap gap-1">
                        {music.categories && music.categories.length > 0
                            ? music.categories.map((cat, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                    {cat}
                                </Badge>
                            ))
                            : music.category && (
                                <Badge variant="secondary" className="text-xs">
                                    {music.category}
                                </Badge>
                            )
                        }
                    </div>
                ) : null}

                {/* Custom Filters */}
                {music.custom_filters && Object.keys(music.custom_filters).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {Object.entries(music.custom_filters).flatMap(([slug, group]) =>
                            group.values.map((val, idx) => (
                                <Badge key={`${slug}-${idx}`} variant="outline" className="text-xs">
                                    {val}
                                </Badge>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}