'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import type { MusicFile } from '@/types'
import {
    Eye,
    Download,
    Edit,
    Youtube,
    Calendar,
    User,
    Music2,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    ListPlus,
    MoreHorizontal
} from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
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
    onSortChange: (sortBy: string, order: 'asc' | 'desc') => void
    onMusicUpdate: () => void
}

interface SortState {
    field: string
    order: 'asc' | 'desc'
}

export function MusicTable({
    musics,
    isLoading,
    pagination,
    onPageChange,
    onSortChange,
    onMusicUpdate
}: MusicTableProps) {
    const router = useRouter()
    const [sortState, setSortState] = useState<SortState>({ field: 'upload_date', order: 'desc' })
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const handleSort = (field: string) => {
        const newOrder = sortState.field === field && sortState.order === 'asc' ? 'desc' : 'asc'
        setSortState({ field, order: newOrder })
        onSortChange(field, newOrder)
    }

    const getSortIcon = (field: string) => {
        if (sortState.field !== field) {
            return <ArrowUpDown className="h-4 w-4" />
        }
        return sortState.order === 'asc'
            ? <ArrowUp className="h-4 w-4" />
            : <ArrowDown className="h-4 w-4" />
    }

    const handleView = (music: MusicFile) => {
        router.push(`/music/${music.id}`)
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

    const SortableHeader = ({ field, children, className }: { field: string, children: React.ReactNode, className?: string }) => (
        <TableHead
            className={cn("cursor-pointer hover:bg-muted/50 transition-colors", className)}
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-2">
                {children}
                {getSortIcon(field)}
            </div>
        </TableHead>
    )

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Título</TableHead>
                                <TableHead>Artista</TableHead>
                                <TableHead className="hidden sm:table-cell">Tom</TableHead>
                                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                                <TableHead className="hidden lg:table-cell">Tempo</TableHead>
                                <TableHead>Ações</TableHead>
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
            <div className="text-center py-12">
                <Music2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma música encontrada</h3>
                <p className="text-muted-foreground">
                    Tente ajustar os filtros ou adicionar novas músicas ao sistema.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Table */}
            <div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableHeader field="title">Título</SortableHeader>
                            <SortableHeader field="artist">Artista</SortableHeader>
                            <TableHead className="hidden sm:table-cell">Tom</TableHead>
                            <TableHead className="hidden md:table-cell">Categoria</TableHead>
                            <TableHead className="hidden lg:table-cell">Tempo</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {musics.map((music) => (
                            <TableRow key={music.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium w-full max-w-0">
                                    <div>
                                        <div className="font-medium line-clamp-2">
                                            {music.title || music.original_name}
                                        </div>

                                        {/* Show key, categories and times on mobile below the title */}
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

                                                {music.liturgical_times && music.liturgical_times.length > 0
                                                    ? music.liturgical_times.map((time, idx) => (
                                                        <Badge key={idx} variant="outline" className="text-xs">
                                                            {time}
                                                        </Badge>
                                                    ))
                                                    : music.liturgical_time && (
                                                        <Badge variant="outline" className="text-xs">{music.liturgical_time}</Badge>
                                                    )
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="max-w-[150px] sm:max-w-[200px]">
                                    {music.artist ? (
                                        <div className="flex items-center gap-2 min-w-0">
                                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="truncate">{music.artist}</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                    {music.musical_key ? (
                                        <Badge variant="outline" className="text-xs">
                                            {music.musical_key}
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
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
                                <TableCell className="hidden lg:table-cell">
                                    {music.liturgical_times && music.liturgical_times.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {music.liturgical_times.map((time, idx) => (
                                                <Badge key={idx} variant="outline" className="text-xs">
                                                    {time}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : music.liturgical_time ? (
                                        <Badge variant="outline">{music.liturgical_time}</Badge>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right w-auto">
                                    {/* Desktop Actions - Inline Buttons */}
                                    <div className="hidden sm:flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            title="Visualizar"
                                            onClick={() => handleView(music)}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            title="Download"
                                            onClick={() => handleDownload(music)}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        {music.youtube_link && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                asChild
                                                title="Ver no YouTube"
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <a
                                                    href={music.youtube_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <Youtube className="h-4 w-4" />
                                                </a>
                                            </Button>
                                        )}
                                        <AddToListModal
                                            musicId={music.id}
                                            musicTitle={music.title || music.original_name}
                                            onSuccess={onMusicUpdate}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            title="Editar"
                                            onClick={() => handleEdit(music)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Mobile Actions - Dropdown Menu */}
                                    <div className="sm:hidden">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Abrir menu de ações</span>
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
                                                {music.youtube_link && (
                                                    <DropdownMenuItem asChild>
                                                        <a
                                                            href={music.youtube_link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center text-red-600 hover:text-red-700"
                                                        >
                                                            <Youtube className="mr-2 h-4 w-4" />
                                                            Ver no YouTube
                                                        </a>
                                                    </DropdownMenuItem>
                                                )}
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
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleEdit(music)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Editar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground order-2 sm:order-1">
                        <span className="hidden sm:inline">
                            Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                            {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                            {pagination.total} resultado{pagination.total !== 1 ? 's' : ''}
                        </span>
                        <span className="sm:hidden">
                            {pagination.page} de {pagination.pages}
                        </span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(1)}
                            disabled={pagination.page === 1}
                            className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                        >
                            <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                        >
                            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(isMobile ? 3 : 5, pagination.pages) }, (_, i) => {
                                let pageNum
                                const maxPages = isMobile ? 3 : 5
                                if (pagination.pages <= maxPages) {
                                    pageNum = i + 1
                                } else if (pagination.page <= Math.floor(maxPages / 2) + 1) {
                                    pageNum = i + 1
                                } else if (pagination.page >= pagination.pages - Math.floor(maxPages / 2)) {
                                    pageNum = pagination.pages - maxPages + 1 + i
                                } else {
                                    pageNum = pagination.page - Math.floor(maxPages / 2) + i
                                }

                                return (
                                    <Button
                                        key={pageNum}
                                        variant={pageNum === pagination.page ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onPageChange(pageNum)}
                                        className="w-8 h-8 p-0 sm:w-9 sm:h-9"
                                    >
                                        {pageNum}
                                    </Button>
                                )
                            })}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(pagination.page + 1)}
                            disabled={pagination.page === pagination.pages}
                            className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                        >
                            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(pagination.pages)}
                            disabled={pagination.page === pagination.pages}
                            className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                        >
                            <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}