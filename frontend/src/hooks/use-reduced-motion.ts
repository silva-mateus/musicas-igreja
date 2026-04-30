'use client'

import { useEffect, useState } from 'react'

/**
 * Hook to check if user prefers reduced motion
 * Returns true if user has set prefers-reduced-motion: reduce
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    // Check initial preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return prefersReducedMotion
}

/**
 * Utility function to get animation duration based on reduced motion preference
 */
export function getAnimationDuration(normal: number, reduced: number = 0): number {
  if (typeof window === 'undefined') return normal
  
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return prefersReduced ? reduced : normal
}

/**
 * Utility to conditionally apply animation classes
 */
export function withMotionRespect(
  normalClass: string, 
  reducedClass: string = ''
): string {
  if (typeof window === 'undefined') return normalClass
  
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return prefersReduced ? reducedClass : normalClass
}