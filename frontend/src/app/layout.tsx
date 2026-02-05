import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/globals.css'
import { ClientWrapper } from '@/components/client-wrapper'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Sistema de Músicas da Igreja',
    description: 'Gerenciamento de partituras e listas musicais',
    icons: {
        icon: [
            { url: '/icon.svg', type: 'image/svg+xml' },
        ],
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="pt-BR" className="dark">
            <body className={`${inter.className} dark`}>
                <ClientWrapper>
                    <div className="min-h-screen bg-background text-foreground">
                        {children}
                    </div>
                    <Toaster />
                </ClientWrapper>
            </body>
        </html>
    )
}