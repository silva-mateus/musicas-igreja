import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Configuração do backend com múltiplas opções
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'http://127.0.0.1:5000'

console.log('🔧 [REPLACE_PDF_API] Backend URL:', BACKEND_URL)

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const fileId = params.id

        if (!fileId || isNaN(Number(fileId))) {
            return NextResponse.json(
                { error: 'ID do arquivo inválido' },
                { status: 400 }
            )
        }

        // Verificar se o backend está acessível
        try {
            const healthCheck = await fetch(`${BACKEND_URL}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 segundos de timeout
            })

            if (!healthCheck.ok) {
                return NextResponse.json(
                    { error: 'Servidor backend não está respondendo. Verifique se o servidor Flask está rodando.' },
                    { status: 503 }
                )
            }
        } catch (error) {
            return NextResponse.json(
                { error: 'Não foi possível conectar ao servidor backend. Verifique se o servidor Flask está rodando na porta 5000.' },
                { status: 503 }
            )
        }

        // Obter o FormData da requisição
        const formData = await request.formData()

        // Verificar se há arquivo na requisição
        if (!formData.has('replacement_pdf')) {
            return NextResponse.json(
                { error: 'Nenhum arquivo enviado' },
                { status: 400 }
            )
        }

        // Criar uma nova requisição para o backend
        const backendResponse = await fetch(`${BACKEND_URL}/api/files/${fileId}/replace_pdf`, {
            method: 'POST',
            body: formData,
        })

        if (!backendResponse.ok) {
            let errorData
            try {
                errorData = await backendResponse.json()
            } catch {
                errorData = { error: `Erro ${backendResponse.status}: ${backendResponse.statusText}` }
            }
            return NextResponse.json(errorData, { status: backendResponse.status })
        }

        const data = await backendResponse.json()
        return NextResponse.json(data)

    } catch (error: any) {
        console.error('❌ [PROXY] Replace PDF error:', error)
        return NextResponse.json(
            { error: 'Erro interno do servidor', details: error.message },
            { status: 500 }
        )
    }
}
