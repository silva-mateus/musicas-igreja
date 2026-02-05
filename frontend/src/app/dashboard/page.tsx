'use client'

import { useEffect, useState } from 'react'

import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingOverlay } from '@/components/ui/loading-spinner'
import { ErrorState } from '@/components/ui/error-state'
import { dashboardApi, handleApiError } from '@/lib/api'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { DashboardCharts } from '@/components/dashboard/charts'
import { QuickActions } from '@/components/dashboard/quick-actions'
import type { DashboardStats } from '@/types'
import { BarChart3, RefreshCw } from 'lucide-react'
import { InstructionsModal, PAGE_INSTRUCTIONS } from '@/components/ui/instructions-modal'

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        loadStats()
    }, [])

    const loadStats = async () => {
        try {
            setIsLoading(true)
            setError('')
            const data = await dashboardApi.getStats()
            setStats(data)
        } catch (error) {
            setError(handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <MainLayout>
                <LoadingOverlay message="Carregando dashboard..." />
            </MainLayout>
        )
    }

    if (error) {
        return (
            <MainLayout>
                <ErrorState message={error} onRetry={loadStats} />
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    icon={BarChart3}
                    title="Dashboard"
                    description="Visão geral do sistema de músicas da igreja"
                >
                    <div className="flex items-center gap-2">
                        <InstructionsModal
                            title={PAGE_INSTRUCTIONS.dashboard.title}
                            description={PAGE_INSTRUCTIONS.dashboard.description}
                            sections={PAGE_INSTRUCTIONS.dashboard.sections}
                        />
                        <Button onClick={loadStats} variant="outline" size="sm" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            <span className="hidden sm:inline">Atualizar</span>
                        </Button>
                    </div>
                </PageHeader>

                <StatsCards stats={stats} />
                <DashboardCharts />
                <QuickActions />
            </div>
        </MainLayout>
    )
}
