'use client'

import { useRef, useCallback, TouchEvent } from 'react'
import { hapticFeedback } from '@/lib/haptic-feedback'

interface SwipeHandlers {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

interface SwipeOptions {
  threshold?: number
  preventDefaultTouchmove?: boolean
  resistanceThreshold?: number
  trackMouse?: boolean
  hapticFeedback?: boolean
}

export function useSwipe(handlers: SwipeHandlers, options: SwipeOptions = {}) {
  const {
    threshold = 50,
    preventDefaultTouchmove = false,
    resistanceThreshold = 25,
    trackMouse = false,
    hapticFeedback: useHaptic = true
  } = options

  const startX = useRef<number>(0)
  const startY = useRef<number>(0)
  const deltaX = useRef<number>(0)
  const deltaY = useRef<number>(0)
  const swiping = useRef<boolean>(false)

  const onTouchStart = useCallback((e: TouchEvent | MouseEvent) => {
    const touch = 'touches' in e ? e.touches[0] : e
    if (!touch) return

    startX.current = touch.clientX
    startY.current = touch.clientY
    swiping.current = true
    deltaX.current = 0
    deltaY.current = 0
  }, [])

  const onTouchMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!swiping.current) return

    const touch = 'touches' in e ? e.touches[0] : e
    if (!touch) return

    deltaX.current = touch.clientX - startX.current
    deltaY.current = touch.clientY - startY.current

    if (preventDefaultTouchmove) {
      // Only prevent if we've moved past the resistance threshold
      if (Math.abs(deltaX.current) > resistanceThreshold || Math.abs(deltaY.current) > resistanceThreshold) {
        e.preventDefault()
      }
    }
  }, [preventDefaultTouchmove, resistanceThreshold])

  const onTouchEnd = useCallback(() => {
    if (!swiping.current) return

    swiping.current = false

    const absX = Math.abs(deltaX.current)
    const absY = Math.abs(deltaY.current)

    // Determine if this is a valid swipe
    if (absX < threshold && absY < threshold) return

    // Haptic feedback on successful swipe
    if (useHaptic) {
      hapticFeedback('selection')
    }

    // Determine swipe direction
    if (absX > absY) {
      // Horizontal swipe
      if (deltaX.current > 0) {
        handlers.onSwipeRight?.()
      } else {
        handlers.onSwipeLeft?.()
      }
    } else {
      // Vertical swipe
      if (deltaY.current > 0) {
        handlers.onSwipeDown?.()
      } else {
        handlers.onSwipeUp?.()
      }
    }
  }, [threshold, handlers, useHaptic])

  const swipeHandlers = {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    ...(trackMouse && {
      onMouseDown: onTouchStart,
      onMouseMove: onTouchMove,
      onMouseUp: onTouchEnd
    })
  }

  return {
    ...swipeHandlers,
    isSwiping: () => swiping.current,
    getCurrentDelta: () => ({ x: deltaX.current, y: deltaY.current })
  }
}