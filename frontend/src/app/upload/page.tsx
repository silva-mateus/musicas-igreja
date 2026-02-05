'use client'

import { useState, useCallback } from 'react'

import { MainLayout } from '@/components/layout/main-layout'
import { UploadZone } from '@/components/upload/upload-zone'
import { UploadProgress } from '@/components/upload/upload-progress'
import { UploadResults } from '@/components/upload/upload-results'
import { UploadMetadataEditor } from '@/components/upload/upload-metadata-editor'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { musicApi, handleApiError } from '@/lib/api'
import type { UploadResponse } from '@/types'
import { Upload, FileText, AlertTriangle, RefreshCw, Lock, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { InstructionsModal, PAGE_INSTRUCTIONS } from '@/components/ui/instructions-modal'

interface FileMetadata {
    file: File
    title: string
    artist: string
    category: string
    liturgical_time: string
    categories?: string[]
    liturgical_times?: string[]
    new_categories?: string[]
    new_liturgical_times?: string[]
    new_artist?: string
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
    const { toast } = useToast()
    const { canUpload, isAuthenticated } = useAuth()

    const [uploadState, setUploadState] = useState<UploadState>({
        files: [],
        metadata: [],
        isUploading: false,
        progress: 0,
        results: null,
        error: ''
    })

    const handleFilesSelected = (files: File[]) => {
        setUploadState(prev => {
            // Preserve existing metadata for files that are still present
            const existingMetadataMap = new Map(
                prev.metadata.map(m => [m.file.name + m.file.size, m])
            )
            
            // Keep metadata for files that still exist
            const preservedMetadata = files
                .map(file => existingMetadataMap.get(file.name + file.size))
                .filter((m): m is FileMetadata => m !== undefined)
            
            return {
                ...prev,
                files,
                // Only reset metadata for truly new sessions, preserve for additions
                metadata: prev.files.length === 0 ? [] : preservedMetadata,
                results: null,
                error: ''
            }
        })
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

        const invalidFiles = uploadState.metadata.filter(meta => !meta.title.trim() || !(meta.categories && meta.categories.length > 0))
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
            const metadata = uploadState.metadata.map(meta => ({
                title: meta.title,
                artist: meta.artist,
                new_artist: meta.new_artist,
                categories: meta.categories || (meta.category ? [meta.category] : []),
                liturgical_times: meta.liturgical_times || (meta.liturgical_time ? [meta.liturgical_time] : []),
                new_categories: meta.new_categories || [],
                new_liturgical_times: meta.new_liturgical_times || [],
                musical_key: meta.musical_key,
                youtube_link: meta.youtube_link,
                observations: meta.observations,
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

    // Permission check
    if (!isAuthenticated || !canUpload) {
        return (
            <MainLayout>
                <EmptyState
                    icon={Lock}
                    title="Acesso Restrito"
                    description={!isAuthenticated
                        ? 'Você precisa estar logado para fazer upload de arquivos.'
                        : 'Você não tem permissão para fazer upload de arquivos. Somente Uploaders e Administradores podem fazer isso.'}
                    className="min-h-[400px]"
                />
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    icon={Upload}
                    title="Upload de Músicas"
                    description="Envie arquivos PDF de partituras para o sistema"
                >
                    <div className="flex items-center gap-2">
                        <InstructionsModal
                            title={PAGE_INSTRUCTIONS.upload.title}
                            description={PAGE_INSTRUCTIONS.upload.description}
                            sections={PAGE_INSTRUCTIONS.upload.sections}
                        />
                        {(uploadState.files.length > 0 || uploadState.results) && (
                            <Button
                                onClick={resetUpload}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={uploadState.isUploading}
                            >
                                <RefreshCw className="h-4 w-4" />
                                <span className="hidden sm:inline">Novo Upload</span>
                                <span className="sm:hidden">Novo</span>
                            </Button>
                        )}
                    </div>
                </PageHeader>

                {/* Upload Zone - Full when no files, Compact when files exist */}
                {!uploadState.results && (
                    <>
                        {uploadState.files.length === 0 ? (
                            <Card>
                                <CardContent className="p-6">
                                    <UploadZone
                                        onFilesSelected={handleFilesSelected}
                                        disabled={uploadState.isUploading}
                                        selectedFiles={uploadState.files}
                                    />
                                </CardContent>
                            </Card>
                        ) : (
                            /* Metadata Editor with integrated controls */
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <FileText className="h-5 w-5" />
                                            Arquivos para Upload
                                            <Badge variant="secondary">
                                                {uploadState.files.length}
                                            </Badge>
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-normal text-muted-foreground">
                                                {(uploadState.files.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024).toFixed(1)} MB
                                            </span>
                                            <Button
                                                onClick={handleUpload}
                                                disabled={uploadState.isUploading}
                                                size="sm"
                                                className="gap-2"
                                            >
                                                {uploadState.isUploading ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Enviando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="h-4 w-4" />
                                                        Enviar
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </CardTitle>
                                    <CardDescription>
                                        Preencha as informações de cada arquivo. Campos com * são obrigatórios.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Compact Upload Zone to add more files */}
                                    <UploadZone
                                        onFilesSelected={handleFilesSelected}
                                        disabled={uploadState.isUploading}
                                        selectedFiles={uploadState.files}
                                        compact
                                        className="border-dashed"
                                    />
                                    
                                    {/* Metadata Editor */}
                                    <UploadMetadataEditor
                                        files={uploadState.files}
                                        onMetadataChange={handleMetadataChange}
                                        onRemoveFile={handleRemoveFile}
                                    />
                                </CardContent>
                            </Card>
                        )}
                    </>
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
