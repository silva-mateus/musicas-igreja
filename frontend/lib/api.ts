// API client mapped to backend real endpoints (fetch-based)

import type {
    User,
    MusicFile,
    MusicList,
    DashboardStats,
    ChartData,
    ApiResponse,
    AuthResponse,
    PaginatedResponse,
    SearchFilters,
    PaginationParams,
} from '@/types'

const BASE = '/api'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
            'Content-Type': init?.body instanceof FormData ? undefined as any : 'application/json',
            ...(init?.headers || {}),
        } as any,
        cache: 'no-store',
    })
    if (!res.ok) {
        let message = res.statusText
        try {
            const data = await res.json()
            message = data?.error || data?.message || message
        } catch { }
        throw new Error(message)
    }
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return (await res.json()) as T
    return (await res.text()) as unknown as T
}



// ============ MUSIC / FILES ============
export const musicApi = {
    async search(
        filters: SearchFilters = {},
        pagination: PaginationParams = { page: 1, limit: 20 }
    ): Promise<PaginatedResponse<MusicFile>> {
        const params = new URLSearchParams()
        params.append('page', String(pagination.page || 1))
        params.append('per_page', String(pagination.limit || 20))
        if (filters.title) params.append('q', filters.title)
        if (filters.artist) params.append('q', filters.artist)
        if (filters.category) params.append('category', filters.category)
        if (filters.liturgical_time) params.append('liturgical_time', filters.liturgical_time)

        const data = await request<{ files: any[]; pagination: { page: number; per_page: number; total: number; total_pages: number } }>(
            `/files?${params.toString()}`
        )

        const mapped: PaginatedResponse<MusicFile> = {
            data: (data.files || []).map((f: any) => ({
                id: f.id,
                original_name: f.original_name,
                filename: f.filename,
                title: f.song_name || f.filename?.replace('.pdf', ''),
                artist: f.artist || undefined,
                category: f.primary_category || (Array.isArray(f.categories) ? f.categories[0] : undefined),
                liturgical_time: f.primary_liturgical_time || undefined,
                categories: Array.isArray(f.categories) && f.categories.length
                    ? f.categories
                    : (f.primary_category ? [f.primary_category] : []),
                liturgical_times: Array.isArray(f.liturgical_times) && f.liturgical_times.length
                    ? f.liturgical_times
                    : (f.primary_liturgical_time ? [f.primary_liturgical_time] : []),
                musical_key: f.musical_key || undefined,
                file_size: f.file_size || 0,
                pages: f.page_count || 0,
                upload_date: f.upload_date,
                uploaded_by: 0,
                youtube_link: f.youtube_link || undefined,
                observations: f.description || undefined,
                duplicate_of: undefined,
                is_duplicate: false,
            })),
            pagination: {
                page: data.pagination?.page || 1,
                limit: data.pagination?.per_page || (pagination.limit || 20),
                total: data.pagination?.total || 0,
                pages: data.pagination?.total_pages || 1,
            },
        }
        return mapped
    },

    async getMusic(id: number): Promise<MusicFile> {
        const data = await request<{ success: boolean; file: any }>(`/files/${id}`)
        const f = data.file
        return {
            id: f.id,
            original_name: f.original_name,
            filename: f.filename,
            title: f.song_name || f.filename?.replace('.pdf', ''),
            artist: f.artist || undefined,
            category: f.primary_category || (Array.isArray(f.categories) ? f.categories[0] : undefined),
            liturgical_time: f.primary_liturgical_time || undefined,
            categories: Array.isArray(f.categories) && f.categories.length
                ? f.categories
                : (f.primary_category ? [f.primary_category] : []),
            liturgical_times: Array.isArray(f.liturgical_times) && f.liturgical_times.length
                ? f.liturgical_times
                : (f.primary_liturgical_time ? [f.primary_liturgical_time] : []),
            musical_key: f.musical_key || undefined,
            file_size: f.file_size || 0,
            pages: f.page_count || 0,
            upload_date: f.upload_date,
            uploaded_by: 0,
            youtube_link: f.youtube_link || undefined,
            observations: f.description || undefined,
            duplicate_of: undefined,
            is_duplicate: false,
        }
    },

    async updateMusic(id: number, data: Partial<MusicFile>): Promise<ApiResponse> {
        const payload: any = {
            song_name: data.title,
            artist: data.artist,
            musical_key: data.musical_key,
            youtube_link: data.youtube_link,
            description: data.observations,
            categories: data.categories || (data.category ? [data.category] : []),
            liturgical_times: data.liturgical_times || (data.liturgical_time ? [data.liturgical_time] : []),
        }
        return await request<ApiResponse>(`/files/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        })
    },

    async deleteMusic(id: number): Promise<ApiResponse> {
        return await request<ApiResponse>(`/files/${id}`, { method: 'DELETE' })
    },

    async downloadMusic(id: number): Promise<Blob> {
        const res = await fetch(`${BASE}/files/${id}/download`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao baixar')
        return await res.blob()
    },

    async uploadMusics(
        files: FileList | File[],
        onProgress?: (progress: number) => void,
        metadata?: Array<{
            title?: string
            artist?: string
            category?: string // Legacy single category
            liturgical_time?: string // Legacy single liturgical time
            categories?: string[] // Multiple categories
            liturgical_times?: string[] // Multiple liturgical times
            musical_key?: string
            youtube_link?: string
            observations?: string
            new_categories?: string[]
            new_liturgical_times?: string[]
        }>
    ): Promise<any> {
        const arr = Array.from(files)
        const results: any[] = []
        let processed = 0
        for (let i = 0; i < arr.length; i++) {
            const form = new FormData()
            form.append('file', arr[i])
            const meta = metadata?.[i]

            console.log('📋 [UPLOAD] File metadata:', meta)

            if (meta?.title) form.append('song_name', meta.title)
            if (meta?.artist) form.append('artist', meta.artist)
            if (meta?.musical_key) form.append('musical_key', meta.musical_key)
            if (meta?.youtube_link) form.append('youtube_link', meta.youtube_link)
            if (meta?.observations) form.append('description', meta.observations)

            // Enviar múltiplas categorias
            if (meta?.categories?.length) {
                meta.categories.forEach(cat => form.append('categories', cat))
            } else if (meta?.category) {
                // Fallback para compatibilidade
                form.append('categories', meta.category)
            }

            // Enviar múltiplos tempos litúrgicos
            if (meta?.liturgical_times?.length) {
                meta.liturgical_times.forEach(time => form.append('liturgical_times', time))
            } else if (meta?.liturgical_time) {
                // Fallback para compatibilidade
                form.append('liturgical_times', meta.liturgical_time)
            }

            // Adicionar novas categorias e tempos litúrgicos se existirem
            if (meta?.new_categories?.length) {
                meta.new_categories.forEach(cat => form.append('new_categories', cat))
            }
            if (meta?.new_liturgical_times?.length) {
                meta.new_liturgical_times.forEach(time => form.append('new_liturgical_times', time))
            }

            console.log('📤 [UPLOAD] Form data keys:', Array.from(form.keys()))

            const res = await fetch(`${BASE}/files`, { method: 'POST', body: form })

            if (!res.ok) {
                const errorText = await res.text()
                console.error('Upload error:', res.status, res.statusText, errorText)
                throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
            }

            const data = await res.json()
            results.push(data)
            processed++
            if (onProgress) onProgress(Math.round((processed * 100) / arr.length))
        }
        return { message: 'ok', files: results }
    },
}

// ============ LISTS (merge_lists) ============
export const listsApi = {
    async getLists(
        _pagination: PaginationParams = { page: 1, limit: 20 },
        _search?: string
    ): Promise<PaginatedResponse<MusicList>> {
        console.log('🔍 [API] listsApi.getLists called')

        const lists = await request<Array<{ id: number; name: string; observations: string | null; created_date: string; updated_date: string; file_count: number }>>('/merge_lists')
        console.log('✅ [API] Raw response from backend:', lists.length, 'lists')

        const mapped = {
            data: lists.map(l => ({
                id: l.id,
                name: l.name,
                observations: l.observations || '',
                created_date: l.created_date,
                updated_date: l.updated_date,
                file_count: l.file_count,
                items: []
            } as MusicList)),
            pagination: { page: 1, limit: lists.length, total: lists.length, pages: 1 },
        }

        console.log('🎯 [API] Returning', mapped.data.length, 'lists')
        return mapped
    },

    async getList(id: number): Promise<MusicList> {
        const data = await request<{ success: boolean; list: any }>(`/merge_lists/${id}`)
        const list = data.list
        return {
            id: list.id,
            name: list.name,
            observations: list.observations,
            created_date: list.created_date,
            updated_date: list.updated_date,
            items: (list.items || []).map((it: any) => ({
                id: it.item_id,
                list_id: list.id,
                music_id: it.file.id,
                position: it.order_position,
                music: {
                    id: it.file.id,
                    filename: it.file.filename,
                    original_name: it.file.filename,
                    title: it.file.song_name || it.file.filename?.replace('.pdf', ''),
                    artist: it.file.artist,
                    musical_key: it.file.musical_key,
                    file_size: 0,
                    upload_date: '',
                    uploaded_by: 0,
                    is_duplicate: false,
                } as any,
            }))
        }
    },

    async createList(name: string, observations?: string): Promise<{ message: string; list_id: number }> {
        return await request<{ message: string; list_id: number }>('/merge_lists', {
            method: 'POST',
            body: JSON.stringify({ name, observations }),
        })
    },

    async updateList(id: number, data: Partial<MusicList>): Promise<ApiResponse> {
        return await request<ApiResponse>(`/merge_lists/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name: data.name, observations: data.observations }),
        })
    },

    async deleteList(id: number): Promise<ApiResponse> {
        return await request<ApiResponse>(`/merge_lists/${id}`, { method: 'DELETE' })
    },

    async addMusicToList(listId: number, musicId: number): Promise<ApiResponse> {
        return await request<ApiResponse>(`/merge_lists/${listId}/items`, {
            method: 'POST',
            body: JSON.stringify({ file_ids: [musicId] }),
        })
    },

    async removeMusicFromList(_listId: number, itemId: number): Promise<ApiResponse> {
        return await request<ApiResponse>(`/merge_list_items/${itemId}`, { method: 'DELETE' })
    },

    async reorderList(listId: number, items: Array<{ id: number }>): Promise<ApiResponse> {
        const item_order = items.map(i => i.id)
        return await request<ApiResponse>(`/merge_lists/${listId}/reorder`, {
            method: 'POST',
            body: JSON.stringify({ item_order }),
        })
    },

    async duplicateList(listId: number, newName: string): Promise<{ success: boolean; new_list_id: number; items_copied: number; message: string }> {
        return await request<{ success: boolean; new_list_id: number; items_copied: number; message: string }>(`/merge_lists/${listId}/duplicate`, {
            method: 'POST',
            body: JSON.stringify({ name: newName }),
        })
    },

    async mergeListPdfs(listId: number): Promise<Blob> {
        const res = await fetch(`${BASE}/merge_lists/${listId}/export`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao exportar')
        return await res.blob()
    },

    async generateReport(listId: number): Promise<{ success: boolean; report?: string; message?: string }> {
        return await request<{ success: boolean; report?: string; message?: string }>(`/generate_report/${listId}`)
    },
}




// ============ HEALTH ============
export const healthApi = {
    async check(): Promise<any> { return await request<any>('/health') },
}

// ============ CATEGORIES / LITURGICAL TIMES ============
export const categoriesApi = {
    async getCategories(): Promise<{ data: any[] }> {
        const data = await request<any[]>('/dashboard/get_categories')
        return { data }
    },
    async createCategory(name: string): Promise<ApiResponse> {
        return await request<ApiResponse>('/categories', { method: 'POST', body: JSON.stringify({ name }) })
    },
    async updateCategory(id: number, name: string): Promise<ApiResponse> {
        return await request<ApiResponse>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })
    },
    async deleteCategory(id: number): Promise<ApiResponse> {
        return await request<ApiResponse>(`/categories/${id}`, { method: 'DELETE' })
    },
}

export const liturgicalTimesApi = {
    async getLiturgicalTimes(): Promise<{ data: any[] }> {
        const data = await request<any[]>('/dashboard/get_liturgical_times')
        return { data }
    },
    async createLiturgicalTime(name: string): Promise<ApiResponse> {
        return await request<ApiResponse>('/liturgical_times', { method: 'POST', body: JSON.stringify({ name }) })
    },
    async updateLiturgicalTime(id: number, name: string): Promise<ApiResponse> {
        return await request<ApiResponse>(`/liturgical_times/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })
    },
    async deleteLiturgicalTime(id: number): Promise<ApiResponse> {
        return await request<ApiResponse>(`/liturgical_times/${id}`, { method: 'DELETE' })
    },
}

// Utility for downloads
export const downloadFile = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
}



export const handleApiError = (error: any): string => {
    if (error.message) return error.message
    return 'Erro desconhecido'
}

// ============ ADMIN / DISCOVERY API ============
export const adminApi = {
    async discoverEntities(): Promise<any> {
        return await request<any>('/admin/discovery', { method: 'GET' })
    },
    async registerEntities(entities: any): Promise<any> {
        return await request<any>('/admin/discovery', { method: 'POST', body: JSON.stringify({ entities }) })
    },
    async cleanupEntities(): Promise<any> {
        return await request<any>('/admin/cleanup', { method: 'POST' })
    },
}

// Dashboard API
export const dashboardApi = {
    async getStats(): Promise<any> {
        return await request<any>('/dashboard/stats', { method: 'GET' })
    },

    async getTopSongsByCategory(category: string): Promise<any> {
        return await request<any>(`/dashboard/top-songs-by-category?category=${encodeURIComponent(category)}`, { method: 'GET' })
    },

    async getTopArtists(): Promise<any> {
        return await request<any>('/dashboard/top-artists', { method: 'GET' })
    },

    async getUploadsTimeline(): Promise<any> {
        return await request<any>('/dashboard/uploads-timeline', { method: 'GET' })
    },

    async getArtists(): Promise<string[]> {
        return await request<string[]>('/dashboard/get_artists', { method: 'GET' })
    }
}

// Google Drive API
export const googleDriveApi = {
    async getAuthUrl(): Promise<any> {
        return await request<any>('/google-drive/auth-url', { method: 'GET', cache: 'no-store' as any })
    },

    async getStatus(): Promise<any> {
        const result = await request<any>('/google-drive/status', { method: 'GET', cache: 'no-store' as any })
        return result
    },

    async sync(): Promise<any> {
        return await request<any>('/google-drive/sync', { method: 'POST', cache: 'no-store' as any })
    },

    async getSettings(): Promise<any> {
        return await request<any>('/google-drive/settings', { method: 'GET', cache: 'no-store' as any })
    },

    async saveSettings(settings: any): Promise<any> {
        return await request<any>('/google-drive/settings', {
            method: 'POST',
            body: JSON.stringify(settings),
        })
    },

    async getDebugInfo(): Promise<any> {
        return await request<any>('/google-drive/debug', { method: 'GET', cache: 'no-store' as any })
    },

    async clearCache(): Promise<any> {
        return await request<any>('/google-drive/clear-cache', { method: 'POST', cache: 'no-store' as any })
    }
}

export default {}