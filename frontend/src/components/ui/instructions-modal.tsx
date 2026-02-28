'use client'

import * as React from 'react'
import { Info } from 'lucide-react'
import { Button } from '@core/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@core/components/ui/dialog'
import { ScrollArea } from '@core/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@core/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface InstructionSection {
    title: string
    content: React.ReactNode
    icon?: React.ReactNode
}

interface InstructionsModalProps {
    title: string
    description?: string
    sections: readonly InstructionSection[] | InstructionSection[]
    className?: string
    buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary'
    buttonSize?: 'default' | 'sm' | 'lg' | 'icon'
}

export function InstructionsModal({
    title,
    description,
    sections,
    className,
    buttonVariant = 'ghost',
    buttonSize = 'icon'
}: InstructionsModalProps) {
    return (
        <Dialog>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                            <Button
                                variant={buttonVariant}
                                size={buttonSize}
                                className={cn('h-8 w-8', className)}
                            >
                                <Info className="h-4 w-4" />
                                <span className="sr-only">Instruções</span>
                            </Button>
                        </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Ver instruções</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" />
                        {title}
                    </DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-6">
                        {sections.map((section, index) => (
                            <div key={index} className="space-y-2">
                                <h4 className="font-semibold flex items-center gap-2 text-sm">
                                    {section.icon}
                                    {section.title}
                                </h4>
                                <div className="text-sm text-muted-foreground pl-0.5">
                                    {section.content}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}

// Pre-defined instruction sets for each page
export const PAGE_INSTRUCTIONS = {
    upload: {
        title: 'Instruções de Upload',
        description: 'Como fazer upload de músicas no sistema',
        sections: [
            {
                title: '📁 Formatos e Verificação',
                content: (
                    <div className="space-y-2">
                        <p className="text-sm">Apenas arquivos <strong>PDF</strong> são aceitos (máx. 50MB).</p>
                        <div className="bg-muted/50 rounded p-2 space-y-1 text-xs">
                            <p><span className="inline-flex items-center gap-1 text-green-600">✓ Único</span> — Nenhum duplicado encontrado</p>
                            <p><span className="inline-flex items-center gap-1 text-amber-600">⚠ Possível duplicado</span> — Arquivo similar encontrado</p>
                            <p><span className="inline-flex items-center gap-1 text-green-600">✓ Válido</span> — Todos campos obrigatórios preenchidos</p>
                            <p><span className="inline-flex items-center gap-1 text-red-600">✗ Incompleto</span> — Faltam título ou categorias</p>
                        </div>
                    </div>
                )
            },
            {
                title: '📝 Campos dos Metadados',
                content: (
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <p><strong>Título *</strong> — Nome da música</p>
                            <p><strong>Artista</strong> — Compositor/intérprete</p>
                            <p><strong>Categorias *</strong> — Entrada, Comunhão, etc.</p>
                            <p><strong>Tempos Litúrgicos</strong> — Quaresma, Páscoa, etc.</p>
                            <p><strong>Tom</strong> — Tonalidade (Dó, Ré, etc.)</p>
                            <p><strong>YouTube</strong> — Link para áudio/vídeo</p>
                        </div>
                        <p className="text-xs text-muted-foreground">* Campos obrigatórios</p>
                    </div>
                )
            },
            {
                title: '🔘 Botões e Ações',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Aplicar a Todos</strong> — Define valores em lote para todos os arquivos</p>
                            <p><strong>Editar</strong> — Expande/recolhe os campos do arquivo individual</p>
                            <p><strong>✕</strong> — Remove arquivo da lista de upload</p>
                            <p><strong>+ Nova Categoria</strong> — Cria categoria nova durante o upload</p>
                            <p><strong>Enviar</strong> — Inicia o upload de todos os arquivos</p>
                        </div>
                    </div>
                )
            }
        ]
    },
    musicList: {
        title: 'Instruções - Biblioteca de Músicas',
        description: 'Como navegar e gerenciar a biblioteca',
        sections: [
            {
                title: '🔍 Busca e Filtros',
                content: (
                    <div className="space-y-2 text-xs">
                        <p>Digite na barra para buscar por título ou artista.</p>
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Categoria</strong> — Filtra por momento da missa</p>
                            <p><strong>Tempo Litúrgico</strong> — Filtra por período do ano</p>
                            <p><strong>Tom</strong> — Filtra por tonalidade</p>
                            <p><strong>Limpar filtros</strong> — Remove todos os filtros aplicados</p>
                        </div>
                    </div>
                )
            },
            {
                title: '📄 Visualização (Abas)',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Todas</strong> — Lista todas as músicas em tabela</p>
                            <p><strong>Por Artista</strong> — Agrupa músicas por compositor</p>
                            <p><strong>Por Categoria</strong> — Agrupa por momento da missa</p>
                            <p><strong>Por Tempo</strong> — Agrupa por período litúrgico</p>
                        </div>
                    </div>
                )
            },
            {
                title: '🔘 Botões na Tabela',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Título da música</strong> — Clique para ver detalhes e PDF</p>
                            <p><strong>🔄 Atualizar</strong> — Recarrega a lista</p>
                            <p><strong>⬆ Upload</strong> — Ir para página de upload</p>
                        </div>
                    </div>
                )
            }
        ]
    },
    musicDetails: {
        title: 'Instruções - Detalhes da Música',
        description: 'Visualização e ações disponíveis',
        sections: [
            {
                title: '📄 Visualizador de PDF',
                content: (
                    <div className="space-y-2 text-xs">
                        <p>O PDF é carregado automaticamente no visualizador integrado.</p>
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Tentar novamente</strong> — Recarrega o PDF se houver erro</p>
                            <p><strong>Abrir em nova aba</strong> — Abre PDF em aba separada</p>
                        </div>
                    </div>
                )
            },
            {
                title: '🔘 Botões de Ação',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>← Voltar</strong> — Retorna à lista de músicas</p>
                            <p><strong>👁 Visualizar PDF</strong> — Abre em nova aba</p>
                            <p><strong>⬇ Download</strong> — Baixa o arquivo PDF</p>
                            <p><strong>✏ Editar</strong> — Edita título, artista, categorias, etc.</p>
                            <p><strong>🗑 Excluir</strong> — Remove a música (requer confirmação)</p>
                            <p><strong>+ Adicionar à lista</strong> — Adiciona a uma lista existente</p>
                        </div>
                    </div>
                )
            },
            {
                title: '📋 Informações Exibidas',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Badges coloridos</strong> — Categorias e tempos litúrgicos</p>
                            <p><strong>Painel lateral</strong> — Nome, tamanho, páginas, data de upload</p>
                            <p><strong>YouTube</strong> — Player integrado se houver link</p>
                        </div>
                    </div>
                )
            }
        ]
    },
    lists: {
        title: 'Instruções - Listas de Músicas',
        description: 'Como criar e gerenciar listas para celebrações',
        sections: [
            {
                title: '📋 Gerenciamento de Listas',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>+ Nova Lista</strong> — Cria uma lista vazia (nome obrigatório)</p>
                            <p><strong>🔄 Atualizar</strong> — Recarrega todas as listas</p>
                            <p><strong>Buscar</strong> — Encontra listas por nome</p>
                            <p><strong>Ordenar</strong> — Por data de criação ou nome</p>
                        </div>
                    </div>
                )
            },
            {
                title: '🔘 Ações por Lista',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Nome da lista</strong> — Clique para ver detalhes</p>
                            <p><strong>✏ Editar</strong> — Adicionar/remover músicas, reordenar</p>
                            <p><strong>📄 Gerar PDF</strong> — Cria documento com todas as cifras</p>
                            <p><strong>🗑 Excluir</strong> — Remove a lista (requer confirmação)</p>
                        </div>
                    </div>
                )
            },
            {
                title: '📑 Informações da Tabela',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Nome</strong> — Título da lista</p>
                            <p><strong>Músicas</strong> — Quantidade de itens na lista</p>
                            <p><strong>Criado em</strong> — Data de criação</p>
                            <p><strong>Observações</strong> — Descrição opcional</p>
                        </div>
                    </div>
                )
            }
        ]
    },
    listEdit: {
        title: 'Instruções - Edição de Lista',
        description: 'Como editar uma lista de músicas',
        sections: [
            {
                title: '📝 Informações da Lista',
                content: (
                    <div className="space-y-2 text-xs">
                        <p>Seção colapsável para editar nome e descrição.</p>
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Nome</strong> — Título da lista (obrigatório)</p>
                            <p><strong>Observações</strong> — Descrição opcional</p>
                        </div>
                    </div>
                )
            },
            {
                title: '🎵 Músicas da Lista',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>≡ (gripper)</strong> — Arraste para reordenar</p>
                            <p><strong>▲ ▼ (setas)</strong> — Move para cima/baixo</p>
                            <p><strong>👁 Ver</strong> — Abre detalhes da música</p>
                            <p><strong>⬇ Download</strong> — Baixa o PDF individual</p>
                            <p><strong>🗑 Remover</strong> — Remove da lista (não exclui a música)</p>
                        </div>
                    </div>
                )
            },
            {
                title: '🔍 Buscar Músicas',
                content: (
                    <div className="space-y-2 text-xs">
                        <p>Seção colapsável para adicionar novas músicas.</p>
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Buscar por título</strong> — Filtra músicas disponíveis</p>
                            <p><strong>Categorias</strong> — Dropdown com checkboxes</p>
                            <p><strong>Tempos Litúrgicos</strong> — Dropdown com checkboxes</p>
                            <p><strong>+ (botão)</strong> — Adiciona música à lista</p>
                            <p><strong>Limpar Todos</strong> — Remove todos os filtros</p>
                        </div>
                    </div>
                )
            },
            {
                title: '💾 Salvar',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>💾 Salvar</strong> — Salva todas as alterações</p>
                            <p><strong>← Voltar</strong> — Retorna à visualização da lista</p>
                        </div>
                    </div>
                )
            }
        ]
    },
    dashboard: {
        title: 'Instruções - Dashboard',
        description: 'Visão geral do sistema',
        sections: [
            {
                title: '📊 Cards de Estatísticas',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Total de Músicas</strong> — Quantidade de arquivos cadastrados</p>
                            <p><strong>Artistas</strong> — Compositores/intérpretes únicos</p>
                            <p><strong>Listas</strong> — Total de listas criadas</p>
                            <p><strong>Últimos Uploads</strong> — Músicas adicionadas recentemente</p>
                        </div>
                    </div>
                )
            },
            {
                title: '📈 Gráficos',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Por Categoria</strong> — Distribuição das músicas</p>
                            <p><strong>Por Tempo</strong> — Músicas por período litúrgico</p>
                            <p><strong>Timeline</strong> — Uploads ao longo do tempo</p>
                        </div>
                    </div>
                )
            },
            {
                title: '🔘 Ações Rápidas',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>🔄 Atualizar</strong> — Recarrega todas as estatísticas</p>
                            <p><strong>Cards clicáveis</strong> — Navegam para seções específicas</p>
                        </div>
                    </div>
                )
            }
        ]
    },
    settings: {
        title: 'Instruções - Gerenciar Entidades',
        description: 'Edição de categorias, tempos e artistas',
        sections: [
            {
                title: '📑 Abas de Entidades',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Categorias</strong> — Momentos da missa (Entrada, Comunhão, etc.)</p>
                            <p><strong>Tempos Litúrgicos</strong> — Períodos do ano (Quaresma, Advento, etc.)</p>
                            <p><strong>Artistas</strong> — Compositores e intérpretes</p>
                        </div>
                    </div>
                )
            },
            {
                title: '🔘 Ações por Item',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>+ Adicionar</strong> — Cria nova entidade</p>
                            <p><strong>✏ Editar</strong> — Renomeia a entidade</p>
                            <p><strong>🔀 Mesclar</strong> — Unifica duas entidades em uma</p>
                            <p><strong>🗑 Excluir</strong> — Remove (só se não tiver músicas)</p>
                        </div>
                    </div>
                )
            },
            {
                title: '⚠️ Cuidados',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Mesclar</strong> — Ação irreversível! Todas as músicas serão movidas.</p>
                            <p><strong>Excluir</strong> — Só funciona se não houver músicas associadas.</p>
                            <p><strong>Badge numérico</strong> — Mostra quantas músicas usam cada item.</p>
                        </div>
                    </div>
                )
            }
        ]
    },
    monitoring: {
        title: 'Instruções - Monitoramento',
        description: 'Acompanhamento do sistema (Admin)',
        sections: [
            {
                title: '📊 Cards de Métricas',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Banco de Dados</strong> — Total de arquivos e tamanho</p>
                            <p><strong>Armazenamento</strong> — Uso de disco e espaço livre</p>
                            <p><strong>Uptime</strong> — Tempo de atividade do sistema</p>
                            <p><strong>Alertas Ativos</strong> — Quantidade de alertas não lidos</p>
                        </div>
                    </div>
                )
            },
            {
                title: '🔔 Eventos de Segurança',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Filtro de Severidade</strong> — Crítico, Alto, Médio, Baixo</p>
                            <p><strong>✓ Marcar como lido</strong> — Remove da lista de pendentes</p>
                            <p><strong>Cores dos badges</strong> — Indicam nível de urgência</p>
                        </div>
                    </div>
                )
            },
            {
                title: '📜 Logs de Auditoria',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>Ação</strong> — Tipo de operação realizada</p>
                            <p><strong>Usuário</strong> — Quem executou a ação</p>
                            <p><strong>Data</strong> — Quando ocorreu</p>
                            <p><strong>Detalhes</strong> — Informações adicionais do evento</p>
                        </div>
                    </div>
                )
            },
            {
                title: '🔘 Botões',
                content: (
                    <div className="space-y-2 text-xs">
                        <div className="bg-muted/50 rounded p-2 space-y-1">
                            <p><strong>🔄 Atualizar</strong> — Recarrega todos os dados</p>
                            <p><strong>⚙ Configurar Alertas</strong> — Define limites para alertas automáticos</p>
                        </div>
                    </div>
                )
            }
        ]
    }
} as const
