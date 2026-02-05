// API client mapped to backend real endpoints (fetch-based)

import type {
    User,
    MusicFile,
    MusicList,
    DashboardStats,
    ChartData,
    ApiResponse,
    AddMusicToListResponse,
    AuthResponse,
    PaginatedResponse,
    SearchFilters,
    PaginationParams,
    SystemEvent,
    AuditLog,
    SystemMetric,
    SystemHealth,
    MonitoringResponse,
    AlertConfiguration,
    AlertConfigurationInput,
} from '@/types'

const BASE = '/api'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        credentials: 'include', // Always include cookies for session auth
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
        if (filters.category) {
            // Support both single category and array of categories
            const categories = Array.isArray(filters.category) ? filters.category : [filters.category]
            categories.forEach(cat => params.append('category', cat))
        }
        if (filters.liturgical_time) {
            // Support both single time and array of times
            const times = Array.isArray(filters.liturgical_time) ? filters.liturgical_time : [filters.liturgical_time]
            times.forEach(time => params.append('liturgical_time', time))
        }
        if (filters.artist) {
            // Support both single artist and array of artists
            const artists = Array.isArray(filters.artist) ? filters.artist : [filters.artist]
            artists.forEach(artist => params.append('artist', artist))
        }

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
        const res = await fetch(`${BASE}/files/${id}/download`, { 
            cache: 'no-store',
            credentials: 'include'
        })
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
            new_artist?: string
        }>
    ): Promise<any> {
        const arr = Array.from(files)
        const results: any[] = []
        let processed = 0
        for (let i = 0; i < arr.length; i++) {
            const form = new FormData()
            form.append('file', arr[i])
            const meta = metadata?.[i]

            // File metadata prepared

            if (meta?.title) form.append('song_name', meta.title)
            if (meta?.artist) form.append('artist', meta.artist)
            if (meta?.new_artist) form.append('new_artist', meta.new_artist)
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

            // Form data ready for upload

            try {
                const res = await fetch(`${BASE}/files`, { 
                    method: 'POST', 
                    body: form,
                    credentials: 'include'  // Send session cookies
                })
                const data = await res.json()
                
                // Upload response received
                
                // Backend returns FileUploadResultDto directly
                // Check if it's already in the correct format or wrapped
                if (data.filename || data.original_name || data.status) {
                    // Direct FileUploadResultDto response
                    results.push(data)
                } else if (data.success && data.data) {
                    // Wrapped response { success: true, data: {...} }
                    results.push(data.data)
                } else {
                    // Unknown format, try to extract what we can
                    results.push({
                        filename: arr[i].name,
                        original_name: arr[i].name,
                        size: arr[i].size,
                        status: 'error',
                        message: 'Formato de resposta desconhecido'
                    })
                }
                
            } catch (error) {
                console.error('Upload error:', error)
                // Add error result for this file
                results.push({
                    filename: arr[i].name,
                    original_name: arr[i].name,
                    size: arr[i].size,
                    status: 'error',
                    message: error instanceof Error ? error.message : 'Erro desconhecido'
                })
            }
            
            processed++
            if (onProgress) onProgress(Math.round((processed * 100) / arr.length))
        }
        return { message: 'Upload concluído', files: results }
    },
}

// ============ LISTS (merge_lists) ============
export const listsApi = {
    async getLists(
        _pagination: PaginationParams = { page: 1, limit: 20 },
        _search?: string
    ): Promise<PaginatedResponse<MusicList>> {
        // Fetching lists

        const lists = await request<Array<{ id: number; name: string; observations: string | null; created_date: string; updated_date: string; file_count: number }>>('/merge_lists')
        // Lists response received

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

        // Returning mapped lists
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
                    category: it.file.category || (it.file.categories?.[0]) || undefined,
                    liturgical_time: it.file.liturgical_time || (it.file.liturgical_times?.[0]) || undefined,
                    musical_key: it.file.musical_key,
                    youtube_link: it.file.youtube_link,
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

    async addMusicToList(listId: number, musicId: number): Promise<AddMusicToListResponse> {
        return await request<AddMusicToListResponse>(`/merge_lists/${listId}/items`, {
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
        const res = await fetch(`${BASE}/merge_lists/${listId}/export`, { 
            cache: 'no-store',
            credentials: 'include'
        })
        if (!res.ok) throw new Error('Falha ao exportar')
        return await res.blob()
    },

    async generateReport(listId: number): Promise<{ success: boolean; report?: string; message?: string }> {
        return await request<{ success: boolean; report?: string; message?: string }>(`/merge_lists/${listId}/report`, { method: 'GET' })
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

// ============ AUTH ============
export const authApi = {
    async login(username: string, password: string): Promise<any> {
        return await request<any>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
            credentials: 'include',
        })
    },

    async logout(): Promise<any> {
        return await request<any>('/auth/logout', {
            method: 'POST',
            credentials: 'include',
        })
    },

    async getCurrentUser(): Promise<any> {
        return await request<any>('/auth/me', {
            method: 'GET',
            credentials: 'include',
        })
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<any> {
        return await request<any>('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
            credentials: 'include',
        })
    },

    async updateProfile(fullName: string): Promise<any> {
        return await request<any>('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify({ full_name: fullName }),
            credentials: 'include',
        })
    }
}

// ============ ROLES ============
export const rolesApi = {
    async getAll(): Promise<any> {
        return await request<any>('/roles', { method: 'GET', credentials: 'include' })
    },

    async getById(id: number): Promise<any> {
        return await request<any>(`/roles/${id}`, { method: 'GET', credentials: 'include' })
    },

    async create(data: {
        name: string
        display_name: string
        description?: string
        priority?: number
        is_default?: boolean
        permissions?: {
            can_view_music?: boolean
            can_download_music?: boolean
            can_edit_music_metadata?: boolean
            can_upload_music?: boolean
            can_delete_music?: boolean
            can_manage_lists?: boolean
            can_manage_categories?: boolean
            can_manage_users?: boolean
            can_manage_roles?: boolean
            can_access_admin?: boolean
        }
    }): Promise<any> {
        return await request<any>('/roles', {
            method: 'POST',
            body: JSON.stringify(data),
            credentials: 'include',
        })
    },

    async update(id: number, data: {
        display_name?: string
        description?: string
        priority?: number
        is_default?: boolean
        permissions?: {
            can_view_music?: boolean
            can_download_music?: boolean
            can_edit_music_metadata?: boolean
            can_upload_music?: boolean
            can_delete_music?: boolean
            can_manage_lists?: boolean
            can_manage_categories?: boolean
            can_manage_users?: boolean
            can_manage_roles?: boolean
            can_access_admin?: boolean
        }
    }): Promise<any> {
        return await request<any>(`/roles/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
            credentials: 'include',
        })
    },

    async delete(id: number): Promise<any> {
        return await request<any>(`/roles/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        })
    },

    async setDefault(id: number): Promise<any> {
        return await request<any>(`/roles/${id}/set-default`, {
            method: 'POST',
            credentials: 'include',
        })
    },
}

// ============ USERS (Admin only) ============
export const usersApi = {
    async getAll(): Promise<any> {
        return await request<any>('/users', { method: 'GET', credentials: 'include' })
    },

    async create(username: string, fullName: string, password: string, role: string): Promise<any> {
        return await request<any>('/users', {
            method: 'POST',
            body: JSON.stringify({ username, full_name: fullName, password, role }),
            credentials: 'include',
        })
    },

    async updateRole(userId: number, role: string): Promise<any> {
        return await request<any>(`/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role }),
            credentials: 'include',
        })
    },

    async resetPassword(userId: number, newPassword: string): Promise<any> {
        return await request<any>(`/users/${userId}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ new_password: newPassword }),
            credentials: 'include',
        })
    },

    async deactivate(userId: number): Promise<any> {
        return await request<any>(`/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include',
        })
    },

    async activate(userId: number): Promise<any> {
        return await request<any>(`/users/${userId}/activate`, {
            method: 'PUT',
            credentials: 'include',
        })
    },

    async deletePermanently(userId: number): Promise<any> {
        return await request<any>(`/users/${userId}/permanent`, {
            method: 'DELETE',
            credentials: 'include',
        })
    }
}

// ============ MONITORING ============
export const monitoringApi = {
    async getAlerts(): Promise<MonitoringResponse<SystemEvent[]>> {
        return await request<MonitoringResponse<SystemEvent[]>>('/monitoring/alerts', {
            credentials: 'include',
        })
    },

    async getAlertCount(): Promise<{ count: number }> {
        return await request<{ count: number }>('/monitoring/alerts/count', {
            credentials: 'include',
        })
    },

    async markAlertAsRead(alertId: number): Promise<{ success: boolean }> {
        return await request<{ success: boolean }>(`/monitoring/alerts/${alertId}/read`, {
            method: 'POST',
            credentials: 'include',
        })
    },

    async getEvents(filters?: {
        event_type?: string
        severity?: string
        user_id?: number
        start_date?: string
        end_date?: string
        page?: number
        limit?: number
    }): Promise<MonitoringResponse<SystemEvent[]>> {
        const params = new URLSearchParams()
        if (filters?.event_type) params.append('event_type', filters.event_type)
        if (filters?.severity) params.append('severity', filters.severity)
        if (filters?.user_id) params.append('user_id', String(filters.user_id))
        if (filters?.start_date) params.append('start_date', filters.start_date)
        if (filters?.end_date) params.append('end_date', filters.end_date)
        if (filters?.page) params.append('page', String(filters.page))
        if (filters?.limit) params.append('limit', String(filters.limit))

        return await request<MonitoringResponse<SystemEvent[]>>(
            `/monitoring/events?${params.toString()}`,
            { credentials: 'include' }
        )
    },

    async getAuditLogs(filters?: {
        action?: string
        entity_type?: string
        user_id?: number
        start_date?: string
        end_date?: string
        page?: number
        limit?: number
    }): Promise<MonitoringResponse<AuditLog[]>> {
        const params = new URLSearchParams()
        if (filters?.action) params.append('action', filters.action)
        if (filters?.entity_type) params.append('entity_type', filters.entity_type)
        if (filters?.user_id) params.append('user_id', String(filters.user_id))
        if (filters?.start_date) params.append('start_date', filters.start_date)
        if (filters?.end_date) params.append('end_date', filters.end_date)
        if (filters?.page) params.append('page', String(filters.page))
        if (filters?.limit) params.append('limit', String(filters.limit))

        return await request<MonitoringResponse<AuditLog[]>>(
            `/monitoring/audit?${params.toString()}`,
            { credentials: 'include' }
        )
    },

    async getMetrics(filters?: {
        metric_type?: string
        start_date?: string
        end_date?: string
        limit?: number
    }): Promise<MonitoringResponse<SystemMetric[]>> {
        const params = new URLSearchParams()
        if (filters?.metric_type) params.append('metric_type', filters.metric_type)
        if (filters?.start_date) params.append('start_date', filters.start_date)
        if (filters?.end_date) params.append('end_date', filters.end_date)
        if (filters?.limit) params.append('limit', String(filters.limit))

        return await request<MonitoringResponse<SystemMetric[]>>(
            `/monitoring/metrics?${params.toString()}`,
            { credentials: 'include' }
        )
    },

    async getHealthExtended(): Promise<MonitoringResponse<SystemHealth>> {
        return await request<MonitoringResponse<SystemHealth>>('/monitoring/health-extended', {
            credentials: 'include',
        })
    },
}

// ============ ALERT CONFIGURATIONS ============
export const alertConfigApi = {
    async getAll(): Promise<MonitoringResponse<AlertConfiguration[]>> {
        return await request<MonitoringResponse<AlertConfiguration[]>>('/alert_configurations', {
            credentials: 'include',
        })
    },

    async getById(id: number): Promise<MonitoringResponse<AlertConfiguration>> {
        return await request<MonitoringResponse<AlertConfiguration>>(`/alert_configurations/${id}`, {
            credentials: 'include',
        })
    },

    async create(config: AlertConfigurationInput): Promise<MonitoringResponse<AlertConfiguration>> {
        return await request<MonitoringResponse<AlertConfiguration>>('/alert_configurations', {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify(config),
        })
    },

    async update(id: number, config: Partial<AlertConfigurationInput>): Promise<MonitoringResponse<AlertConfiguration>> {
        return await request<MonitoringResponse<AlertConfiguration>>(`/alert_configurations/${id}`, {
            method: 'PUT',
            credentials: 'include',
            body: JSON.stringify(config),
        })
    },

    async delete(id: number): Promise<{ success: boolean }> {
        return await request<{ success: boolean }>(`/alert_configurations/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        })
    },
}

export function handleApiError(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    return 'Ocorreu um erro desconhecido'
}

export default {}