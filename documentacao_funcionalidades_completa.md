# Documentação Completa - Sistema de Músicas da Igreja

## Visão Geral
Sistema Flask para gerenciamento de músicas religiosas em formato PDF, com funcionalidades de organização, catalogação, listas personalizadas e análises estatísticas.

---

## 1. AUTENTICAÇÃO E CONTROLE DE ACESSO

### 1.1 Sistema de Login/Registro
- **Página de Login** (`/login`)
  - Campos: username, password
  - Validação de credenciais no backend
  - Redirecionamento baseado no papel do usuário
  - Mensagens de erro personalizadas
  - Link para cadastro de novo usuário

- **Página de Registro** (`/register`)
  - Campos: username, email, password, confirm_password
  - Validação de unicidade de username
  - Hash seguro da senha
  - Sistema de convites para primeira configuração

### 1.2 Controle de Sessões
- **Middleware de autenticação**
  - Decorador `@login_required` para rotas protegidas
  - Gerenciamento de sessões Flask
  - Logout automático por inatividade
  - Controle de acesso baseado em papéis

### 1.3 Gestão de Usuários (Admin)
- **Painel Administrativo** (`/admin/users`)
  - Lista de todos os usuários
  - Informações: ID, username, email, role, created_at, last_login, status
  - Ações: Criar, Editar, Ativar/Desativar, Deletar usuários
  - Proteção contra auto-exclusão
  - Controle de papéis (admin/user)

---

## 2. GERENCIAMENTO DE ARQUIVOS PDF

### 2.1 Upload de Músicas
- **Interface de Upload** (`/upload`)
  - Suporte a múltiplos arquivos PDF
  - Validação de formato (apenas PDF)
  - Limite de tamanho: 50MB por arquivo
  - Preview em tempo real dos arquivos selecionados
  - Barra de progresso durante upload
  - Tratamento de erros de upload

### 2.2 Metadados dos Arquivos
- **Informações Automáticas:**
  - Nome do arquivo original
  - Tamanho em bytes/MB
  - Número de páginas (extraído via PyPDF2)
  - Data de upload
  - Checksum para evitar duplicatas

- **Metadados Editáveis:**
  - Nome da música (song_name)
  - Artista/Compositor
  - Categoria(s) - sistema multi-categoria
  - Tempo(s) litúrgico(s) - sistema multi-tempo
  - Tom musical (dropdown de tons)
  - Link do YouTube
  - Descrição/Observações

### 2.3 Substituição de Arquivos
- **Sistema de Replacement de PDF**
  - Modal de comparação lado a lado
  - Preview do PDF atual vs novo PDF
  - Navegação por páginas em ambos os PDFs
  - Preservação de todos os metadados
  - Validação de formato e tamanho
  - Backup automático do arquivo anterior

---

## 3. VISUALIZAÇÃO E NAVEGAÇÃO

### 3.1 Página Principal (`/`)
- **Views Disponíveis:**
  - Vista em lista (tabela responsiva)
  - Vista em cards (grid responsivo)
  - Alternância via botão de toggle

- **Informações Exibidas:**
  - Nome da música (com fallback para nome do arquivo)
  - Artista/Compositor
  - Categoria(s) com badges coloridos
  - Tempo(s) litúrgico(s) com badges
  - Tom musical
  - Indicador de YouTube disponível
  - Data de upload
  - Tamanho do arquivo
  - Número de páginas

### 3.2 Sistema de Filtros Avançados
- **Filtros Disponíveis:**
  - Busca por texto (nome, artista, arquivo)
  - Filtro por categoria (multi-seleção)
  - Filtro por tempo litúrgico (multi-seleção)
  - Filtro por tom musical
  - Filtro por presença de YouTube
  - Combinação de múltiplos filtros

- **Interface dos Filtros:**
  - Painel colapsável lateral
  - Checkboxes para seleção múltipla
  - Botões "Selecionar Todos" / "Limpar"
  - Aplicação em tempo real
  - Contador de resultados filtrados

### 3.3 Sistema de Busca
- **Busca Global** (`/search`)
  - Campo de busca no header
  - Pesquisa em: nome da música, artista, nome do arquivo
  - Suporte a busca parcial (LIKE query)
  - Página de resultados dedicada
  - Highlighting dos termos encontrados

### 3.4 Paginação e Ordenação
- **Sistema de Paginação:**
  - Configurável (padrão: 12 itens por página)
  - Navegação com números de página
  - Links "Anterior" e "Próximo"
  - Indicador de página atual

- **Ordenação:**
  - Por nome da música (A-Z, Z-A)
  - Por data de upload (mais recente, mais antigo)
  - Por artista
  - Por categoria

---

## 4. AÇÕES INDIVIDUAIS DAS MÚSICAS

### 4.1 Página de Detalhes (`/details/<id>`)
- **Informações Completas:**
  - Todos os metadados organizados em tabela
  - Preview do PDF com navegação por páginas
  - Player do YouTube incorporado (se disponível)
  - Histórico de uso em listas
  - Sugestões de músicas relacionadas

- **Ações Disponíveis:**
  - Editar informações inline
  - Visualizar PDF em tela cheia
  - Download do arquivo
  - Adicionar a lista existente
  - Deletar música
  - Substituir arquivo PDF

### 4.2 Sistema de Edição Inline
- **Modo de Edição:**
  - Toggle entre visualização/edição
  - Formulário inline com todos os campos
  - Autocomplete para artistas existentes
  - Multi-seleção de categorias e tempos litúrgicos
  - Adição de novas categorias/tempos em tempo real
  - Validação de formulário
  - Salvamento via AJAX
  - Detecção de mudanças não salvas

### 4.3 Visualização de PDF
- **Viewer Integrado:**
  - Renderização via PDF.js
  - Navegação por páginas
  - Zoom automático responsivo
  - Loading states
  - Abertura em nova aba
  - Download direto

### 4.4 Integração YouTube
- **Funcionalidades:**
  - Player incorporado na página de detalhes
  - Botão direto para abrir no YouTube
  - Validação de URLs do YouTube
  - Suporte a diferentes formatos de URL

---

## 5. SISTEMA DE LISTAS DE MÚSICAS

### 5.1 Gerenciamento de Listas (`/merge_lists`)
- **Listagem de Listas:**
  - Nome da lista
  - Quantidade de músicas
  - Data de última modificação
  - Status (pronta para download, precisa mais músicas, vazia)

- **Ações por Lista:**
  - Editar lista
  - Duplicar lista
  - Gerar relatório textual
  - Baixar PDF unificado
  - Deletar lista

### 5.2 Criação e Edição de Listas (`/edit_list/<id>`)
- **Interface de Edição:**
  - Informações da lista (nome, observações)
  - Lista de músicas com ordem personalizável
  - Sistema drag-and-drop para reordenação
  - Painel de filtros para adicionar músicas
  - Preview das músicas disponíveis

- **Funcionalidades Avançadas:**
  - Detecção de mudanças não salvas
  - Sistema de cache temporário para performance
  - Validação antes de salvar
  - Undo de ações

### 5.3 Sistema Drag-and-Drop
- **Reordenação de Músicas:**
  - Interface visual para arrastar
  - Indicadores visuais de drop zones
  - Animações de feedback
  - Persistência da ordem no banco
  - Sincronização em tempo real

### 5.4 Adição de Músicas às Listas
- **Múltiplas Formas:**
  - Via página de detalhes da música
  - Via seleção múltipla na página principal
  - Via interface de edição da lista
  - Via resultados de busca

- **Interface de Seleção:**
  - Checkboxes para seleção múltipla
  - Painel de ações em lote
  - Criação de nova lista com selecionadas
  - Adição a lista existente

### 5.5 Geração de PDFs Unificados
- **Merge de PDFs:**
  - Combinação de múltiplos PDFs em um arquivo
  - Manutenção da ordem definida na lista
  - Download automático após geração
  - Nomenclatura baseada no nome da lista
  - Tratamento de erros de geração

### 5.6 Relatórios de Listas
- **Geração de Relatórios:**
  - Lista textual com todas as músicas
  - Informações: nome, artista, categoria
  - Cópia automática para clipboard
  - Fallback para seleção manual
  - Formatação padronizada

---

## 6. FUNCIONALIDADES DE SELEÇÃO EM MASSA

### 6.1 Seleção Múltipla
- **Interface:**
  - Checkbox "Selecionar Todos"
  - Checkboxes individuais por música
  - Contador de itens selecionados
  - Painel de ações que aparece ao selecionar

### 6.2 Ações em Massa
- **Criar Nova Lista:**
  - Campo para nome da lista
  - Criação automática com músicas selecionadas
  - Redirecionamento para edição da lista

- **Adicionar a Lista Existente:**
  - Dropdown com listas disponíveis
  - Busca de lista por nome
  - Adição de todas as selecionadas

---

## 7. DASHBOARD E ANÁLISES

### 7.1 Dashboard Principal (`/dashboard`)
- **Cards de Resumo:**
  - Total de músicas no sistema
  - Total de listas criadas
  - Número de categorias
  - Média de músicas por lista

- **Estatísticas Detalhadas:**
  - Tamanho total dos arquivos
  - Total de páginas
  - Músicas com YouTube (percentual)
  - Maior lista (nome e quantidade)
  - Categoria mais popular

### 7.2 Gráficos e Visualizações
- **Gráfico de Uploads por Mês:**
  - Linha temporal de uploads
  - Chart.js para renderização
  - Dados dos últimos 12 meses

- **Distribuição por Categoria:**
  - Gráfico de pizza
  - Cores dinâmicas por categoria
  - Percentuais calculados

- **Distribuição por Tempo Litúrgico:**
  - Gráfico de donut
  - Paleta de cores diferenciada
  - Interatividade com tooltips

### 7.3 Rankings e Tops
- **Top Músicas Mais Utilizadas:**
  - Ranking baseado em uso em listas
  - Top 10 com medalhas (🥇🥈🥉)
  - Links diretos para detalhes
  - Indicador de YouTube

- **Top Artistas:**
  - Ranking por quantidade de músicas
  - Top 10 com contadores
  - Filtros por atividade

### 7.4 Análises Detalhadas
- **Análise por Tempo Litúrgico:**
  - Dropdown para seleção de tempo
  - Top 5 músicas por categoria dentro do tempo
  - Carregamento dinâmico via AJAX

- **Análise por Categoria:**
  - Dropdown para seleção de categoria
  - Top 5 músicas da categoria
  - Informações de tempo litúrgico

---

## 8. APIs INTERNAS

### 8.1 APIs de Dados
- **`/api/search_artists`** - Autocomplete de artistas
- **`/api/merge_lists`** - Lista de todas as listas
- **`/api/get_youtube_link/<id>`** - Obter link do YouTube
- **`/api/generate_report/<list_id>`** - Gerar relatório da lista

### 8.2 APIs do Dashboard
- **`/api/dashboard/top_musics`** - Top músicas utilizadas
- **`/api/dashboard/top_artists`** - Top artistas
- **`/api/dashboard/get_categories`** - Todas as categorias
- **`/api/dashboard/get_liturgical_times`** - Todos os tempos
- **`/api/dashboard/liturgical_top_by_categories/<time>`** - Análise por tempo
- **`/api/dashboard/category_top_musics/<category>`** - Análise por categoria

---

## 9. SISTEMA DE CATEGORIZAÇÃO

### 9.1 Categorias
- **Gerenciamento:**
  - Sistema multi-categoria (uma música pode ter várias)
  - Criação dinâmica de novas categorias
  - Validação de duplicatas
  - Interface com checkboxes

- **Funcionalidades:**
  - Filtros por categoria
  - Análises estatísticas
  - Rankings por categoria
  - Badges visuais coloridos

### 9.2 Tempos Litúrgicos
- **Sistema Similar às Categorias:**
  - Multi-seleção por música
  - Criação dinâmica
  - Filtros avançados
  - Análises específicas

### 9.3 Tons Musicais
- **Lista Predefinida:**
  - Tons maiores e menores
  - Dropdown de seleção única
  - Filtros por tom
  - Badge visual distintivo

---

## 10. INTERFACE RESPONSIVA

### 10.1 Design Mobile-First
- **Adaptações Mobile:**
  - Cards ao invés de tabelas
  - Dropdowns de ações compactos
  - Navegação otimizada para touch
  - Campos de formulário responsivos

### 10.2 Componentes Responsivos
- **Tabelas:**
  - Horizontal scroll em mobile
  - Colunas prioritárias sempre visíveis
  - Informações secundárias ocultáveis

- **Modais:**
  - Tamanho adaptativo
  - Scroll interno quando necessário
  - Botões de ação reorganizados

### 10.3 Sistema de Ações
- **Desktop:**
  - Botões individuais em grupos
  - Tooltips explicativos
  - Ações via hover

- **Mobile:**
  - Menu dropdown com três pontos
  - Ações agrupadas por contexto
  - Ícones grandes para touch

---

## 11. VALIDAÇÕES E TRATAMENTO DE ERROS

### 11.1 Validações de Upload
- **Arquivos:**
  - Formato PDF obrigatório
  - Tamanho máximo 50MB
  - Verificação de integridade
  - Detecção de duplicatas

### 11.2 Validações de Formulário
- **Campos Obrigatórios:**
  - Nome de usuário (mín. 3 caracteres)
  - Email válido
  - Senha (mín. 6 caracteres)
  - Nome da lista

### 11.3 Sistema de Notificações
- **Toast Messages:**
  - Notificações de sucesso (verde)
  - Avisos (amarelo)
  - Erros (vermelho)
  - Auto-hide após 3 segundos
  - Animações suaves

### 11.4 Tratamento de Erros
- **Erros de Upload:**
  - Feedback específico por tipo de erro
  - Recuperação graceful
  - Log detalhado no servidor

- **Erros de Rede:**
  - Retry automático em alguns casos
  - Mensagens explicativas
  - Estados de loading/erro

---

## 12. SEGURANÇA E PERFORMANCE

### 12.1 Segurança
- **Autenticação:**
  - Hashing seguro de senhas (werkzeug)
  - Sessões protegidas
  - Timeout de sessão

- **Upload:**
  - Validação rigorosa de tipos
  - Sanitização de nomes de arquivo
  - Quarentena de uploads

### 12.2 Performance
- **Caching:**
  - Cache de metadados extraídos
  - Lazy loading de PDFs
  - Otimização de queries

- **Frontend:**
  - Carregamento assíncrono via AJAX
  - Debounce em buscas
  - Paginação para grandes datasets

---

## 13. FUNCIONALIDADES ADMINISTRATIVAS

### 13.1 Limpeza de Sistema
- **Ferramentas Admin:**
  - Limpeza de arquivos órfãos
  - Reindexação de metadados
  - Verificação de integridade
  - Backup de dados

### 13.2 Configurações
- **Settings Admin:**
  - Configuração de limites de upload
  - Configuração de timeout de sessão
  - Configuração de caminhos de armazenamento

---

## 14. ESTADO ATUAL E TECNOLOGIAS

### 14.1 Backend (Flask)
- **Framework:** Flask
- **Database:** SQLite com schema bem estruturado
- **PDF Processing:** PyPDF2 para metadados, PDF.js para visualização
- **File Handling:** Sistema robusto de upload e organização
- **Security:** Werkzeug para hashing, Flask-Session para sessões

### 14.2 Frontend Atual
- **CSS Framework:** Bootstrap 5
- **JavaScript:** Vanilla JS com jQuery
- **Icons:** Font Awesome
- **Charts:** Chart.js
- **PDF Viewer:** PDF.js

### 14.3 Features Prontas para Migração
- **Toda a lógica de negócio está no backend**
- **APIs REST bem definidas**
- **Estrutura de dados consolidada**
- **Sistema de autenticação modular**
- **Interface responsiva como referência**

---

## 15. PONTOS DE ATENÇÃO PARA MIGRAÇÃO

### 15.1 Manter no Backend
- **Todo o sistema de autenticação Flask**
- **Processamento de PDFs e metadados**
- **Sistema de arquivos e upload**
- **Banco de dados SQLite**
- **APIs existentes**

### 15.2 Migrar para ShadcnUI
- **Toda a interface de usuário**
- **Componentes de formulário**
- **Sistema de navegação**
- **Dashboards e gráficos**
- **Modais e notificações**

### 15.3 Funcionalidades Críticas
- **Sistema drag-and-drop das listas**
- **Preview e navegação de PDFs**
- **Upload com progress**
- **Filtros avançados**
- **Responsive design**

---

## CONCLUSÃO

Este sistema é um organizador completo de músicas religiosas com funcionalidades robustas de catalogação, lista personalizada, análises estatísticas e uma interface amigável. A arquitetura atual com Flask no backend está bem estruturada e pode ser mantida, enquanto o frontend pode ser completamente redesenhado com ShadcnUI mantendo todas as funcionalidades existentes.

As APIs já estão prontas para consumo por um frontend moderno, e o sistema de autenticação e gerenciamento de arquivos pode permanecer inalterado, facilitando a migração gradual da interface.