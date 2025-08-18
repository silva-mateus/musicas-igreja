'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
    ListPlus
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
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

    const SortableHeader = ({ field, children }: { field: string, children: React.ReactNode }) => (
        <TableHead
            className="cursor-pointer hover:bg-muted/50 transition-colors"
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
                                <TableHead>Categoria</TableHead>
                                <TableHead>Tempo</TableHead>
                                <TableHead>Links</TableHead>
                                <TableHead>Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
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
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableHeader field="title">Título</SortableHeader>
                            <SortableHeader field="artist">Artista</SortableHeader>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Tempo</TableHead>
                            <TableHead>Links</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {musics.map((music) => (
                            <TableRow key={music.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium">
                                    <div>
                                        <div className="font-medium">
                                            {music.title || music.original_name}
                                        </div>
                                        {music.musical_key && (
                                            <Badge variant="outline" className="text-xs mt-1">
                                                {music.musical_key}
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {music.artist ? (
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            {music.artist}
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
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
                                <TableCell>
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
                                <TableCell>
                                    {music.youtube_link ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <a
                                                href={music.youtube_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Ver no YouTube"
                                            >
                                                <Youtube className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
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
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                        {pagination.total} resultado{pagination.total !== 1 ? 's' : ''}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(1)}
                            disabled={pagination.page === 1}
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                let pageNum
                                if (pagination.pages <= 5) {
                                    pageNum = i + 1
                                } else if (pagination.page <= 3) {
                                    pageNum = i + 1
                                } else if (pagination.page >= pagination.pages - 2) {
                                    pageNum = pagination.pages - 4 + i
                                } else {
                                    pageNum = pagination.page - 2 + i
                                }

                                return (
                                    <Button
                                        key={pageNum}
                                        variant={pageNum === pagination.page ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onPageChange(pageNum)}
                                        className="w-8 h-8 p-0"
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
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(pagination.pages)}
                            disabled={pagination.page === pagination.pages}
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}