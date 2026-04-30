/**
 * Performance monitoring utilities for mobile web vitals
 */

export interface CoreWebVitals {
  lcp: number | null // Largest Contentful Paint
  fid: number | null // First Input Delay  
  cls: number | null // Cumulative Layout Shift
  fcp: number | null // First Contentful Paint
  ttfb: number | null // Time to First Byte
}

export interface PerformanceResults {
  vitals: CoreWebVitals
  timing: {
    domContentLoaded: number
    loadComplete: number
    timeToInteractive: number | null
  }
  memory?: {
    used: number
    total: number
    limit: number
  }
  summary: {
    score: 'good' | 'needs-improvement' | 'poor'
    recommendations: string[]
  }
}

/**
 * Measure Core Web Vitals using modern Performance APIs
 */
export function measureCoreWebVitals(): Promise<CoreWebVitals> {
  return new Promise((resolve) => {
    const vitals: CoreWebVitals = {
      lcp: null,
      fid: null,
      cls: null,
      fcp: null,
      ttfb: null
    }

    // Measure TTFB (Time to First Byte)
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigationEntry) {
      vitals.ttfb = navigationEntry.responseStart - navigationEntry.requestStart
    }

    // Use PerformanceObserver for modern metrics
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          vitals.lcp = lastEntry.startTime
        })
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      } catch (e) {
        console.debug('LCP measurement not supported')
      }

      // First Contentful Paint (FCP)
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime
            }
          })
        })
        fcpObserver.observe({ type: 'paint', buffered: true })
      } catch (e) {
        console.debug('FCP measurement not supported')
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          }
          vitals.cls = clsValue
        })
        clsObserver.observe({ type: 'layout-shift', buffered: true })
      } catch (e) {
        console.debug('CLS measurement not supported')
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            vitals.fid = entry.processingStart - entry.startTime
          })
        })
        fidObserver.observe({ type: 'first-input', buffered: true })
      } catch (e) {
        console.debug('FID measurement not supported')
      }
    }

    // Give time for measurements to complete
    setTimeout(() => resolve(vitals), 3000)
  })
}

/**
 * Measure page load timing
 */
export function measureLoadTiming() {
  const timing = performance.timing
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

  return {
    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
    loadComplete: timing.loadEventEnd - timing.navigationStart,
    timeToInteractive: null, // Would need more complex measurement
    dns: navigation?.domainLookupEnd - navigation?.domainLookupStart || 0,
    tcp: navigation?.connectEnd - navigation?.connectStart || 0,
    request: navigation?.responseEnd - navigation?.requestStart || 0,
    response: navigation?.responseEnd - navigation?.responseStart || 0,
    processing: timing.domComplete - navigation?.responseEnd || 0
  }
}

/**
 * Get memory usage information (Chrome only)
 */
export function getMemoryInfo() {
  const performance = window.performance as any
  
  if (performance.memory) {
    return {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
      total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB  
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) // MB
    }
  }
  
  return null
}

/**
 * Generate performance score based on Core Web Vitals thresholds
 */
export function calculatePerformanceScore(vitals: CoreWebVitals): 'good' | 'needs-improvement' | 'poor' {
  let score = 0
  let totalMetrics = 0

  // LCP scoring (good: <2500ms, needs improvement: 2500-4000ms, poor: >4000ms)
  if (vitals.lcp !== null) {
    totalMetrics++
    if (vitals.lcp <= 2500) score++
    else if (vitals.lcp <= 4000) score += 0.5
  }

  // FID scoring (good: <100ms, needs improvement: 100-300ms, poor: >300ms)
  if (vitals.fid !== null) {
    totalMetrics++
    if (vitals.fid <= 100) score++
    else if (vitals.fid <= 300) score += 0.5
  }

  // CLS scoring (good: <0.1, needs improvement: 0.1-0.25, poor: >0.25)
  if (vitals.cls !== null) {
    totalMetrics++
    if (vitals.cls <= 0.1) score++
    else if (vitals.cls <= 0.25) score += 0.5
  }

  if (totalMetrics === 0) return 'needs-improvement'
  
  const percentage = score / totalMetrics
  if (percentage >= 0.75) return 'good'
  if (percentage >= 0.5) return 'needs-improvement'
  return 'poor'
}

/**
 * Generate performance recommendations
 */
export function generateRecommendations(results: PerformanceResults): string[] {
  const recommendations: string[] = []

  if (results.vitals.lcp && results.vitals.lcp > 2500) {
    recommendations.push('Optimize Largest Contentful Paint: Reduce server response times, eliminate render-blocking resources')
  }

  if (results.vitals.fid && results.vitals.fid > 100) {
    recommendations.push('Optimize First Input Delay: Minimize JavaScript execution time, use web workers for heavy computation')
  }

  if (results.vitals.cls && results.vitals.cls > 0.1) {
    recommendations.push('Optimize Cumulative Layout Shift: Set size attributes on images/videos, reserve space for dynamic content')
  }

  if (results.timing.loadComplete > 3000) {
    recommendations.push('Reduce page load time: Optimize bundle size, implement code splitting, use CDN')
  }

  if (results.memory && results.memory.used > 50) {
    recommendations.push('Memory usage is high: Check for memory leaks, optimize large objects, implement lazy loading')
  }

  if (recommendations.length === 0) {
    recommendations.push('Performance looks good! Continue monitoring and consider advanced optimizations.')
  }

  return recommendations
}

/**
 * Run comprehensive performance analysis
 */
export async function analyzePerformance(): Promise<PerformanceResults> {
  const vitals = await measureCoreWebVitals()
  const timing = measureLoadTiming()
  const memory = getMemoryInfo()

  const results: PerformanceResults = {
    vitals,
    timing: {
      domContentLoaded: timing.domContentLoaded,
      loadComplete: timing.loadComplete,
      timeToInteractive: timing.timeToInteractive
    },
    memory: memory || undefined,
    summary: {
      score: calculatePerformanceScore(vitals),
      recommendations: []
    }
  }

  results.summary.recommendations = generateRecommendations(results)
  
  return results
}

/**
 * Console-friendly performance report
 */
export function logPerformanceReport(results: PerformanceResults): void {
  console.group('⚡ Performance Analysis Report')
  
  // Overall score
  const scoreEmoji = results.summary.score === 'good' ? '✅' : results.summary.score === 'needs-improvement' ? '⚠️' : '❌'
  console.log(`${scoreEmoji} Overall Score: ${results.summary.score.toUpperCase()}`)
  
  // Core Web Vitals
  console.group('📊 Core Web Vitals')
  
  if (results.vitals.lcp) {
    const lcpStatus = results.vitals.lcp <= 2500 ? '✅' : results.vitals.lcp <= 4000 ? '⚠️' : '❌'
    console.log(`${lcpStatus} LCP: ${Math.round(results.vitals.lcp)}ms (target: <2500ms)`)
  }
  
  if (results.vitals.fid) {
    const fidStatus = results.vitals.fid <= 100 ? '✅' : results.vitals.fid <= 300 ? '⚠️' : '❌'
    console.log(`${fidStatus} FID: ${Math.round(results.vitals.fid)}ms (target: <100ms)`)
  }
  
  if (results.vitals.cls !== null) {
    const clsStatus = results.vitals.cls <= 0.1 ? '✅' : results.vitals.cls <= 0.25 ? '⚠️' : '❌'
    console.log(`${clsStatus} CLS: ${results.vitals.cls.toFixed(3)} (target: <0.1)`)
  }
  
  if (results.vitals.fcp) {
    console.log(`📈 FCP: ${Math.round(results.vitals.fcp)}ms`)
  }
  
  if (results.vitals.ttfb) {
    console.log(`📡 TTFB: ${Math.round(results.vitals.ttfb)}ms`)
  }
  
  console.groupEnd()

  // Load timing
  console.group('⏱️ Load Timing')
  console.log(`DOM Ready: ${Math.round(results.timing.domContentLoaded)}ms`)
  console.log(`Load Complete: ${Math.round(results.timing.loadComplete)}ms`)
  console.groupEnd()

  // Memory usage
  if (results.memory) {
    console.group('💾 Memory Usage')
    console.log(`Used: ${results.memory.used}MB`)
    console.log(`Total: ${results.memory.total}MB`)
    console.log(`Limit: ${results.memory.limit}MB`)
    console.groupEnd()
  }

  // Recommendations
  if (results.summary.recommendations.length > 0) {
    console.group('💡 Recommendations')
    results.summary.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`)
    })
    console.groupEnd()
  }

  console.groupEnd()
}

/**
 * Quick performance check for development
 */
export async function quickPerfCheck(): Promise<PerformanceResults> {
  console.log('🔍 Running performance analysis...')
  const results = await analyzePerformance()
  logPerformanceReport(results)
  return results
}