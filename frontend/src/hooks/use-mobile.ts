'use client'

import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 640 // sm breakpoint

export function useMobile() {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        
        // Check initial value
        checkMobile()
        
        // Listen for resize events
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    return isMobile
}
