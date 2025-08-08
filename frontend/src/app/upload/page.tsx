'use client'

import { useState, useCallback } from 'react'
import { useRequireAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/components/layout/main-layout'
import { UploadZone } from '@/components/upload/upload-zone'
import { UploadProgress } from '@/components/upload/upload-progress'
import { UploadResults } from '@/components/upload/upload-results'
import { UploadMetadataEditor } from '@/components/upload/upload-metadata-editor'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { musicApi, handleApiError } from '@/lib/api'
import type { UploadResponse } from '@/types'
import { Upload, FileText, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface FileMetadata {
    file: File
    title: string
    artist: string
    category: string
    liturgical_time: string
    musical_key: string
    youtube_link: string
    observations: string
}

interface UploadState {
    files: File[]
    metadata: FileMetadata[]
    isUploading: boolean
    progress: number
    results: UploadResponse | null
    error: string
}

export default function UploadPage() {
    const { isAuthenticated, isLoading: authLoading } = useRequireAuth()
    const { toast } = useToast()

    const [uploadState, setUploadState] = useState<UploadState>({
        files: [],
        metadata: [],
        isUploading: false,
        progress: 0,
        results: null,
        error: ''
    })

    const handleFilesSelected = (files: File[]) => {
        setUploadState(prev => ({
            ...prev,
            files,
            metadata: [],
            results: null,
            error: ''
        }))
    }

    const handleMetadataChange = useCallback((metadata: FileMetadata[]) => {
        setUploadState(prev => ({
            ...prev,
            metadata
        }))
    }, [])

    const handleRemoveFile = useCallback((index: number) => {
        setUploadState(prev => ({
            ...prev,
            files: prev.files.filter((_, i) => i !== index),
            metadata: prev.metadata.filter((_, i) => i !== index)
        }))
    }, [])

    const handleUpload = async () => {
        if (uploadState.files.length === 0) return

        // Validar se todos os arquivos têm metadados válidos
        const invalidFiles = uploadState.metadata.filter(meta => !meta.title.trim() || !meta.category)
        if (invalidFiles.length > 0) {
            toast({
                title: "Dados incompletos",
                description: "Por favor, preencha o título e categoria de todos os arquivos.",
                variant: "destructive"
            })
            return
        }

        setUploadState(prev => ({ ...prev, isUploading: true, error: '', progress: 0 }))

        try {
            // Preparar metadados para envio
            const metadata = uploadState.metadata.map(meta => ({
                title: meta.title,
                artist: meta.artist,
                category: meta.category,
                liturgical_time: meta.liturgical_time,
                musical_key: meta.musical_key,
                youtube_link: meta.youtube_link,
                observations: meta.observations
            }))

            const results = await musicApi.uploadMusics(
                uploadState.files,
                (progress) => setUploadState(prev => ({ ...prev, progress })),
                metadata
            )

            setUploadState(prev => ({
                ...prev,
                isUploading: false,
                results,
                files: []
            }))

            toast({
                title: "Upload concluído!",
                description: `${results.files?.length || 0} arquivo(s) processado(s).`,
            })

        } catch (error) {
            const errorMessage = handleApiError(error)
            setUploadState(prev => ({
                ...prev,
                isUploading: false,
                error: errorMessage
            }))

            toast({
                title: "Erro no upload",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const resetUpload = () => {
        setUploadState({
            files: [],
            metadata: [],
            isUploading: false,
            progress: 0,
            results: null,
            error: ''
        })
    }

    const removeFile = (index: number) => {
        setUploadState(prev => ({
            ...prev,
            files: prev.files.filter((_, i) => i !== index),
            metadata: prev.metadata.filter((_, i) => i !== index)
        }))
    }

    if (authLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-muted-foreground">Carregando...</p>
                    </div>
                </div>
            </MainLayout>
        )
    }

    if (!isAuthenticated) {
        return null
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Upload className="h-8 w-8 text-primary" />
                            Upload de Músicas
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Envie arquivos PDF de partituras para o sistema
                        </p>
                    </div>
                    {(uploadState.files.length > 0 || uploadState.results) && (
                        <Button
                            onClick={resetUpload}
                            variant="outline"
                            className="gap-2"
                            disabled={uploadState.isUploading}
                        >
                            <RefreshCw className="h-4 w-4" />
                            Novo Upload
                        </Button>
                    )}
                </div>

                {/* Upload Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Instruções de Upload
                        </CardTitle>
                        <CardDescription>
                            Siga estas diretrizes para obter melhores resultados
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium text-green-600">✅ Formatos Aceitos</h4>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li>• Arquivos PDF (.pdf)</li>
                                    <li>• Múltiplos arquivos por vez</li>
                                    <li>• Máximo 50MB por arquivo</li>
                                </ul>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium text-blue-600">💡 Dicas</h4>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li>• Use nomes descritivos nos arquivos</li>
                                    <li>• O sistema detecta duplicatas automaticamente</li>
                                    <li>• Metadados podem ser editados após upload</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Upload Zone */}
                {!uploadState.results && (
                    <Card>
                        <CardContent className="p-6">
                            <UploadZone
                                onFilesSelected={handleFilesSelected}
                                disabled={uploadState.isUploading}
                                selectedFiles={uploadState.files}
                                onRemoveFile={handleRemoveFile}
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Metadata Editor */}
                {uploadState.files.length > 0 && !uploadState.results && (
                    <UploadMetadataEditor
                        files={uploadState.files}
                        onMetadataChange={handleMetadataChange}
                        onRemoveFile={handleRemoveFile}
                    />
                )}

                {/* Upload Controls */}
                {uploadState.files.length > 0 && !uploadState.results && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Arquivos Selecionados</span>
                                <Badge variant="secondary">
                                    {uploadState.files.length} arquivo{uploadState.files.length !== 1 ? 's' : ''}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-muted-foreground">
                                    Total: {(uploadState.files.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024).toFixed(2)} MB
                                </div>
                                <Button
                                    onClick={handleUpload}
                                    disabled={uploadState.isUploading}
                                    className="gap-2"
                                >
                                    {uploadState.isUploading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            Enviar Arquivos
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Upload Progress */}
                {uploadState.isUploading && (
                    <UploadProgress progress={uploadState.progress} />
                )}

                {/* Upload Results */}
                {uploadState.results && (
                    <UploadResults results={uploadState.results} />
                )}

                {/* Error Display */}
                {uploadState.error && (
                    <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-5 w-5" />
                                Erro no Upload
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-destructive">{uploadState.error}</p>
                            <Button
                                onClick={resetUpload}
                                variant="outline"
                                className="mt-4"
                            >
                                Tentar Novamente
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </MainLayout>
    )
}