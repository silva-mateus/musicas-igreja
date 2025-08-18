'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Upload, Clock } from 'lucide-react'

interface UploadProgressProps {
    progress: number
}

export function UploadProgress({ progress }: UploadProgressProps) {
    const getProgressColor = (progress: number) => {
        if (progress < 30) return 'bg-red-500'
        if (progress < 70) return 'bg-yellow-500'
        return 'bg-green-500'
    }

    const getProgressMessage = (progress: number) => {
        if (progress < 10) return 'Iniciando upload...'
        if (progress < 50) return 'Enviando arquivos...'
        if (progress < 90) return 'Processando...'
        return 'Finalizando...'
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 animate-pulse" />
                    Upload em Progresso
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">
                            {getProgressMessage(progress)}
                        </span>
                        <span className="font-medium">
                            {Math.round(progress)}%
                        </span>
                    </div>

                    <Progress
                        value={progress}
                        className="h-2"
                    />
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                        Por favor, não feche esta página durante o upload
                    </span>
                </div>

                {/* Animation indicator */}
                <div className="flex justify-center">
                    <div className="flex space-x-1">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="w-2 h-2 bg-primary rounded-full animate-pulse"
                                style={{
                                    animationDelay: `${i * 0.2}s`,
                                    animationDuration: '1s'
                                }}
                            />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}