import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function GET(request: NextRequest) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/monitoring/alerts/count`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
            },
            cache: 'no-store',
        })

        const data = await response.json()
        return NextResponse.json(data, { status: response.status })
    } catch (error: any) {
        console.error('Error fetching alert count:', error)
        return NextResponse.json(
            { count: 0 },
            { status: 200 }
        )
    }
}
