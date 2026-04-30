'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@core/components/ui/card'
import { Button } from '@core/components/ui/button'
import { Loader2, Wand2, AlertTriangle, RefreshCw, FileText, CheckCircle2, Trash2 } from 'lucide-react'
import { useToast } from '@core/hooks/use-toast'
import { musicApi } from '@/lib/api'
import { musicKeys } from '@/hooks/use-music'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type OcrStatus = 'none' | 'queued' | 'processing' | 'done' | 'done_low_confidence' | 'failed'

interface Props {
    musicId: number
    contentType: 'pdf_only' | 'chord' | 'chord_converting' | undefined
    ocrStatus?: string
    hasDraft?: boolean
    canConvert: boolean
    onReviewDraft?: () => void
}

export function OcrConvertCard({ musicId, contentType, ocrStatus, hasDraft, canConvert, onReviewDraft }: Props) {
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const [confirmOpen, setConfirmOpen] = useState(false)
    const [discardOpen, setDiscardOpen] = useState(false)
    const [triggering, setTriggering] = useState(false)
    const [discarding, setDiscarding] = useState(false)
    const [polledStatus, setPolledStatus] = useState<OcrStatus>((ocrStatus as OcrStatus) || 'none')
    const [polledError, setPolledError] = useState<string | undefined>(undefined)

    const isProcessing = polledStatus === 'queued' || polledStatus === 'processing'
    const isFailed = polledStatus === 'failed'
    const draftReady = hasDraft && (polledStatus === 'done' || polledStatus === 'done_low_confidence')
    const lowConfidence = polledStatus === 'done_low_confidence'

    useEffect(() => {
        setPolledStatus((ocrStatus as OcrStatus) || 'none')
    }, [ocrStatus])

    useEffect(() => {
        if (!isProcessing) return

        let cancelled = false
        const poll = async () => {
            try {
                const res = await musicApi.getOcrStatus(musicId)
                if (cancelled) return
                setPolledStatus(res.status as OcrStatus)
                setPolledError(res.error)

                if (res.status === 'done' || res.status === 'done_low_confidence' || res.status === 'failed') {
                    await queryClient.invalidateQueries({ queryKey: musicKeys.detail(musicId) })
                    if (res.status !== 'failed') {
                        toast({
                            title: 'Cifra extraída',
                            description: res.status === 'done_low_confidence'
                                ? 'Extração com baixa confiança. Revise antes de salvar.'
                                : 'Revise o conteúdo e clique em Salvar para confirmar.',
                            variant: res.status === 'done_low_confidence' ? 'destructive' : 'default',
                        })
                    }
                }
            } catch {
                // ignore transient poll errors
            }
        }

        poll()
        const id = setInterval(poll, 2000)
        return () => {
            cancelled = true
            clearInterval(id)
        }
    }, [isProcessing, musicId, queryClient, toast])

    const handleDiscard = async () => {
        setDiscardOpen(false)
        try {
            setDiscarding(true)
            await musicApi.discardChordDraft(musicId)
            await queryClient.invalidateQueries({ queryKey: musicKeys.detail(musicId) })
            setPolledStatus('none')
            toast({ title: 'Rascunho descartado', description: 'PDF original mantido.' })
        } catch (error) {
            toast({
                title: 'Erro',
                description: error instanceof Error ? error.message : 'Falha ao descartar rascunho',
                variant: 'destructive',
            })
        } finally {
            setDiscarding(false)
        }
    }

    const handleConvert = async () => {
        setConfirmOpen(false)
        try {
            setTriggering(true)
            await musicApi.triggerOcr(musicId)
            await queryClient.invalidateQueries({ queryKey: musicKeys.detail(musicId) })
            toast({ title: 'Conversão iniciada', description: 'Extraindo cifra do PDF…' })
        } catch (error) {
            toast({
                title: 'Erro',
                description: error instanceof Error ? error.message : 'Falha ao iniciar conversão',
                variant: 'destructive',
            })
        } finally {
            setTriggering(false)
        }
    }

    if (contentType === 'chord') return null
    if (!canConvert && !isProcessing && !draftReady) return null

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Wand2 className="h-5 w-5" />
                        {draftReady ? 'Cifra Extraída — Revisar e Salvar' : 'Converter PDF para Cifra Editável'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {isProcessing && (
                        <div className="flex items-start gap-3 rounded-md bg-muted/50 p-3">
                            <Loader2 className="h-5 w-5 animate-spin shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium">Extraindo cifra…</p>
                                <p className="text-muted-foreground">
                                    Processando texto e acordes. PDF original permanece intacto.
                                </p>
                            </div>
                        </div>
                    )}

                    {isFailed && (
                        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            <div className="text-sm flex-1">
                                <p className="font-medium text-destructive">Falha na extração</p>
                                <p className="text-muted-foreground break-words">
                                    {polledError || 'Não foi possível extrair a cifra deste PDF.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {draftReady && (
                        <>
                            <div className={`flex items-start gap-3 rounded-md p-3 ${lowConfidence ? 'border border-amber-500/30 bg-amber-500/5' : 'bg-muted/50'}`}>
                                {lowConfidence
                                    ? <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                    : <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />}
                                <div className="text-sm">
                                    <p className="font-medium">
                                        {lowConfidence ? 'Extração com baixa confiança' : 'Cifra extraída com sucesso'}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {lowConfidence
                                            ? 'Revise cuidadosamente antes de salvar — a extração pode estar incompleta.'
                                            : 'Revise o conteúdo no editor e clique em Salvar para substituir o PDF pela cifra.'}
                                        {' '}O PDF original será preservado até você salvar.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button onClick={onReviewDraft} className="gap-2">
                                    <FileText className="h-4 w-4" />
                                    Revisar e Salvar
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setDiscardOpen(true)}
                                    disabled={discarding}
                                    className="gap-2"
                                >
                                    {discarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    Descartar
                                </Button>
                            </div>
                        </>
                    )}

                    {!isProcessing && !draftReady && canConvert && (
                        <>
                            <p className="text-sm text-muted-foreground">
                                Extraímos texto e acordes automaticamente. Você revisa antes de salvar.
                                O PDF original é mantido até você confirmar a nova versão.
                            </p>
                            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                Melhor resultado em PDFs digitais. PDFs escaneados podem exigir revisão.
                            </p>
                            <Button
                                onClick={() => setConfirmOpen(true)}
                                disabled={triggering}
                                className="gap-2"
                            >
                                {triggering ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isFailed ? (
                                    <RefreshCw className="h-4 w-4" />
                                ) : (
                                    <Wand2 className="h-4 w-4" />
                                )}
                                {isFailed ? 'Tentar Novamente' : 'Converter para Cifra'}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Converter PDF para cifra?"
                description="A extração leva até 30 segundos. O PDF original permanece intacto — após a extração você revisa e só então salva a versão em cifra."
                confirmText="Converter"
                cancelText="Cancelar"
                onConfirm={handleConvert}
            />

            <ConfirmDialog
                open={discardOpen}
                onOpenChange={setDiscardOpen}
                title="Descartar rascunho da cifra?"
                description="O texto extraído será apagado. O PDF original continuará disponível. Você pode tentar a conversão novamente depois."
                confirmText="Descartar"
                cancelText="Cancelar"
                onConfirm={handleDiscard}
            />
        </>
    )
}
