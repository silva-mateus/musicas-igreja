import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const queryString = url.searchParams.toString()
        const backendUrl = `${BACKEND_URL}/api/monitoring/events${queryString ? `?${queryString}` : ''}`

        const response = await fetch(backendUrl, {
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
        console.error('Error fetching events:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
