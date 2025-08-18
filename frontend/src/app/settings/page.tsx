'use client'

import { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
    Settings,
    Save,
    RefreshCw,
    FileCheck,
    RotateCcw,
    Cloud,
    Shield,
    CheckCircle,
    AlertCircle,
    Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { GoogleDriveSettings } from '@/components/settings/google-drive-settings'

interface MismatchedFile {
    id: number
    current_filename: string
    expected_filename: string
    song_name: string
    artist: string
    musical_key: string
    file_path: string
}

interface VerificationResult {
    total_files: number
    mismatched_count: number
    mismatched_files: MismatchedFile[]
}

export default function SettingsPage() {
    const { toast } = useToast()

    // PDF Verification
    const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
    const [isVerifying, setIsVerifying] = useState(false)
    const [isFixing, setIsFixing] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<number[]>([])

    const [isLoading, setIsLoading] = useState(false)

    const handleVerifyPdfs = async () => {
        setIsVerifying(true)
        try {
            const response = await fetch('/api/admin/verify-pdfs')
            const data = await response.json()

            if (response.ok) {
                setVerificationResult(data)
                setSelectedFiles([]) // Clear selection
                toast({
                    title: "Verificação concluída",
                    description: `${data.mismatched_count} de ${data.total_files} arquivos precisam ser corrigidos.`,
                })
            } else {
                throw new Error(data.error || 'Erro na verificação')
            }
        } catch (error: any) {
            toast({
                title: "Erro na verificação",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setIsVerifying(false)
        }
    }

    const handleFixPdfs = async () => {
        if (selectedFiles.length === 0) return

        setIsFixing(true)
        try {
            const response = await fetch('/api/admin/fix-pdf-names', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_ids: selectedFiles })
            })

            const data = await response.json()

            if (response.ok) {
                toast({
                    title: "Correção concluída",
                    description: `${data.fixed_count} arquivos foram corrigidos.`,
                })
                // Refresh verification after fixing
                handleVerifyPdfs()
            } else {
                throw new Error(data.error || 'Erro na correção')
            }
        } catch (error: any) {
            toast({
                title: "Erro na correção",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setIsFixing(false)
        }
    }

    const handleSelectAll = () => {
        if (!verificationResult) return

        if (selectedFiles.length === verificationResult.mismatched_files.length) {
            setSelectedFiles([])
        } else {
            setSelectedFiles(verificationResult.mismatched_files.map(f => f.id))
        }
    }

    const handleFileSelect = (fileId: number) => {
        setSelectedFiles(prev =>
            prev.includes(fileId)
                ? prev.filter(id => id !== fileId)
                : [...prev, fileId]
        )
    }



    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Settings className="h-8 w-8 text-primary" />
                            Configurações
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Gerencie as configurações do sistema e ferramentas administrativas
                        </p>
                    </div>
                </div>

                {/* PDF Verification Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileCheck className="h-5 w-5" />
                            Verificação de PDFs
                        </CardTitle>
                        <CardDescription>
                            Verifique se os nomes dos arquivos PDF seguem o padrão "Nome da Música - Tom - Artista"
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={handleVerifyPdfs}
                                            disabled={isVerifying}
                                            className="gap-2"
                                        >
                                            {isVerifying ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <FileCheck className="h-4 w-4" />
                                            )}
                                            {isVerifying ? 'Verificando...' : 'Verificar PDFs'}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Verificar se todos os PDFs seguem o padrão de nomenclatura</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {verificationResult && (
                            <div className="space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Badge variant="outline" className="gap-1">
                                            <CheckCircle className="h-3 w-3" />
                                            {verificationResult.total_files - verificationResult.mismatched_count} corretos
                                        </Badge>
                                        <Badge variant="destructive" className="gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            {verificationResult.mismatched_count} precisam correção
                                        </Badge>
                                    </div>
                                    {verificationResult.mismatched_count > 0 && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleSelectAll}
                                            >
                                                {selectedFiles.length === verificationResult.mismatched_files.length
                                                    ? 'Desselecionar todos'
                                                    : 'Selecionar todos'}
                                            </Button>
                                            <Button
                                                onClick={handleFixPdfs}
                                                disabled={selectedFiles.length === 0 || isFixing}
                                                className="gap-2"
                                            >
                                                {isFixing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="h-4 w-4" />
                                                )}
                                                Corrigir Selecionados ({selectedFiles.length})
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {verificationResult.mismatched_count > 0 && (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {verificationResult.mismatched_files.map((file) => (
                                            <div
                                                key={file.id}
                                                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFiles.includes(file.id)}
                                                    onChange={() => handleFileSelect(file.id)}
                                                    className="rounded"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">
                                                        Atual: {file.current_filename}
                                                    </div>
                                                    <div className="text-sm text-green-600 truncate">
                                                        Esperado: {file.expected_filename}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {file.song_name} - {file.musical_key || 'Sem tom'} - {file.artist}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Google Drive Sync Section */}
                <GoogleDriveSettings />

                {/* System Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Informações do Sistema
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-medium">Versão:</span> 2.0.0
                            </div>
                            <div>
                                <span className="font-medium">Banco de Dados:</span> SQLite
                            </div>
                            <div>
                                <span className="font-medium">Estrutura:</span> /organized
                            </div>
                            <div>
                                <span className="font-medium">Padrão de nome:</span> Música - Tom - Artista
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}