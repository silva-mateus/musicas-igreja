import { useQuery } from '@tanstack/react-query'
import { dashboardApi, categoriesApi, customFiltersApi } from '@/lib/api'

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
    customFilterGroups: () => [...filtersKeys.all, 'customFilterGroups'] as const,
}

export function useDashboardStats() {
    return useQuery({
        queryKey: dashboardKeys.stats(),
        queryFn: () => dashboardApi.getStats(),
        staleTime: 2 * 60 * 1000,
    })
}

export function useTopArtists() {
    return useQuery({
        queryKey: dashboardKeys.topArtists(),
        queryFn: () => dashboardApi.getTopArtists(),
        staleTime: 5 * 60 * 1000,
    })
}

export function useTopSongsByCategory(category: string) {
    return useQuery({
        queryKey: dashboardKeys.topSongsByCategory(category),
        queryFn: () => dashboardApi.getTopSongsByCategory(category),
        enabled: !!category,
        staleTime: 5 * 60 * 1000,
    })
}

export function useUploadsTimeline() {
    return useQuery({
        queryKey: dashboardKeys.uploadsTimeline(),
        queryFn: () => dashboardApi.getUploadsTimeline(),
        staleTime: 5 * 60 * 1000,
    })
}

export function useArtists() {
    return useQuery({
        queryKey: dashboardKeys.artists(),
        queryFn: () => dashboardApi.getArtists(),
        staleTime: 5 * 60 * 1000,
    })
}

export function useCategories() {
    return useQuery({
        queryKey: filtersKeys.categories(),
        queryFn: async () => {
            const result = await categoriesApi.getCategories()
            return result.data
        },
        staleTime: 5 * 60 * 1000,
    })
}

export function useCustomFilterGroups() {
    return useQuery({
        queryKey: filtersKeys.customFilterGroups(),
        queryFn: async () => {
            const result = await customFiltersApi.getGroups()
            return result.groups
        },
        staleTime: 5 * 60 * 1000,
    })
}
