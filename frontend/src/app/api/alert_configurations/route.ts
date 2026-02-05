import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function GET(request: NextRequest) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/alert_configurations`, {
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
        console.error('[AlertConfigurations] Error fetching:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        
        const response = await fetch(`${BACKEND_URL}/api/alert_configurations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify(body),
        })

        const data = await response.json()
        return NextResponse.json(data, { status: response.status })
    } catch (error: any) {
        console.error('[AlertConfigurations] Error creating:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
