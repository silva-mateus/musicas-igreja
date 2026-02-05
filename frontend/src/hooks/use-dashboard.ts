import { useQuery } from '@tanstack/react-query'
import { dashboardApi, categoriesApi, liturgicalTimesApi } from '@/lib/api'

// Query keys for cache management
export const dashboardKeys = {
    all: ['dashboard'] as const,
    stats: () => [...dashboardKeys.all, 'stats'] as const,
    topArtists: () => [...dashboardKeys.all, 'topArtists'] as const,
    topSongsByCategory: (category: string) => [...dashboardKeys.all, 'topSongs', category] as const,
    uploadsTimeline: () => [...dashboardKeys.all, 'uploadsTimeline'] as const,
    artists: () => [...dashboardKeys.all, 'artists'] as const,
}

export const filtersKeys = {
    all: ['filters'] as const,
    categories: () => [...filtersKeys.all, 'categories'] as const,
    liturgicalTimes: () => [...filtersKeys.all, 'liturgicalTimes'] as const,
}

// Hook for fetching dashboard stats
export function useDashboardStats() {
    return useQuery({
        queryKey: dashboardKeys.stats(),
        queryFn: () => dashboardApi.getStats(),
        staleTime: 2 * 60 * 1000, // 2 minutes
    })
}

// Hook for fetching top artists
export function useTopArtists() {
    return useQuery({
        queryKey: dashboardKeys.topArtists(),
        queryFn: () => dashboardApi.getTopArtists(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching top songs by category
export function useTopSongsByCategory(category: string) {
    return useQuery({
        queryKey: dashboardKeys.topSongsByCategory(category),
        queryFn: () => dashboardApi.getTopSongsByCategory(category),
        enabled: !!category,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching uploads timeline
export function useUploadsTimeline() {
    return useQuery({
        queryKey: dashboardKeys.uploadsTimeline(),
        queryFn: () => dashboardApi.getUploadsTimeline(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching artists list
export function useArtists() {
    return useQuery({
        queryKey: dashboardKeys.artists(),
        queryFn: () => dashboardApi.getArtists(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching categories
export function useCategories() {
    return useQuery({
        queryKey: filtersKeys.categories(),
        queryFn: async () => {
            const result = await categoriesApi.getCategories()
            return result.data
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching liturgical times
export function useLiturgicalTimes() {
    return useQuery({
        queryKey: filtersKeys.liturgicalTimes(),
        queryFn: async () => {
            const result = await liturgicalTimesApi.getLiturgicalTimes()
            return result.data
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}
