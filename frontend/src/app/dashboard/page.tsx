'use client'

import { useEffect, useState } from 'react'

import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { dashboardApi, handleApiError } from '@/lib/api'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { DashboardCharts } from '@/components/dashboard/charts'
import { QuickActions } from '@/components/dashboard/quick-actions'
import type { DashboardStats } from '@/types'
import { BarChart3, RefreshCw } from 'lucide-react'

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
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-muted-foreground">Carregando dashboard...</p>
                    </div>
                </div>
            </MainLayout>
        )
    }

    if (error) {
        return (
            <MainLayout>
                <div className="text-center">
                    <p className="text-destructive">{error}</p>
                    <Button onClick={loadStats} className="mt-4">
                        Tentar novamente
                    </Button>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                            <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
                            <span className="truncate">Dashboard</span>
                        </h1>
                        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                            Visão geral do sistema de músicas da igreja
                        </p>
                    </div>
                    <Button onClick={loadStats} variant="outline" size="sm" className="gap-2 shrink-0 self-start sm:self-auto">
                        <RefreshCw className="h-4 w-4" />
                        <span className="hidden sm:inline">Atualizar</span>
                    </Button>
                </div>

                {/* Stats Cards */}
                <StatsCards stats={stats} />

                {/* Charts */}
                <DashboardCharts />

                {/* Quick Actions */}
                <QuickActions />
            </div>
        </MainLayout>
    )
}