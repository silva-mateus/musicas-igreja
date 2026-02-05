import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { musicApi } from '@/lib/api'
import type { SearchFilters, PaginationParams, MusicFile } from '@/types'

// Query keys for cache management
export const musicKeys = {
    all: ['music'] as const,
    lists: () => [...musicKeys.all, 'list'] as const,
    list: (filters: SearchFilters, pagination: PaginationParams) => 
        [...musicKeys.lists(), { filters, pagination }] as const,
    details: () => [...musicKeys.all, 'detail'] as const,
    detail: (id: number) => [...musicKeys.details(), id] as const,
}

// Hook for fetching music list with filters and pagination
export function useMusic(
    filters: SearchFilters = {},
    pagination: PaginationParams = { page: 1, limit: 20 }
) {
    return useQuery({
        queryKey: musicKeys.list(filters, pagination),
        queryFn: () => musicApi.search(filters, pagination),
    })
}

// Hook for fetching a single music file
export function useMusicDetail(id: number) {
    return useQuery({
        queryKey: musicKeys.detail(id),
        queryFn: () => musicApi.getMusic(id),
        enabled: id > 0,
    })
}

// Hook for updating music
export function useUpdateMusic() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<MusicFile> }) =>
            musicApi.updateMusic(id, data),
        onSuccess: (_data, variables) => {
            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: musicKeys.lists() })
            queryClient.invalidateQueries({ queryKey: musicKeys.detail(variables.id) })
        },
    })
}

// Hook for deleting music
export function useDeleteMusic() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: number) => musicApi.deleteMusic(id),
        onSuccess: () => {
            // Invalidate all music queries
            queryClient.invalidateQueries({ queryKey: musicKeys.lists() })
        },
    })
}

// Hook for uploading music
export function useUploadMusic() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({
            files,
            onProgress,
            metadata,
        }: {
            files: FileList | File[]
            onProgress?: (progress: number) => void
            metadata?: Parameters<typeof musicApi.uploadMusics>[2]
        }) => musicApi.uploadMusics(files, onProgress, metadata),
        onSuccess: () => {
            // Invalidate music queries to refresh list
            queryClient.invalidateQueries({ queryKey: musicKeys.lists() })
        },
    })
}
