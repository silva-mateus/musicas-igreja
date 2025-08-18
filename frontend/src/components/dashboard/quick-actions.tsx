'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Upload,
    Search,
    List,
    BarChart3,
    Users,
    Settings,
    FileMusic,
    Plus
} from 'lucide-react'

export function QuickActions() {
    const actions = [
        {
            title: 'Upload de Músicas',
            description: 'Envie novos arquivos PDF de músicas para o sistema',
            icon: Upload,
            href: '/upload',
            color: 'text-blue-500',
            buttonText: 'Fazer Upload',
            variant: 'default' as const
        },
        {
            title: 'Buscar Músicas',
            description: 'Encontre músicas por nome, artista ou categoria',
            icon: Search,
            href: '/music',
            color: 'text-green-500',
            buttonText: 'Buscar',
            variant: 'outline' as const
        },
        {
            title: 'Gerenciar Listas',
            description: 'Crie e edite listas personalizadas de músicas',
            icon: List,
            href: '/lists',
            color: 'text-purple-500',
            buttonText: 'Ver Listas',
            variant: 'outline' as const
        },
        {
            title: 'Nova Lista',
            description: 'Crie uma nova lista de músicas rapidamente',
            icon: Plus,
            href: '/lists/new',
            color: 'text-orange-500',
            buttonText: 'Criar Lista',
            variant: 'secondary' as const
        },
        {
            title: 'Relatórios',
            description: 'Visualize estatísticas detalhadas do sistema',
            icon: BarChart3,
            href: '/reports',
            color: 'text-cyan-500',
            buttonText: 'Ver Relatórios',
            variant: 'outline' as const
        },
        {
            title: 'Configurações',
            description: 'Gerencie configurações do sistema e perfil',
            icon: Settings,
            href: '/settings',
            color: 'text-gray-500',
            buttonText: 'Configurar',
            variant: 'outline' as const
        }
    ]

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FileMusic className="h-5 w-5" />
                Ações Rápidas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {actions.map((action, index) => (
                    <Card
                        key={index}
                        className="hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 hover:border-primary/20"
                    >
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <action.icon className={`h-5 w-5 ${action.color}`} />
                                {action.title}
                            </CardTitle>
                            <CardDescription className="text-sm">
                                {action.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                className="w-full"
                                variant={action.variant}
                                asChild
                            >
                                <Link href={action.href}>
                                    {action.buttonText}
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}