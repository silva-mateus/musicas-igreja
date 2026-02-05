import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listsApi } from '@/lib/api'
import type { PaginationParams, MusicList } from '@/types'

// Query keys for cache management
export const listsKeys = {
    all: ['lists'] as const,
    lists: () => [...listsKeys.all, 'list'] as const,
    list: (pagination?: PaginationParams, search?: string) => 
        [...listsKeys.lists(), { pagination, search }] as const,
    details: () => [...listsKeys.all, 'detail'] as const,
    detail: (id: number) => [...listsKeys.details(), id] as const,
}

// Hook for fetching all lists
export function useLists(
    pagination: PaginationParams = { page: 1, limit: 20 },
    search?: string
) {
    return useQuery({
        queryKey: listsKeys.list(pagination, search),
        queryFn: () => listsApi.getLists(pagination, search),
    })
}

// Hook for fetching a single list with items
export function useListDetail(id: number) {
    return useQuery({
        queryKey: listsKeys.detail(id),
        queryFn: () => listsApi.getList(id),
        enabled: id > 0,
    })
}

// Hook for creating a list
export function useCreateList() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ name, observations }: { name: string; observations?: string }) =>
            listsApi.createList(name, observations),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: listsKeys.lists() })
        },
    })
}

// Hook for updating a list
export function useUpdateList() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<MusicList> }) =>
            listsApi.updateList(id, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: listsKeys.lists() })
            queryClient.invalidateQueries({ queryKey: listsKeys.detail(variables.id) })
        },
    })
}

// Hook for deleting a list
export function useDeleteList() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: number) => listsApi.deleteList(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: listsKeys.lists() })
        },
    })
}

// Hook for adding music to a list
export function useAddMusicToList() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ listId, musicId }: { listId: number; musicId: number }) =>
            listsApi.addMusicToList(listId, musicId),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: listsKeys.detail(variables.listId) })
        },
    })
}

// Hook for removing music from a list
export function useRemoveMusicFromList() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ listId, itemId }: { listId: number; itemId: number }) =>
            listsApi.removeMusicFromList(listId, itemId),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: listsKeys.detail(variables.listId) })
        },
    })
}

// Hook for reordering list items
export function useReorderList() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ listId, items }: { listId: number; items: Array<{ id: number }> }) =>
            listsApi.reorderList(listId, items),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: listsKeys.detail(variables.listId) })
        },
    })
}

// Hook for duplicating a list
export function useDuplicateList() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ listId, newName }: { listId: number; newName: string }) =>
            listsApi.duplicateList(listId, newName),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: listsKeys.lists() })
        },
    })
}
