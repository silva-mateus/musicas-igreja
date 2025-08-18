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
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <BarChart3 className="h-8 w-8 text-primary" />
                            Dashboard
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Visão geral do sistema de músicas da igreja
                        </p>
                    </div>
                    <Button onClick={loadStats} variant="outline" size="sm" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Atualizar
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