'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { dashboardApi, handleApiError } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1']

export function DashboardCharts() {
    const [categories, setCategories] = useState<string[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string>('')
    const [topSongs, setTopSongs] = useState<any[]>([])
    const [topArtists, setTopArtists] = useState<any[]>([])
    const [uploadsData, setUploadsData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingSongs, setIsLoadingSongs] = useState(false)

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (selectedCategory) {
            loadTopSongs()
        }
    }, [selectedCategory])

    const loadInitialData = async () => {
        try {
            setIsLoading(true)

            // Carregar categorias das sugestões
            const response = await fetch('/api/filters/suggestions')
            const filtersData = await response.json()
            const categoriesList = filtersData.categories || []
            setCategories(categoriesList)

            // Definir primeira categoria como padrão
            if (categoriesList.length > 0) {
                setSelectedCategory(categoriesList[0])
            }

            // Carregar dados paralelos
            const [artistsData, timelineData] = await Promise.all([
                dashboardApi.getTopArtists(),
                dashboardApi.getUploadsTimeline()
            ])

            setTopArtists(artistsData.artists || [])
            setUploadsData(timelineData.timeline || [])
        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }

    const loadTopSongs = async () => {
        if (!selectedCategory) return

        try {
            setIsLoadingSongs(true)
            const data = await dashboardApi.getTopSongsByCategory(selectedCategory)
            setTopSongs(data.songs || [])
        } catch (error) {
            console.error('Erro ao carregar top músicas:', handleApiError(error))
        } finally {
            setIsLoadingSongs(false)
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

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top 5 Músicas por Categoria */}
                <Card>
                    <CardHeader>
                        <CardTitle>Músicas por Categoria</CardTitle>
                        <CardDescription>
                            Top 5 músicas mais usadas por categoria
                        </CardDescription>
                        <div className="flex items-center gap-2">
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Selecionar categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem key={category} value={category}>
                                            {category}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingSongs ? (
                            <div className="space-y-3">
                                {[...Array(5)].map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {topSongs.length > 0 ? (
                                    topSongs.map((song, index) => (
                                        <div key={song.id} className="flex items-center justify-between p-3 rounded-lg border">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <Link href={`/music/${song.id}`} className="font-medium hover:text-primary">
                                                        {song.song_name}
                                                    </Link>
                                                    <p className="text-sm text-muted-foreground">
                                                        {song.artist}
                                                        {song.musical_key && (
                                                            <Badge variant="outline" className="ml-2 text-xs">
                                                                {song.musical_key}
                                                            </Badge>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className="text-xs">
                                                {song.usage_count} uso{song.usage_count !== 1 ? 's' : ''}
                                            </Badge>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-muted-foreground py-8">
                                        Nenhuma música encontrada para esta categoria
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Top 5 Artistas */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Artistas</CardTitle>
                        <CardDescription>
                            Artistas com mais músicas no sistema
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {topArtists.length > 0 ? (
                                topArtists.map((artist, index) => (
                                    <div key={artist.artist} className="flex items-center justify-between p-3 rounded-lg border">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-xs font-bold">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="font-medium">{artist.artist}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {artist.song_count} música{artist.song_count !== 1 ? 's' : ''}
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    Nenhum artista encontrado
                                </p>
                            )}
                        </div>
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
                        <AreaChart data={uploadsData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="month_name"
                                fontSize={12}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis />
                            <Tooltip
                                labelFormatter={(label) => label}
                                formatter={(value, name) => [value, 'Uploads']}
                            />
                            <Area
                                type="monotone"
                                dataKey="upload_count"
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