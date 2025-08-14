import './globals.css'
import { ReactNode } from 'react'
import { NavBar } from '@/components/header/NavBar'

export const metadata = {
    title: 'Músicas Igreja',
    description: 'Organizador de PDFs e listas - Frontend',
}

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="pt-br" suppressHydrationWarning>
            <body>
                <NavBar />
                {children}
            </body>
        </html>
    )
}


