import Link from 'next/link'
import { cn } from '@/lib/utils'

export function NavBar() {
    const links = [
        { href: '/', label: 'Início' },
        { href: '/musics', label: 'Músicas' },
        { href: '/upload', label: 'Upload' },
        { href: '/lists', label: 'Listas' },
        { href: '/dashboard', label: 'Dashboard' },
    ]
    return (
        <header className="border-b bg-background">
            <nav className={cn('container h-14 flex items-center gap-6')}>
                <Link href="/" className="font-semibold">Músicas Igreja</Link>
                <div className="flex gap-4 text-sm text-muted-foreground">
                    {links.map((l) => (
                        <Link key={l.href} href={l.href} className="hover:text-foreground">
                            {l.label}
                        </Link>
                    ))}
                </div>
            </nav>
        </header>
    )
}


