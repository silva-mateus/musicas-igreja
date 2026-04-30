'use client'

/**
 * Haptic feedback utilities for mobile interactions
 */

export type HapticType = 'light' | 'medium' | 'heavy' | 'error' | 'success' | 'warning' | 'selection'

/**
 * Provides haptic feedback with the given pattern
 */
export function hapticFeedback(type: HapticType = 'light'): void {
  // Check if vibration is supported
  if (!('vibrate' in navigator)) {
    return
  }

  // Check if user prefers reduced motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  let pattern: number | number[] = 0

  switch (type) {
    case 'light':
      pattern = 10
      break
    case 'medium':
      pattern = 20
      break
    case 'heavy':
      pattern = 40
      break
    case 'error':
      pattern = [100, 50, 100]
      break
    case 'success':
      pattern = [50, 30, 50, 30, 100]
      break
    case 'warning':
      pattern = [30, 50, 30]
      break
    case 'selection':
      pattern = 5
      break
  }

  try {
    navigator.vibrate(pattern)
  } catch (error) {
    // Silently fail if vibration fails
    console.debug('Haptic feedback failed:', error)
  }
}

/**
 * Hook to add haptic feedback to click events
 */
export function useHapticFeedback() {
  return {
    light: () => hapticFeedback('light'),
    medium: () => hapticFeedback('medium'),
    heavy: () => hapticFeedback('heavy'),
    error: () => hapticFeedback('error'),
    success: () => hapticFeedback('success'),
    warning: () => hapticFeedback('warning'),
    selection: () => hapticFeedback('selection'),
  }
}