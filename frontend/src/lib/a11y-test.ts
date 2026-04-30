/**
 * Accessibility testing utilities for mobile responsive validation
 */

export interface TouchTargetViolation {
  element: Element
  computedWidth: number
  computedHeight: number
  selector: string
  recommendation: string
}

export interface A11yTestResult {
  touchTargetViolations: TouchTargetViolation[]
  viewportOverflowElements: Element[]
  missingAriaLabels: Element[]
  summary: {
    totalViolations: number
    criticalViolations: number
    passed: boolean
  }
}

/**
 * Test for WCAG 2.2 AA touch target compliance (≥44×44px)
 */
export function validateTouchTargets(): TouchTargetViolation[] {
  const violations: TouchTargetViolation[] = []
  
  // Find all interactive elements
  const interactiveElements = document.querySelectorAll(
    'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], ' +
    'a[href], area[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), ' +
    '[onclick], [onkeydown], [onkeyup], [onkeypress]'
  )

  interactiveElements.forEach((element) => {
    const computedStyle = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    
    // Skip hidden elements
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return
    }

    // Check if we're on mobile viewport
    const isMobile = window.innerWidth < 768

    const minSize = isMobile ? 44 : 24 // 44px mobile, 24px desktop minimum
    const width = rect.width
    const height = rect.height

    if (width < minSize || height < minSize) {
      violations.push({
        element: element as Element,
        computedWidth: Math.round(width),
        computedHeight: Math.round(height),
        selector: generateSelector(element),
        recommendation: `Increase touch target to at least ${minSize}×${minSize}px${isMobile ? ' on mobile' : ''}`
      })
    }
  })

  return violations
}

/**
 * Test for viewport overflow on mobile widths
 */
export function validateViewportOverflow(): Element[] {
  const overflowElements: Element[] = []
  
  // Only test on mobile-like viewports
  if (window.innerWidth >= 768) return overflowElements

  const allElements = document.querySelectorAll('*')
  
  allElements.forEach((element) => {
    const rect = element.getBoundingClientRect()
    const computedStyle = window.getComputedStyle(element)
    
    // Skip elements that are supposed to overflow or are hidden
    if (
      computedStyle.position === 'fixed' || 
      computedStyle.position === 'absolute' ||
      computedStyle.display === 'none' ||
      computedStyle.visibility === 'hidden' ||
      computedStyle.overflow === 'hidden' ||
      computedStyle.overflowX === 'hidden'
    ) {
      return
    }

    // Check if element extends beyond viewport
    if (rect.right > window.innerWidth + 1) { // +1px tolerance
      overflowElements.push(element)
    }
  })

  return overflowElements
}

/**
 * Test for missing ARIA labels on interactive elements
 */
export function validateAriaLabels(): Element[] {
  const missingLabels: Element[] = []
  
  // Find buttons without accessible names
  const buttons = document.querySelectorAll('button, [role="button"]')
  
  buttons.forEach((button) => {
    const hasAccessibleName = (
      button.getAttribute('aria-label') ||
      button.getAttribute('aria-labelledby') ||
      button.textContent?.trim() ||
      button.querySelector('img[alt]') ||
      button.querySelector('[aria-label]')
    )

    if (!hasAccessibleName) {
      missingLabels.push(button)
    }
  })

  return missingLabels
}

/**
 * Generate a unique CSS selector for an element
 */
function generateSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`
  }

  if (element.className) {
    const classes = Array.from(element.classList)
      .filter(cls => !cls.startsWith('_')) // Avoid CSS modules classes
      .slice(0, 3) // Limit for readability
      .join('.')
    
    if (classes) {
      return `${element.tagName.toLowerCase()}.${classes}`
    }
  }

  // Fall back to tag name with nth-child
  const parent = element.parentElement
  if (parent) {
    const siblings = Array.from(parent.children)
    const index = siblings.indexOf(element) + 1
    return `${element.tagName.toLowerCase()}:nth-child(${index})`
  }

  return element.tagName.toLowerCase()
}

/**
 * Run comprehensive accessibility test suite
 */
export function runA11yTests(): A11yTestResult {
  const touchTargetViolations = validateTouchTargets()
  const viewportOverflowElements = validateViewportOverflow()
  const missingAriaLabels = validateAriaLabels()

  const totalViolations = touchTargetViolations.length + viewportOverflowElements.length + missingAriaLabels.length
  const criticalViolations = touchTargetViolations.filter(v => v.computedWidth < 32 || v.computedHeight < 32).length

  return {
    touchTargetViolations,
    viewportOverflowElements,
    missingAriaLabels,
    summary: {
      totalViolations,
      criticalViolations,
      passed: totalViolations === 0
    }
  }
}

/**
 * Console-friendly test result formatter
 */
export function formatTestResults(results: A11yTestResult): void {
  console.group('🔍 Mobile Accessibility Test Results')
  
  if (results.summary.passed) {
    console.log('✅ All accessibility tests passed!')
  } else {
    console.warn(`❌ Found ${results.summary.totalViolations} violations (${results.summary.criticalViolations} critical)`)
  }

  if (results.touchTargetViolations.length > 0) {
    console.group('👆 Touch Target Violations')
    results.touchTargetViolations.forEach((violation, index) => {
      console.warn(`${index + 1}. ${violation.selector}`)
      console.warn(`   Size: ${violation.computedWidth}×${violation.computedHeight}px`)
      console.warn(`   Fix: ${violation.recommendation}`)
      console.warn(`   Element:`, violation.element)
    })
    console.groupEnd()
  }

  if (results.viewportOverflowElements.length > 0) {
    console.group('📱 Viewport Overflow')
    results.viewportOverflowElements.forEach((element, index) => {
      console.warn(`${index + 1}. ${generateSelector(element)}`)
      console.warn(`   Element:`, element)
    })
    console.groupEnd()
  }

  if (results.missingAriaLabels.length > 0) {
    console.group('🏷️ Missing ARIA Labels')
    results.missingAriaLabels.forEach((element, index) => {
      console.warn(`${index + 1}. ${generateSelector(element)}`)
      console.warn(`   Element:`, element)
    })
    console.groupEnd()
  }

  console.groupEnd()
}

/**
 * Quick test function for development
 */
export function quickA11yCheck(): void {
  const results = runA11yTests()
  formatTestResults(results)
  
  // Also return results for programmatic use
  return results
}