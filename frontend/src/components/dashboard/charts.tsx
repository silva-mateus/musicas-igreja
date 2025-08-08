'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts'
import { dashboardApi, handleApiError } from '@/lib/api'
import type { ChartData } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1']

export function DashboardCharts() {
    const [categoriesData, setCategoriesData] = useState<ChartData | null>(null)
    const [liturgicalData, setLiturgicalData] = useState<ChartData | null>(null)
    const [uploadsData, setUploadsData] = useState<ChartData | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        loadChartsData()
    }, [])

    const loadChartsData = async () => {
        try {
            setIsLoading(true)
            const [categories, liturgical, uploads] = await Promise.all([
                dashboardApi.getCategoriesChart(),
                dashboardApi.getLiturgicalTimesChart(),
                dashboardApi.getUploadsTimeline()
            ])

            setCategoriesData(categories)
            setLiturgicalData(liturgical)
            setUploadsData(uploads)
        } catch (error) {
            console.error('Erro ao carregar gráficos:', handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Transformar dados para recharts
    const categoriesChartData = categoriesData?.labels?.map((label, index) => ({
        name: label,
        value: categoriesData.datasets[0]?.data[index] || 0
    })) || []

    const liturgicalChartData = liturgicalData?.labels?.map((label, index) => ({
        name: label,
        value: liturgicalData.datasets[0]?.data[index] || 0
    })) || []

    const uploadsChartData = uploadsData?.labels?.map((label, index) => ({
        month: label,
        uploads: uploadsData.datasets[0]?.data[index] || 0
    })) || []

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Categorias */}
                <Card>
                    <CardHeader>
                        <CardTitle>Músicas por Categoria</CardTitle>
                        <CardDescription>
                            Distribuição das músicas pelas categorias
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={categoriesChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {categoriesChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Gráfico de Tempos Litúrgicos */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tempos Litúrgicos</CardTitle>
                        <CardDescription>
                            Músicas organizadas por tempo litúrgico
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={liturgicalChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="name"
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                    fontSize={12}
                                />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Timeline de Uploads */}
            <Card>
                <CardHeader>
                    <CardTitle>Timeline de Uploads</CardTitle>
                    <CardDescription>
                        Número de músicas adicionadas ao longo dos últimos 12 meses
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={uploadsChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="month"
                                fontSize={12}
                            />
                            <YAxis />
                            <Tooltip />
                            <Area
                                type="monotone"
                                dataKey="uploads"
                                stroke="#3b82f6"
                                fill="rgba(59, 130, 246, 0.1)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}