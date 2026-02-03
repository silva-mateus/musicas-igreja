'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { SearchFilters } from '@/types'
import { 
    ChevronDown, 
    ChevronRight, 
    Music, 
    User, 
    FolderOpen, 
    Clock, 
    Download,
    Eye,
    Edit,
    Youtube,
    Filter,
    ListPlus,
    MoreHorizontal
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { musicApi, downloadFile } from '@/lib/api'
import { AddToListModal } from './add-to-list-modal'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Loader2 } from 'lucide-react'

interface GroupedFile {
    id: number
    filename: string
    song_name: string | null
    artist?: string | null
    musical_key?: string | null
    category?: string
    categories?: string[]
    liturgical_time?: string
    liturgical_times?: string[]
    youtube_link?: string | null
}

interface MusicGroup {
    artist?: string
    category?: string
    liturgical_time?: string
    count: number
    files: GroupedFile[]
}

interface MusicGroupedViewProps {
    groupType: 'artist' | 'category' | 'liturgical-time'
    groups: MusicGroup[]
    isLoading: boolean
    error: string | null
    onRefresh: () => void
    filters?: SearchFilters
}

export function MusicGroupedView({ 
    groupType, 
    groups, 
    isLoading, 
    error, 
    onRefresh,
    filters = {}
}: MusicGroupedViewProps) {
    const router = useRouter()
    const { canDownloadMusic, canEdit, canManageLists } = useAuth()
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
    const [downloadingId, setDownloadingId] = useState<number | null>(null)

    // Filter groups based on external filters
    const filteredGroups = useMemo(() => {
        return groups.map(group => {
            const filteredFiles = group.files.filter(file => {
                // Title/search filter
                if (filters.title) {
                    const searchLower = filters.title.toLowerCase()
                    const matchesSearch = 
                        (file.song_name?.toLowerCase().includes(searchLower)) ||
                        (file.filename.toLowerCase().includes(searchLower)) ||
                        (file.artist?.toLowerCase().includes(searchLower))
                    if (!matchesSearch) return false
                }

                // Artist filter
                if (filters.artist) {
                    if (file.artist !== filters.artist) return false
                }

                // Category filter
                if (filters.category) {
                    const hasCategory = 
                        (file.categories?.includes(filters.category)) ||
                        (file.category === filters.category)
                    if (!hasCategory) return false
                }

                // Liturgical time filter
                if (filters.liturgical_time) {
                    const hasTime = 
                        (file.liturgical_times?.includes(filters.liturgical_time)) ||
                        (file.liturgical_time === filters.liturgical_time)
                    if (!hasTime) return false
                }

                // Musical key filter
                if (filters.musical_key) {
                    if (file.musical_key !== filters.musical_key) return false
                }

                // YouTube filter
                if (filters.has_youtube !== undefined) {
                    const hasYoutube = !!file.youtube_link
                    if (filters.has_youtube !== hasYoutube) return false
                }

                return true
            })

            return {
                ...group,
                files: filteredFiles,
                count: filteredFiles.length
            }
        }).filter(group => group.files.length > 0)
    }, [groups, filters])

    const hasActiveFilters = Object.keys(filters).some(k => {
        const val = filters[k as keyof SearchFilters]
        return val !== undefined && val !== null && val !== ''
    })

    const toggleGroup = (groupName: string) => {
        setOpenGroups(prev => {
            const newSet = new Set(prev)
            if (newSet.has(groupName)) {
                newSet.delete(groupName)
            } else {
                newSet.add(groupName)
            }
            return newSet
        })
    }

    const expandAll = () => {
        const allNames = filteredGroups.map(g => getGroupName(g))
        setOpenGroups(new Set(allNames))
    }

    const collapseAll = () => {
        setOpenGroups(new Set())
    }

    const getGroupName = (group: MusicGroup): string => {
        return group.artist || group.category || group.liturgical_time || 'Sem Nome'
    }

    const getGroupIcon = () => {
        switch (groupType) {
            case 'artist':
                return <User className="h-4 w-4" />
            case 'category':
                return <FolderOpen className="h-4 w-4" />
            case 'liturgical-time':
                return <Clock className="h-4 w-4" />
        }
    }

    const getGroupLabel = () => {
        switch (groupType) {
            case 'artist':
                return 'artistas'
            case 'category':
                return 'categorias'
            case 'liturgical-time':
                return 'tempos litúrgicos'
        }
    }

    const handleDownload = async (file: GroupedFile) => {
        try {
            setDownloadingId(file.id)
            const blob = await musicApi.downloadMusic(file.id)
            downloadFile(blob, file.filename)
        } catch (error) {
            console.error('Download failed:', error)
        } finally {
            setDownloadingId(null)
        }
    }

    if (isLoading) {
        return <LoadingSpinner message="Carregando músicas..." />
    }

    if (error) {
        return <ErrorState message={error} onRetry={onRefresh} />
    }

    if (groups.length === 0) {
        return <EmptyState icon={Music} title="Nenhum grupo encontrado" description="Não há músicas para agrupar." />
    }

    const totalFiltered = filteredGroups.reduce((acc, g) => acc + g.count, 0)

    return (
        <div className="space-y-4">
            {/* Header with stats and controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                    {hasActiveFilters ? (
                        <>
                            {filteredGroups.length} {getGroupLabel()} • {totalFiltered} música{totalFiltered !== 1 ? 's' : ''}
                            <span className="text-primary ml-1">(filtrado)</span>
                        </>
                    ) : (
                        <>{filteredGroups.length} {getGroupLabel()} encontrados</>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={expandAll}>
                        Expandir todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={collapseAll}>
                        Recolher todos
                    </Button>
                </div>
            </div>

            {/* Groups list */}
            {filteredGroups.length === 0 ? (
                <EmptyState 
                    icon={Filter} 
                    title="Nenhum resultado" 
                    description="Nenhuma música corresponde aos filtros selecionados."
                />
            ) : (
                <div className="space-y-3">
                    {filteredGroups.map((group) => {
                        const groupName = getGroupName(group)
                        const isOpen = openGroups.has(groupName)

                        return (
                            <Collapsible key={groupName} open={isOpen} onOpenChange={() => toggleGroup(groupName)}>
                                <Card className="overflow-hidden">
                                    <CollapsibleTrigger asChild>
                                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                                            <CardTitle className="flex items-center justify-between text-base">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-full bg-primary/10">
                                                        {isOpen ? (
                                                            <ChevronDown className="h-4 w-4 text-primary" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4 text-primary" />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {getGroupIcon()}
                                                        <span className="font-semibold">{groupName}</span>
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className="text-sm">
                                                    {group.count} música{group.count !== 1 ? 's' : ''}
                                                </Badge>
                                            </CardTitle>
                                        </CardHeader>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <CardContent className="pt-0 pb-4">
                                            <div className="space-y-2">
                                                {group.files.map((file) => (
                                                    <div
                                                        key={file.id}
                                                        className="group flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                                                    >
                                                        <div className="p-2 rounded-lg bg-primary/5 group-hover:bg-primary/10 transition-colors">
                                                            <FileText className="h-5 w-5 text-primary" />
                                                        </div>
                                                        
                                                        <div className="flex-1 min-w-0">
                                                            <Link 
                                                                href={`/music/${file.id}`}
                                                                className="font-medium hover:text-primary transition-colors line-clamp-1"
                                                            >
                                                                {file.song_name || file.filename}
                                                            </Link>
                                                            
                                                            {/* Metadata row */}
                                                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                                {/* Artist (if not grouped by artist) */}
                                                                {groupType !== 'artist' && file.artist && (
                                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                        <User className="h-3 w-3" />
                                                                        <span>{file.artist}</span>
                                                                    </div>
                                                                )}
                                                                
                                                                {/* Musical key */}
                                                                {file.musical_key && (
                                                                    <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                                                                        🎵 {file.musical_key}
                                                                    </Badge>
                                                                )}
                                                                
                                                                {/* Categories (if not grouped by category) */}
                                                                {groupType !== 'category' && (file.categories?.length || file.category) && (
                                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                        <FolderOpen className="h-3 w-3" />
                                                                        <span>
                                                                            {file.categories?.join(', ') || file.category}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                
                                                                {/* Liturgical times (if not grouped by liturgical time) */}
                                                                {groupType !== 'liturgical-time' && (file.liturgical_times?.length || file.liturgical_time) && (
                                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                        <Clock className="h-3 w-3" />
                                                                        <span>
                                                                            {file.liturgical_times?.join(', ') || file.liturgical_time}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Desktop Action buttons */}
                                                        <div className="hidden sm:flex items-center gap-1 shrink-0">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8"
                                                                            asChild
                                                                        >
                                                                            <Link href={`/music/${file.id}`}>
                                                                                <Eye className="h-4 w-4" />
                                                                            </Link>
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Visualizar</TooltipContent>
                                                                </Tooltip>
                                                                
                                                                {canDownloadMusic && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8"
                                                                                onClick={() => handleDownload(file)}
                                                                                disabled={downloadingId === file.id}
                                                                            >
                                                                                {downloadingId === file.id ? (
                                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                                ) : (
                                                                                    <Download className="h-4 w-4" />
                                                                                )}
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Baixar PDF</TooltipContent>
                                                                    </Tooltip>
                                                                )}

                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        {file.youtube_link ? (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                                                asChild
                                                                            >
                                                                                <a 
                                                                                    href={file.youtube_link} 
                                                                                    target="_blank" 
                                                                                    rel="noopener noreferrer"
                                                                                >
                                                                                    <Youtube className="h-4 w-4" />
                                                                                </a>
                                                                            </Button>
                                                                        ) : (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8"
                                                                                disabled
                                                                            >
                                                                                <Youtube className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        {file.youtube_link ? 'Abrir no YouTube' : 'Sem link do YouTube'}
                                                                    </TooltipContent>
                                                                </Tooltip>

                                                                {canManageLists && (
                                                                    <AddToListModal
                                                                        musicId={file.id}
                                                                        musicTitle={file.song_name || file.filename}
                                                                        onSuccess={onRefresh}
                                                                    />
                                                                )}

                                                                {canEdit && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8"
                                                                                asChild
                                                                            >
                                                                                <Link href={`/music/${file.id}/edit`}>
                                                                                    <Edit className="h-4 w-4" />
                                                                                </Link>
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Editar</TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                            </TooltipProvider>
                                                        </div>

                                                        {/* Mobile Actions - Dropdown */}
                                                        <div className="sm:hidden">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-48">
                                                                    <DropdownMenuItem asChild>
                                                                        <Link href={`/music/${file.id}`} className="flex items-center">
                                                                            <Eye className="mr-2 h-4 w-4" />
                                                                            Visualizar
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                    {canDownloadMusic && (
                                                                        <DropdownMenuItem 
                                                                            onClick={() => handleDownload(file)}
                                                                            disabled={downloadingId === file.id}
                                                                        >
                                                                            <Download className="mr-2 h-4 w-4" />
                                                                            Download
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {file.youtube_link ? (
                                                                        <DropdownMenuItem asChild>
                                                                            <a
                                                                                href={file.youtube_link}
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
                                                                                musicId={file.id}
                                                                                musicTitle={file.song_name || file.filename}
                                                                                onSuccess={onRefresh}
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
                                                                            <DropdownMenuItem asChild>
                                                                                <Link href={`/music/${file.id}/edit`} className="flex items-center">
                                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                                    Editar
                                                                                </Link>
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
