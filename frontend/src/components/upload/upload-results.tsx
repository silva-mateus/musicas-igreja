'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { UploadResponse } from '@/types'
import {
    CheckCircle2,
    AlertTriangle,
    Copy,
    FileText,
    ExternalLink,
    Music,
    XCircle
} from 'lucide-react'
import Link from 'next/link'

interface UploadResultsProps {
    results: UploadResponse
}

export function UploadResults({ results }: UploadResultsProps) {
    const successCount = results.files?.filter(f => f.status === 'success').length || 0
    const duplicateCount = results.files?.filter(f => f.status === 'duplicate').length || 0
    const errorCount = results.files?.filter(f => f.status === 'error').length || 0

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-green-600" />
            case 'duplicate':
                return <Copy className="h-4 w-4 text-yellow-600" />
            case 'error':
                return <XCircle className="h-4 w-4 text-red-600" />
            default:
                return <FileText className="h-4 w-4" />
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'success':
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400">Sucesso</Badge>
            case 'duplicate':
                return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400">Duplicata</Badge>
            case 'error':
                return <Badge variant="destructive">Erro</Badge>
            default:
                return <Badge variant="outline">Desconhecido</Badge>
        }
    }

    const getStatusMessage = (file: any) => {
        switch (file.status) {
            case 'success':
                return 'Arquivo enviado com sucesso'
            case 'duplicate':
                return file.duplicate_of
                    ? `Duplicata detectada: ${file.duplicate_of}`
                    : 'Arquivo já existe no sistema'
            case 'error':
                return file.message || 'Erro ao processar arquivo'
            default:
                return 'Status desconhecido'
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Resultado do Upload
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{successCount}</div>
                        <div className="text-sm text-green-700 dark:text-green-400">Enviados</div>
                    </div>

                    {duplicateCount > 0 && (
                        <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-600">{duplicateCount}</div>
                            <div className="text-sm text-yellow-700 dark:text-yellow-400">Duplicatas</div>
                        </div>
                    )}

                    {errorCount > 0 && (
                        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                            <div className="text-sm text-red-700 dark:text-red-400">Erros</div>
                        </div>
                    )}
                </div>

                <Separator />

                {/* Files List */}
                <div className="space-y-3">
                    <h4 className="font-medium">Detalhes dos Arquivos</h4>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {results.files?.map((file, index) => (
                            <Card key={index} className="p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className="mt-0.5">
                                            {getStatusIcon(file.status)}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-medium truncate">
                                                    {file.original_name}
                                                </p>
                                                {getStatusBadge(file.status)}
                                            </div>

                                            <p className="text-sm text-muted-foreground">
                                                {getStatusMessage(file)}
                                            </p>

                                            {file.size && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Tamanho: {(file.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {file.status === 'success' && file.filename && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                            className="gap-2"
                                        >
                                            <Link href={`/music?search=${encodeURIComponent(file.original_name)}`}>
                                                <ExternalLink className="h-4 w-4" />
                                                Ver
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {successCount > 0 && (
                        <Button asChild className="gap-2">
                            <Link href="/music">
                                <Music className="h-4 w-4" />
                                Ver Todas as Músicas
                            </Link>
                        </Button>
                    )}

                    <Button variant="outline" asChild className="gap-2">
                        <Link href="/upload">
                            <FileText className="h-4 w-4" />
                            Fazer Novo Upload
                        </Link>
                    </Button>
                </div>

                {/* General Message */}
                {results.message && (
                    <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{results.message}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}