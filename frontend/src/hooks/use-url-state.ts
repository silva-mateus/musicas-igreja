'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useRef } from 'react'

type ParamValue = string | undefined

/**
 * Builds a new URLSearchParams from the current ones, applying a batch of updates.
 * Keys mapped to `undefined` are deleted; others are set.
 */
function applyUpdates(current: URLSearchParams, updates: Record<string, ParamValue>): URLSearchParams {
    const next = new URLSearchParams(current.toString())
    for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '') {
            next.delete(key)
        } else {
            next.set(key, value)
        }
    }
    return next
}

/**
 * Low-level hook: returns a `setParams` function that batch-updates
 * URL search params via `router.replace` (no new history entry, no scroll).
 */
export function useUrlParams() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const pendingRef = useRef<Record<string, ParamValue>>({})
    const rafRef = useRef<number | null>(null)

    const flush = useCallback(() => {
        const next = applyUpdates(searchParams, pendingRef.current)
        pendingRef.current = {}
        rafRef.current = null
        const qs = next.toString()
        router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    }, [searchParams, router, pathname])

    const setParams = useCallback(
        (updates: Record<string, ParamValue>) => {
            Object.assign(pendingRef.current, updates)
            if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(flush)
            }
        },
        [flush],
    )

    return { searchParams, setParams }
}

// ── Helpers for serialising filter values to/from URL strings ───────────

export function parseString(params: URLSearchParams, key: string): string | undefined {
    return params.get(key) ?? undefined
}

export function parseNumber(params: URLSearchParams, key: string): number | undefined {
    const v = params.get(key)
    if (v === null) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
}

export function parseBoolean(params: URLSearchParams, key: string): boolean | undefined {
    const v = params.get(key)
    if (v === null) return undefined
    return v === 'true'
}

export function parseCommaSeparated(params: URLSearchParams, key: string): string[] | undefined {
    const v = params.get(key)
    if (!v) return undefined
    const arr = v.split(',').filter(Boolean)
    return arr.length > 0 ? arr : undefined
}

export function serialiseCommaSeparated(arr: string | string[] | undefined): string | undefined {
    if (!arr) return undefined
    const list = Array.isArray(arr) ? arr : [arr]
    return list.length > 0 ? list.join(',') : undefined
}

export function serialiseBoolean(val: boolean | undefined): string | undefined {
    return val === undefined ? undefined : String(val)
}
