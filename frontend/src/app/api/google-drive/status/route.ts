import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function GET(request: NextRequest) {
    // minimal logs in production
    try {

        const response = await fetch(`${BACKEND_URL}/api/google-drive/status`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        })



        if (!response.ok) {

            const errorText = await response.text()

            return NextResponse.json({
                error: 'Backend error',
                status: response.status,
                details: errorText
            }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        })
    } catch (error: any) {
        console.error('❌ [PROXY] Network error:', error)
        return NextResponse.json({
            error: 'Network error',
            details: error.message
        }, { status: 500 })
    }
}
