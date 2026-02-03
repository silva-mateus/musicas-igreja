import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        // Check if response is JSON
        const contentType = response.headers.get('content-type') || ''
        
        if (!contentType.includes('application/json')) {
            // Backend returned non-JSON (probably error page)
            const text = await response.text()
            console.error('Backend returned non-JSON response:', text.substring(0, 200))
            return NextResponse.json(
                { success: false, error: 'Serviço de autenticação indisponível. Verifique se o backend está rodando.' },
                { status: 503 }
            )
        }

        const data = await response.json()

        // Forward the session cookie from backend if present
        const setCookie = response.headers.get('set-cookie')
        const res = NextResponse.json(data, { status: response.status })
        
        if (setCookie) {
            res.headers.set('set-cookie', setCookie)
        }

        return res
    } catch (error: any) {
        console.error('Login error:', error)
        return NextResponse.json(
            { success: false, error: 'Erro ao conectar com o servidor. Verifique sua conexão.' },
            { status: 500 }
        )
    }
}
