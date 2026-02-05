import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Stale time of 1 minute - data is considered fresh for 1 minute
                staleTime: 60 * 1000,
                // Cache time of 5 minutes - keep data in cache for 5 minutes
                gcTime: 5 * 60 * 1000,
                // Retry failed requests once
                retry: 1,
                // Refetch on window focus for fresh data
                refetchOnWindowFocus: true,
            },
        },
    })
}

// Singleton for browser
let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
    if (typeof window === 'undefined') {
        // Server: always make a new query client
        return makeQueryClient()
    } else {
        // Browser: make a new query client if we don't already have one
        if (!browserQueryClient) browserQueryClient = makeQueryClient()
        return browserQueryClient
    }
}
