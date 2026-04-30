'use client'

import { useState, useEffect } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

const breakpoints = {
    mobile: 767, // Below md breakpoint
    tablet: 1023, // md to lg breakpoint  
    desktop: 1024 // lg breakpoint and above
}

/**
 * Hook robusto para detectar breakpoint atual
 * Retorna 'mobile' | 'tablet' | 'desktop'
 */
export function useBreakpoint(): Breakpoint {
    const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop')

    useEffect(() => {
        const updateBreakpoint = () => {
            const width = window.innerWidth
            
            if (width <= breakpoints.mobile) {
                setBreakpoint('mobile')
            } else if (width <= breakpoints.tablet) {
                setBreakpoint('tablet')
            } else {
                setBreakpoint('desktop')
            }
        }

        // Set initial breakpoint
        updateBreakpoint()

        // Listen for window resize
        window.addEventListener('resize', updateBreakpoint)
        
        return () => window.removeEventListener('resize', updateBreakpoint)
    }, [])

    return breakpoint
}

/**
 * Hook para detectar especificamente se é mobile
 * Compatível com o hook existente useMobile()
 */
export function useIsMobile(): boolean {
    const breakpoint = useBreakpoint()
    return breakpoint === 'mobile'
}

/**
 * Hook para uso com media queries específicas
 * Útil para casos mais complexos
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false)

    useEffect(() => {
        const mediaQuery = window.matchMedia(query)
        setMatches(mediaQuery.matches)

        const handleChange = (e: MediaQueryListEvent) => {
            setMatches(e.matches)
        }

        mediaQuery.addEventListener('change', handleChange)
        
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [query])

    return matches
}