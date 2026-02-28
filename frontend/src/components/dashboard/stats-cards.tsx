'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@core/components/ui/card'
import {
    Music,
    List,
    BarChart3,
    Users,
    HardDrive,
    Youtube,
    TrendingUp,
    FileText
} from 'lucide-react'
import type { DashboardStats } from '@/types'
import { formatFileSize } from '@/lib/utils'

interface StatsCardsProps {
    stats: DashboardStats | null
}

export function StatsCards({ stats }: StatsCardsProps) {
    if (!stats) return null

    const cards = [
        {
            title: 'Total de Músicas',
            value: stats.total_musics,
            subtitle: `${stats.total_pages} páginas`,
            icon: Music,
        },
        {
            title: 'Listas Criadas',
            value: stats.total_lists,
            subtitle: `${stats.avg_musics_per_list} músicas/lista`,
            icon: List,
        },
        {
            title: 'Categorias',
            value: stats.total_categories,
            subtitle: `${stats.total_filter_groups ?? 0} grupos de filtro`,
            icon: BarChart3,
        },
        {
            title: 'Artistas',
            value: stats.total_artists,
            subtitle: 'Artistas únicos',
            icon: Users,
        },
        {
            title: 'Armazenamento',
            value: formatFileSize(stats.total_file_size_mb * 1024 * 1024),
            subtitle: 'Espaço utilizado',
            icon: HardDrive,
        },
        {
            title: 'Com YouTube',
            value: stats.musics_with_youtube,
            subtitle: 'Músicas com links',
            icon: Youtube,
        }
    ]

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {cards.map((card, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {card.title}
                        </CardTitle>
                        <card.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {typeof card.value === 'string' ? card.value : card.value.toLocaleString('pt-BR')}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {card.subtitle}
                        </p>
                    </CardContent>
                </Card>
            ))}

            {stats.largest_list && (
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Maior Lista
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.largest_list.count}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                            {stats.largest_list.name}
                        </p>
                    </CardContent>
                </Card>
            )}

            {stats.most_popular_category && (
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Categoria Popular
                        </CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.most_popular_category.count}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                            {stats.most_popular_category.name}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
