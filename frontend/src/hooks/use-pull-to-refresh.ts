'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void
  threshold?: number
  resistance?: number
  maxPullDistance?: number
  disabled?: boolean
}

interface PullToRefreshState {
  isPulling: boolean
  pullDistance: number
  isRefreshing: boolean
  canRefresh: boolean
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
  maxPullDistance = 120,
  disabled = false
}: UsePullToRefreshOptions) {
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
    canRefresh: false
  })

  const startY = useRef<number>(0)
  const pullStarted = useRef<boolean>(false)
  const scrollElement = useRef<HTMLElement | null>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || state.isRefreshing) return
    
    const touch = e.touches[0]
    if (!touch) return
    
    // Only start pull if we're at the top of the scroll
    const element = scrollElement.current
    if (!element || element.scrollTop > 0) return
    
    startY.current = touch.clientY
    pullStarted.current = false
  }, [disabled, state.isRefreshing])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || state.isRefreshing) return
    
    const touch = e.touches[0]
    if (!touch) return
    
    const element = scrollElement.current
    if (!element || element.scrollTop > 0) {
      if (pullStarted.current) {
        setState(prev => ({ ...prev, isPulling: false, pullDistance: 0, canRefresh: false }))
        pullStarted.current = false
      }
      return
    }
    
    const deltaY = touch.clientY - startY.current
    
    if (deltaY > 10 && !pullStarted.current) {
      pullStarted.current = true
      e.preventDefault()
      
      // Add haptic feedback when pull starts
      if ('vibrate' in navigator) {
        navigator.vibrate(10)
      }
    }
    
    if (pullStarted.current && deltaY > 0) {
      e.preventDefault()
      
      // Apply resistance to the pull
      const resistedDistance = Math.min(deltaY / resistance, maxPullDistance)
      const canRefresh = resistedDistance >= threshold
      
      setState(prev => ({
        ...prev,
        isPulling: true,
        pullDistance: resistedDistance,
        canRefresh
      }))
    }
  }, [disabled, state.isRefreshing, threshold, resistance, maxPullDistance])

  const handleTouchEnd = useCallback(async () => {
    if (disabled || state.isRefreshing || !pullStarted.current) return
    
    pullStarted.current = false
    
    if (state.canRefresh) {
      setState(prev => ({ ...prev, isRefreshing: true, isPulling: false }))
      
      // Add haptic feedback when refreshing
      if ('vibrate' in navigator) {
        navigator.vibrate(30)
      }
      
      try {
        await onRefresh()
      } finally {
        setState(prev => ({ ...prev, isRefreshing: false, pullDistance: 0, canRefresh: false }))
      }
    } else {
      setState(prev => ({ ...prev, isPulling: false, pullDistance: 0, canRefresh: false }))
    }
  }, [disabled, state.isRefreshing, state.canRefresh, onRefresh])

  // Set up touch event listeners
  const attachToElement = useCallback((element: HTMLElement | null) => {
    if (scrollElement.current) {
      scrollElement.current.removeEventListener('touchstart', handleTouchStart, { passive: false } as any)
      scrollElement.current.removeEventListener('touchmove', handleTouchMove, { passive: false } as any)
      scrollElement.current.removeEventListener('touchend', handleTouchEnd)
    }
    
    scrollElement.current = element
    
    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: false })
      element.addEventListener('touchmove', handleTouchMove, { passive: false })
      element.addEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollElement.current) {
        scrollElement.current.removeEventListener('touchstart', handleTouchStart)
        scrollElement.current.removeEventListener('touchmove', handleTouchMove)
        scrollElement.current.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    ...state,
    attachToElement,
    pullIndicatorStyle: {
      transform: `translateY(${state.pullDistance}px)`,
      transition: state.isPulling ? 'none' : 'transform 0.3s ease-out'
    }
  }
}