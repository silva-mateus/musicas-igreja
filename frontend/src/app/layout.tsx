import type { Metadata } from 'next'
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import '@/globals.css'
import { ClientWrapper } from '@/components/client-wrapper'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })
const instrumentSerif = Instrument_Serif({
    subsets: ['latin'],
    weight: '400',
    style: ['normal', 'italic'],
    variable: '--font-serif',
})
const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-mono',
})

export const metadata: Metadata = {
    title: 'Cifras Networkmat',
    description: 'Gerenciamento de cifras, partituras e listas musicais',
    icons: {
        icon: [
            { url: '/favicon.ico', type: 'image/x-icon' },
            { url: '/icon.svg', type: 'image/svg+xml' },
        ],
        shortcut: ['/favicon.ico'],
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="pt-BR" className={`${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
            <body className={inter.className} suppressHydrationWarning>
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