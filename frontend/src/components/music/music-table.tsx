'use client'

import { Button } from '@core/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@core/components/ui/table'
import { Badge } from '@core/components/ui/badge'
import { Skeleton } from '@core/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@core/components/ui/dropdown-menu'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import type { MusicFile } from '@/types'
import {
    Eye,
    Download,
    Edit,
    Youtube,
    ListPlus,
    MoreHorizontal,
    Music2,
    User,
    Hash,
    FolderOpen,
    Calendar
} from 'lucide-react'
import { useAuth } from '@core/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { AddToListModal } from './add-to-list-modal'

interface MusicTableProps {
    musics: MusicFile[]
    isLoading: boolean
    pagination?: {
        page: number
        limit: number
        total: number
        pages: number
    }
    onPageChange: (page: number) => void
    onMusicUpdate: () => void
}

export function MusicTable({
    musics,
    isLoading,
    pagination,
    onPageChange,
    onMusicUpdate
}: MusicTableProps) {
    const router = useRouter()
    const { hasPermission } = useAuth()
    const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')
    const canManageLists = hasPermission('lists:manage')

    const handleView = (music: MusicFile) => {
        window.open(`/music/${music.id}`, '_blank')
    }

    const handleRowClick = (e: React.MouseEvent, music: MusicFile) => {
        if ((e.target as HTMLElement).closest('button, a, [role="menuitem"], [data-radix-collection-item]')) return
        window.open(`/music/${music.id}`, '_blank')
    }

    const handleEdit = (music: MusicFile) => {
        router.push(`/music/${music.id}/edit`)
    }

    const handleDownload = (music: MusicFile) => {
        const link = document.createElement('a')
        link.href = `/api/files/${music.id}/download`
        link.download = music.original_name || music.filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[180px] max-w-[320px]">
                                    <div className="flex items-center gap-2">
                                        <Music2 className="h-4 w-4" />
                                        <span>Título</span>
                                    </div>
                                </TableHead>
                                <TableHead className="min-w-[140px] max-w-[240px]">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        <span>Artista</span>
                                    </div>
                                </TableHead>
                                <TableHead className="hidden sm:table-cell w-16">
                                    <div className="flex items-center gap-2">
                                        <Hash className="h-4 w-4" />
                                        <span>Tom</span>
                                    </div>
                                </TableHead>
                                <TableHead className="hidden md:table-cell min-w-[140px] max-w-[240px]">
                                    <div className="flex items-center gap-2">
                                        <FolderOpen className="h-4 w-4" />
                                        <span>Categoria</span>
                                    </div>
                                </TableHead>
                                <TableHead className="hidden lg:table-cell min-w-[140px] max-w-[220px]">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        <span>Tempo</span>
                                    </div>
                                </TableHead>
                                <TableHead className="w-24">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        )
    }

    if (musics.length === 0) {
        return (
            <EmptyState
                title="Nenhuma música encontrada"
                description="Tente ajustar os filtros ou adicionar novas músicas ao sistema."
            />
        )
    }

    return (
        <div className="space-y-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="min-w-[180px] max-w-[320px]">
                            <div className="flex items-center gap-2">
                                <Music2 className="h-4 w-4" />
                                <span>Título</span>
                            </div>
                        </TableHead>
                        <TableHead className="min-w-[140px] max-w-[240px]">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span>Artista</span>
                            </div>
                        </TableHead>
                        <TableHead className="hidden sm:table-cell w-16">
                            <div className="flex items-center gap-2">
                                <Hash className="h-4 w-4" />
                                <span>Tom</span>
                            </div>
                        </TableHead>
                        <TableHead className="hidden md:table-cell min-w-[140px] max-w-[240px]">
                            <div className="flex items-center gap-2">
                                <FolderOpen className="h-4 w-4" />
                                <span>Categoria</span>
                            </div>
                        </TableHead>
                        <TableHead className="hidden lg:table-cell min-w-[140px] max-w-[220px]">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>Tempo</span>
                            </div>
                        </TableHead>
                        <TableHead className="text-right w-24">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {musics.map((music) => (
                        <TableRow
                            key={music.id}
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={(e) => handleRowClick(e, music)}
                        >
                            <TableCell className="font-medium min-w-[180px] max-w-[320px] md:max-w-[420px]">
                                <div>
                                    <div className="font-medium line-clamp-2">
                                        {music.title || music.original_name}
                                    </div>

                                    {/* Mobile: show key, categories and times below title */}
                                    <div className="sm:hidden mt-2">
                                        <div className="flex flex-wrap gap-1">
                                            {music.musical_key && (
                                                <Badge variant="outline" className="text-xs">
                                                    {music.musical_key}
                                                </Badge>
                                            )}

                                            {music.categories && music.categories.length > 0
                                                ? music.categories.map((cat, idx) => (
                                                    <Badge key={idx} variant="secondary" className="text-xs">
                                                        {cat}
                                                    </Badge>
                                                ))
                                                : music.category && (
                                                    <Badge variant="secondary" className="text-xs">{music.category}</Badge>
                                                )
                                            }

                                            {music.custom_filters && Object.entries(music.custom_filters).map(([slug, group]) =>
                                                group.values.map((val, idx) => (
                                                    <Badge key={`${slug}-${idx}`} variant="outline" className="text-xs">
                                                        {val}
                                                    </Badge>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="min-w-[140px] max-w-[240px]">
                                {music.artist ? (
                                    <span className="truncate">{music.artist}</span>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell w-16">
                                {music.musical_key ? (
                                    <Badge variant="outline" className="text-xs">
                                        {music.musical_key}
                                    </Badge>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell min-w-[140px] max-w-[240px]">
                                {music.categories && music.categories.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {music.categories.map((cat, idx) => (
                                            <Badge key={idx} variant="secondary" className="text-xs">
                                                {cat}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : music.category ? (
                                    <Badge variant="secondary">{music.category}</Badge>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell min-w-[140px] max-w-[220px]">
                                {music.custom_filters && Object.keys(music.custom_filters).length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {Object.entries(music.custom_filters).flatMap(([slug, group]) =>
                                            group.values.map((val, idx) => (
                                                <Badge key={`${slug}-${idx}`} variant="outline" className="text-xs">
                                                    {val}
                                                </Badge>
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right w-24">
                                {/* Desktop Actions */}
                                <div className="hidden sm:flex justify-end gap-1">
                                    <SimpleTooltip label="Visualizar">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleView(music)}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </SimpleTooltip>
                                    <SimpleTooltip label="Download">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDownload(music)}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </SimpleTooltip>
                                    {music.youtube_link ? (
                                        <SimpleTooltip label="Ver no YouTube">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <a
                                                    href={music.youtube_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <Youtube className="h-4 w-4" />
                                                </a>
                                            </Button>
                                        </SimpleTooltip>
                                    ) : (
                                        <SimpleTooltip label="Sem link do YouTube">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled
                                                className="text-muted-foreground"
                                            >
                                                <Youtube className="h-4 w-4" />
                                            </Button>
                                        </SimpleTooltip>
                                    )}
                                    {canManageLists && (
                                        <AddToListModal
                                            musicId={music.id}
                                            musicTitle={music.title || music.original_name}
                                            onSuccess={onMusicUpdate}
                                        />
                                    )}
                                    {canEdit && (
                                        <SimpleTooltip label="Editar">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(music)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </SimpleTooltip>
                                    )}
                                </div>

                                {/* Mobile Actions - Dropdown */}
                                <div className="sm:hidden">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Abrir menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem onClick={() => handleView(music)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Visualizar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDownload(music)}>
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
                                                    <DropdownMenuItem onClick={() => handleEdit(music)}>
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {pagination && (
                <Pagination
                    page={pagination.page}
                    pages={pagination.pages}
                    total={pagination.total}
                    limit={pagination.limit}
                    onPageChange={onPageChange}
                    itemLabel="música"
                />
            )}
        </div>
    )
}
