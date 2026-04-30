'use client'

import { useState } from 'react'
import { Badge } from '@core/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@core/components/ui/dropdown-menu'
import { TouchTarget } from '@/components/ui/touch-target'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import type { MusicList } from '@/types'
import {
    Eye,
    Edit,
    Trash2,
    Copy,
    ClipboardList,
    Download,
    Check,
    MoreHorizontal,
    Loader2,
    List,
    Calendar,
    Clock
} from 'lucide-react'
import { listsApi, handleApiError } from '@/lib/api'
import { useToast } from '@core/hooks/use-toast'
import { useAuth } from '@core/contexts/auth-context'
import Link from 'next/link'
import { DuplicateListDialog } from './duplicate-list-dialog'

interface ListCardProps {
    list: MusicList
    onDeleteClick: (list: MusicList) => void
    onReportGenerated?: () => void
    generatingReport: boolean
    reportCopied: boolean
    downloadingPdf: boolean
    setGeneratingReport: (id: number | null) => void
    setReportCopied: (id: number | null) => void
    setDownloadingPdf: (id: number | null) => void
}

export function ListCard({ 
    list, 
    onDeleteClick, 
    onReportGenerated,
    generatingReport,
    reportCopied,
    downloadingPdf,
    setGeneratingReport,
    setReportCopied,
    setDownloadingPdf
}: ListCardProps) {
    const { toast } = useToast()
    const { hasPermission } = useAuth()
    const canEdit = hasPermission('music:edit_metadata') || hasPermission('lists:manage')
    const canDelete = hasPermission('music:delete')

    const handleGenerateReport = async () => {
        setGeneratingReport(list.id)
        try {
            const result = await listsApi.generateReport(list.id)

            if (!result.success || !result.report) {
                toast({
                    title: "Erro",
                    description: result.message || "Não foi possível gerar o relatório.",
                    variant: "destructive"
                })
                return
            }

            const fullList = await listsApi.getList(list.id)

            let report = `${fullList.name}\n`
            report += '='.repeat(fullList.name.length) + '\n'

            if (fullList.observations?.trim()) {
                report += `${fullList.observations.trim()}\n`
            }
            report += '\n'

            const lines = result.report.split('\n').filter((line: string) => line.trim())
            lines.forEach((line: string, index: number) => {
                report += `${index + 1}. ${line}\n`
            })

            await navigator.clipboard.writeText(report)
            setReportCopied(list.id)

            toast({
                title: "Relatório copiado!",
                description: "O relatório da lista foi copiado para a área de transferência."
            })

            setTimeout(() => setReportCopied(null), 2000)

        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível gerar o relatório.",
                variant: "destructive"
            })
        } finally {
            setGeneratingReport(null)
            onReportGenerated?.()
        }
    }

    const handleDownloadPDF = async () => {
        setDownloadingPdf(list.id)
        try {
            const blob = await listsApi.mergeListPdfs(list.id)
            const safeName = list.name.replace(/[<>:"/\\|?*]/g, '_')
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${safeName}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            setTimeout(() => URL.revokeObjectURL(url), 1000)

            toast({
                title: "Download iniciado",
                description: `PDF da lista "${list.name}" está sendo baixado.`
            })
        } catch (error) {
            toast({
                title: "Erro no download",
                description: handleApiError(error),
                variant: "destructive"
            })
        } finally {
            setDownloadingPdf(null)
        }
    }

    return (
        <Link href={`/lists/${list.id}`}>
            <div className="bg-card border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                {/* Header: Name + Action Menu */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2 mb-1">
                            <List className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <h3 className="font-medium text-sm leading-tight line-clamp-2">
                                {list.name}
                            </h3>
                        </div>
                        {list.observations && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {list.observations}
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
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem asChild>
                                    <Link href={`/lists/${list.id}`} className="flex items-center">
                                        <Eye className="mr-2 h-4 w-4" />
                                        Visualizar Lista
                                    </Link>
                                </DropdownMenuItem>
                                {canEdit && (
                                    <DropdownMenuItem asChild>
                                        <Link href={`/lists/${list.id}/edit`} className="flex items-center">
                                            <Edit className="mr-2 h-4 w-4" />
                                            Editar Lista
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={handleGenerateReport}
                                    disabled={generatingReport}
                                >
                                    {reportCopied ? (
                                        <Check className="mr-2 h-4 w-4 text-primary" />
                                    ) : (
                                        <ClipboardList className="mr-2 h-4 w-4" />
                                    )}
                                    Gerar Relatório
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleDownloadPDF} disabled={downloadingPdf}>
                                    {downloadingPdf ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="mr-2 h-4 w-4" />
                                    )}
                                    {downloadingPdf ? 'Baixando...' : 'Baixar PDF'}
                                </DropdownMenuItem>
                                {canEdit && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DuplicateListDialog
                                            listId={list.id}
                                            listName={list.name}
                                            trigger={
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                    <Copy className="mr-2 h-4 w-4" />
                                                    Duplicar Lista
                                                </DropdownMenuItem>
                                            }
                                        />
                                    </>
                                )}
                                {canDelete && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() => onDeleteClick(list)}
                                            className="text-destructive focus:text-destructive"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Excluir Lista
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Metadata: Count, Dates */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {/* Music Count */}
                    <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                            {list.file_count ?? 0} música{(list.file_count ?? 0) !== 1 ? 's' : ''}
                        </Badge>
                    </div>

                    {/* Created Date */}
                    {list.created_date && (
                        <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                                {new Date(list.created_date).toLocaleDateString('pt-BR')}
                            </span>
                        </div>
                    )}

                    {/* Updated Date */}
                    {list.updated_date && list.updated_date !== list.created_date && (
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                                Atualizada {new Date(list.updated_date).toLocaleDateString('pt-BR')}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    )
}