'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Upload, FileText, X, AlertCircle, CheckCircle2, File } from 'lucide-react'
import { formatFileSize, cn } from '@/lib/utils'

interface UploadZoneProps {
    onFilesSelected: (files: File[]) => void
    disabled?: boolean
    selectedFiles?: File[]
    onRemoveFile?: (index: number) => void
    compact?: boolean
    maxFiles?: number
    className?: string
}

export function UploadZone({
    onFilesSelected,
    disabled = false,
    selectedFiles = [],
    onRemoveFile,
    compact = false,
    maxFiles,
    className,
}: UploadZoneProps) {
    const [dragActive, setDragActive] = useState(false)

    const onDrop = useCallback(
        (acceptedFiles: File[], rejectedFiles: any[]) => {
            if (disabled) return

            const pdfFiles = acceptedFiles.filter((file) => file.type === 'application/pdf')

            if (pdfFiles.length > 0) {
                if (maxFiles === 1) {
                    onFilesSelected([pdfFiles[0]])
                } else {
                    onFilesSelected([...selectedFiles, ...pdfFiles])
                }
            }

            if (rejectedFiles.length > 0 || pdfFiles.length !== acceptedFiles.length) {
                console.warn('Alguns arquivos foram rejeitados (apenas PDFs são aceitos)')
            }
        },
        [disabled, selectedFiles, onFilesSelected, maxFiles]
    )

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        disabled,
        maxSize: 50 * 1024 * 1024,
        onDragEnter: () => setDragActive(true),
        onDragLeave: () => setDragActive(false),
        onDropAccepted: () => setDragActive(false),
        onDropRejected: () => setDragActive(false),
        multiple: maxFiles === 1 ? false : true,
        maxFiles: maxFiles,
    })

    const getFileStatus = (file: File) => {
        if (file.size > 50 * 1024 * 1024) {
            return { status: 'error', message: 'Arquivo muito grande (máx. 50MB)' }
        }
        if (file.type !== 'application/pdf') {
            return { status: 'error', message: 'Apenas arquivos PDF são aceitos' }
        }
        return { status: 'success', message: 'Pronto para upload' }
    }

    return (
        <div className={cn('space-y-4', className)}>
            {/* Drop Zone */}
            <div
                {...getRootProps()}
                className={cn(
                    'border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors',
                    compact ? 'p-4' : 'p-8',
                    'hover:border-primary/50 hover:bg-primary/5',
                    isDragActive || dragActive ? 'border-primary bg-primary/10' : 'border-border',
                    disabled && 'opacity-50 cursor-not-allowed'
                )}
            >
                <input {...getInputProps()} />

                <div className="flex flex-col items-center gap-3">
                    <div className={cn('rounded-full', compact ? 'p-2' : 'p-4', isDragActive || dragActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
                        <Upload className={cn(compact ? 'h-5 w-5' : 'h-8 w-8')} />
                    </div>

                    <div className="space-y-1">
                        <h3 className={cn('font-medium', compact ? 'text-sm' : 'text-lg')}>
                            {isDragActive || dragActive ? 'Solte o arquivo aqui' : 'Arraste um PDF ou clique para selecionar'}
                        </h3>
                        {!compact && <p className="text-sm text-muted-foreground">Máximo 50MB por arquivo</p>}
                    </div>

                    <Button variant="outline" disabled={disabled} className="gap-2">
                        <FileText className="h-4 w-4" />
                        {compact ? 'Selecionar PDF' : 'Selecionar Arquivos'}
                    </Button>
                </div>
            </div>

            {/* Selected Files List - Only show in non-compact mode */}
            {selectedFiles.length > 0 && !compact && (
                <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                        <File className="h-4 w-4" /> Arquivos Selecionados ({selectedFiles.length})
                    </h4>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {selectedFiles.map((file, index) => {
                            const fileStatus = getFileStatus(file)
                            return (
                                <Card key={index} className="p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div
                                                className={cn(
                                                    'p-2 rounded',
                                                    fileStatus.status === 'success'
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                                )}
                                            >
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium truncate">{file.name}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{formatFileSize(file.size)}</span>
                                                    <span>•</span>
                                                    <span>{file.type}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={fileStatus.status === 'success' ? 'default' : 'destructive'} className="gap-1">
                                                {fileStatus.status === 'success' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                                {fileStatus.status === 'success' ? 'OK' : 'Erro'}
                                            </Badge>
                                            {onRemoveFile && (
                                                <Button variant="ghost" size="icon" onClick={() => onRemoveFile(index)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}