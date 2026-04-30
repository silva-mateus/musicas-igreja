'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { runA11yTests, type A11yTestResult } from '@/lib/a11y-test'
import { analyzePerformance, type PerformanceResults } from '@/lib/performance-monitor'
import { AlertTriangle, CheckCircle, Zap, Eye, Smartphone } from 'lucide-react'

interface MobileQAPanelProps {
  onClose?: () => void
}

export function MobileQAPanel({ onClose }: MobileQAPanelProps) {
  const [a11yResults, setA11yResults] = useState<A11yTestResult | null>(null)
  const [perfResults, setPerfResults] = useState<PerformanceResults | null>(null)
  const [isRunningA11y, setIsRunningA11y] = useState(false)
  const [isRunningPerf, setIsRunningPerf] = useState(false)

  const runAccessibilityTests = async () => {
    setIsRunningA11y(true)
    try {
      // Small delay to let UI update
      await new Promise(resolve => setTimeout(resolve, 100))
      const results = runA11yTests()
      setA11yResults(results)
    } finally {
      setIsRunningA11y(false)
    }
  }

  const runPerformanceTests = async () => {
    setIsRunningPerf(true)
    try {
      const results = await analyzePerformance()
      setPerfResults(results)
    } finally {
      setIsRunningPerf(false)
    }
  }

  const getScoreColor = (score: string) => {
    switch (score) {
      case 'good': return 'bg-green-100 text-green-800'
      case 'needs-improvement': return 'bg-yellow-100 text-yellow-800'
      case 'poor': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getScoreIcon = (score: string) => {
    switch (score) {
      case 'good': return <CheckCircle className="h-4 w-4" />
      case 'needs-improvement': return <AlertTriangle className="h-4 w-4" />
      case 'poor': return <AlertTriangle className="h-4 w-4" />
      default: return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-8">
      <Card className="w-full max-w-4xl mx-4 max-h-[90vh]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              <CardTitle>Mobile QA Testing Panel</CardTitle>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                {window.innerWidth}×{window.innerHeight}px
              </Badge>
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  ✕
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            {/* Test Controls */}
            <div className="flex gap-3">
              <Button 
                onClick={runAccessibilityTests} 
                disabled={isRunningA11y}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                {isRunningA11y ? 'Running A11y Tests...' : 'Run Accessibility Tests'}
              </Button>
              
              <Button 
                onClick={runPerformanceTests} 
                disabled={isRunningPerf}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                {isRunningPerf ? 'Running Perf Tests...' : 'Run Performance Tests'}
              </Button>
            </div>

            <Separator />

            {/* Results */}
            <ScrollArea className="h-[60vh]">
              <div className="space-y-6">
                
                {/* Accessibility Results */}
                {a11yResults && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Accessibility Results</h3>
                      <Badge className={a11yResults.summary.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {a11yResults.summary.passed ? 'PASSED' : `${a11yResults.summary.totalViolations} violations`}
                      </Badge>
                    </div>

                    {/* Touch Target Violations */}
                    {a11yResults.touchTargetViolations.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Touch Target Violations ({a11yResults.touchTargetViolations.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            {a11yResults.touchTargetViolations.map((violation, index) => (
                              <div key={index} className="p-2 bg-red-50 rounded text-sm">
                                <div className="font-mono text-xs">{violation.selector}</div>
                                <div className="text-red-700">
                                  Size: {violation.computedWidth}×{violation.computedHeight}px
                                </div>
                                <div className="text-red-600 text-xs">{violation.recommendation}</div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Viewport Overflow */}
                    {a11yResults.viewportOverflowElements.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            Viewport Overflow ({a11yResults.viewportOverflowElements.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="text-sm text-yellow-700">
                            Elements extending beyond viewport width detected
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Missing ARIA Labels */}
                    {a11yResults.missingAriaLabels.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            Missing ARIA Labels ({a11yResults.missingAriaLabels.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="text-sm text-orange-700">
                            Interactive elements without accessible names detected
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Performance Results */}
                {perfResults && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Performance Results</h3>
                      <Badge className={getScoreColor(perfResults.summary.score)}>
                        {getScoreIcon(perfResults.summary.score)}
                        {perfResults.summary.score.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Core Web Vitals */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Core Web Vitals</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {perfResults.vitals.lcp && (
                            <div className="p-3 bg-gray-50 rounded">
                              <div className="text-xs text-gray-500">LCP</div>
                              <div className="font-mono text-sm">{Math.round(perfResults.vitals.lcp)}ms</div>
                              <div className="text-xs text-gray-500">Target: &lt;2500ms</div>
                            </div>
                          )}
                          {perfResults.vitals.fid && (
                            <div className="p-3 bg-gray-50 rounded">
                              <div className="text-xs text-gray-500">FID</div>
                              <div className="font-mono text-sm">{Math.round(perfResults.vitals.fid)}ms</div>
                              <div className="text-xs text-gray-500">Target: &lt;100ms</div>
                            </div>
                          )}
                          {perfResults.vitals.cls !== null && (
                            <div className="p-3 bg-gray-50 rounded">
                              <div className="text-xs text-gray-500">CLS</div>
                              <div className="font-mono text-sm">{perfResults.vitals.cls.toFixed(3)}</div>
                              <div className="text-xs text-gray-500">Target: &lt;0.1</div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Load Timing */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Load Timing</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-3 bg-gray-50 rounded">
                            <div className="text-xs text-gray-500">DOM Ready</div>
                            <div className="font-mono text-sm">{Math.round(perfResults.timing.domContentLoaded)}ms</div>
                          </div>
                          <div className="p-3 bg-gray-50 rounded">
                            <div className="text-xs text-gray-500">Load Complete</div>
                            <div className="font-mono text-sm">{Math.round(perfResults.timing.loadComplete)}ms</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Memory Usage */}
                    {perfResults.memory && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Memory Usage</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 bg-gray-50 rounded text-center">
                              <div className="text-xs text-gray-500">Used</div>
                              <div className="font-mono text-sm">{perfResults.memory.used}MB</div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded text-center">
                              <div className="text-xs text-gray-500">Total</div>
                              <div className="font-mono text-sm">{perfResults.memory.total}MB</div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded text-center">
                              <div className="text-xs text-gray-500">Limit</div>
                              <div className="font-mono text-sm">{perfResults.memory.limit}MB</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Recommendations */}
                    {perfResults.summary.recommendations.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Recommendations</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ul className="space-y-1 text-sm">
                            {perfResults.summary.recommendations.map((rec, index) => (
                              <li key={index} className="flex gap-2">
                                <span className="text-blue-500 font-mono text-xs mt-0.5">{index + 1}.</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* No results yet */}
                {!a11yResults && !perfResults && (
                  <div className="text-center py-8 text-gray-500">
                    Run tests to see results here
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}