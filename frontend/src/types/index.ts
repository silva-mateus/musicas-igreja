// Auth types
export interface User {
    id: number
    username: string
    email: string
    role: 'admin' | 'user'
    created_at?: string
    last_login?: string
    is_active?: boolean
}

export interface AuthResponse {
    message: string
    user: User
    redirect_to_login?: boolean
}

export interface LoginRequest {
    username: string
    password: string
}

// Dashboard types
export interface DashboardStats {
    total_musics: number
    total_lists: number
    total_categories: number
    total_liturgical_times: number
    total_artists: number
    total_file_size_mb: number
    total_pages: number
    musics_with_youtube: number
    avg_musics_per_list: number
    largest_list?: {
        name: string
        count: number
    }
    most_popular_category?: {
        name: string
        count: number
    }
}

// Music/PDF types
export interface MusicFile {
    id: number
    original_name: string
    filename: string
    title?: string
    artist?: string
    category?: string // Primary category (for backward compatibility)
    liturgical_time?: string // Primary liturgical time (for backward compatibility)
    categories?: string[] // All categories
    liturgical_times?: string[] // All liturgical times
    musical_key?: string
    file_size: number
    pages?: number
    upload_date: string
    uploaded_by: number
    youtube_link?: string
    observations?: string
    duplicate_of?: number
    is_duplicate: boolean
}

export interface MusicList {
    id: number
    name: string
    observations?: string
    created_date: string
    updated_date?: string
    items?: MusicListItem[]
    file_count?: number
}

export interface MusicListItem {
    id: number
    list_id: number
    music_id: number
    position: number
    music?: MusicFile
}

// Search and Filter types
export interface SearchFilters {
    title?: string
    artist?: string
    category?: string
    liturgical_time?: string
    musical_key?: string
    has_youtube?: boolean
}

export interface PaginationParams {
    page?: number
    limit?: number
    sort_by?: string
    sort_order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
    data: T[]
    pagination: {
        page: number
        limit: number
        total: number
        pages: number
    }
}

// API Response types
export interface ApiResponse {
    message: string
    error?: string
}

export interface AddMusicToListResponse {
    success: boolean
    added: number
    new_item_ids: number[]
    error?: string
}

export interface UploadFileResult {
    filename: string
    original_name: string
    size: number
    status: 'success' | 'duplicate' | 'error'
    duplicate_of?: string
    message?: string
}

export interface UploadResponse extends ApiResponse {
    files?: UploadFileResult[]
}

// Chart data types
export interface ChartData {
    labels: string[]
    datasets: {
        label: string
        data: number[]
        backgroundColor?: string[]
        borderColor?: string
        borderWidth?: number
        fill?: boolean
    }[]
}