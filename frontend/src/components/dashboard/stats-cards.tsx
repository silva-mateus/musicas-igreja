'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
            color: 'text-blue-500'
        },
        {
            title: 'Listas Criadas',
            value: stats.total_lists,
            subtitle: `${stats.avg_musics_per_list} músicas/lista`,
            icon: List,
            color: 'text-green-500'
        },
        {
            title: 'Categorias',
            value: stats.total_categories,
            subtitle: `${stats.total_liturgical_times} tempos litúrgicos`,
            icon: BarChart3,
            color: 'text-purple-500'
        },
        {
            title: 'Artistas',
            value: stats.total_artists,
            subtitle: 'Artistas únicos',
            icon: Users,
            color: 'text-orange-500'
        },
        {
            title: 'Armazenamento',
            value: formatFileSize(stats.total_file_size_mb * 1024 * 1024),
            subtitle: 'Espaço utilizado',
            icon: HardDrive,
            color: 'text-red-500'
        },
        {
            title: 'Com YouTube',
            value: stats.musics_with_youtube,
            subtitle: 'Músicas com links',
            icon: Youtube,
            color: 'text-red-600'
        }
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {card.title}
                        </CardTitle>
                        <card.icon className={`h-4 w-4 ${card.color}`} />
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

            {/* Maior Lista Card */}
            {stats.largest_list && (
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Maior Lista
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-cyan-500" />
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

            {/* Categoria Popular Card */}
            {stats.most_popular_category && (
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Categoria Popular
                        </CardTitle>
                        <FileText className="h-4 w-4 text-pink-500" />
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