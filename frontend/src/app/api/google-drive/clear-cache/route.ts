import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        console.log('🧹 [PROXY-CLEAR-CACHE] Limpando cache...')

        const response = await fetch('http://127.0.0.1:5000/api/google-drive/clear-cache', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = await response.json()
        console.log('✅ [PROXY-CLEAR-CACHE] Resposta:', data)

        return NextResponse.json(data, { status: response.status })

    } catch (error) {
        console.error('❌ [PROXY-CLEAR-CACHE] Erro:', error)
        return NextResponse.json(
            { success: false, error: 'Erro interno do servidor' },
            { status: 500 }
        )
    }
}

