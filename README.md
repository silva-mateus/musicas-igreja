# 🎵 Sistema de Músicas da Igreja

Sistema web completo para gerenciamento de partituras e repertórios musicais da igreja, com autenticação, controle de permissões e organização inteligente de PDFs.

## 🌐 Demonstração

Acesse a aplicação em produção: **[https://cifras.networkmat.uk/](https://cifras.networkmat.uk/)**

## ✨ Principais Funcionalidades

- 📤 **Upload e Organização de PDFs** - Upload de partituras com metadados completos
- 🔍 **Busca Inteligente** - Busca por título, artista, categoria, tempo litúrgico e tom
- 🎯 **Filtros Dinâmicos** - Múltiplos filtros com sugestões baseadas em seleções anteriores
- 📋 **Listas de Músicas** - Crie repertórios e exporte como PDF único
- 🎼 **Gestão de Entidades** - Gerenciamento de artistas, categorias e tempos litúrgicos
- 👥 **Sistema de Usuários** - Autenticação com controle de permissões (RBAC)
- 🔐 **Perfil de Usuário** - Altere nome e senha sem intervenção de admin
- 📊 **Dashboard** - Estatísticas e visualização de dados
- 🎨 **Interface Moderna** - Design responsivo com tema dark

## 🛠️ Tecnologias

### Backend
- **C# / ASP.NET Core 9.0** - API RESTful
- **Entity Framework Core + Pomelo** - ORM para MySQL
- **Core.Auth** - Autenticacao, RBAC com permissoes string-based, rate limiting
- **Core.FileManagement** - Upload/storage de PDFs com deduplicacao
- **PdfSharpCore** - Manipulacao de PDFs

### Frontend
- **Next.js 14** - Framework React com Server-Side Rendering
- **TypeScript** - Tipagem estatica
- **TanStack Query** - Gerenciamento de estado e cache
- **React Hook Form + Zod** - Validacao de formularios
- **Tailwind CSS** - Estilizacao
- **shadcn/ui** - Componentes UI (compartilhados via core)

### Infraestrutura
- **Docker / Docker Compose** - Containerizacao
- **GitHub Actions + Self-hosted Runner** - CI/CD com testes paralelos e push para GHCR
- **Watchtower** - CD automatico: detecta nova imagem no GHCR e reinicia containers
- **MySQL 8.0** - Banco de dados (compartilhado via homelab)
- **Cloudflare Tunnel** - Acesso externo
- **core-system** - Submodule com codigo compartilhado (auth, file management, UI)

## 🚀 Instalação e Execução

### Pré-requisitos
- [Docker](https://www.docker.com/) e Docker Compose
- Ou: [.NET 9.0 SDK](https://dotnet.microsoft.com/download) + [Node.js 20+](https://nodejs.org/)

### Clonar com submodule

```bash
git clone --recurse-submodules https://github.com/silva-mateus-org/musicas-igreja.git
cd musicas-igreja
```

### Desenvolvimento Local

#### Backend (requer MySQL rodando)
```bash
cd backend
dotnet restore
dotnet run
# API disponivel em http://localhost:5000
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
# Interface disponivel em http://localhost:3000
```

### Deploy (Servidor / homelab-infra)

O deploy e automatizado: GitHub Actions builda a imagem e faz push para GHCR; Watchtower detecta a nova imagem e reinicia os containers automaticamente.

**Setup inicial:**

1. Configurar secret `CORE_SYSTEM_SSH_KEY` no repositorio (ver `.github/workflows/SETUP.md`)
2. Configurar Watchtower no homelab com credenciais GHCR (ver `.github/workflows/SETUP.md`)
3. Atualizar `docker-compose.yml` do homelab para usar imagens `ghcr.io/silva-mateus/musicas-igreja-*:latest`

O push para `main` aciona automaticamente testes + build + push para GHCR.

## 🔐 Acesso Padrão

Ao iniciar pela primeira vez, um usuário administrador é criado automaticamente:

- **Usuário:** `admin`
- **Senha:** `admin123`

> ⚠️ **IMPORTANTE:** Altere a senha padrão imediatamente após o primeiro acesso!

## 🧪 Testes

O projeto inclui 142+ testes automatizados:

```bash
# Backend
cd backend.tests
dotnet test --configuration Release

# Frontend
cd frontend
npm run build  # Inclui type-checking
```

Os testes são executados automaticamente no CI/CD antes de cada deploy.

## CI/CD

### Fluxo

| Evento | Jobs executados |
|---|---|
| PR / push para `develop` | `test-backend` + `test-frontend` em paralelo |
| Push para `main` | testes → build → push para GHCR → Watchtower reinicia containers |

Build e deploy são separados: Actions builda a imagem Docker e faz push para o GHCR; Watchtower (homelab) detecta o novo digest em até 5 minutos e reinicia os containers automaticamente.

### Debugar falhas

- Aba **Actions** no GitHub → selecionar o job com falha
- Backend: baixar artefato `backend-test-results` (`.trx` + coverage XML)
- Self-hosted runner offline: `sudo systemctl status actions.runner.*` na VM do homelab
- Watchtower nao atualiza: `docker logs watchtower | grep musicas`

### Adaptar para outro app

Ver [`.github/workflows/SETUP.md`](.github/workflows/SETUP.md).

## 📁 Estrutura do Projeto

```
musicas-igreja/
├── backend/                 # API em C# / ASP.NET Core
│   ├── Controllers/         # Endpoints da API
│   ├── Services/            # Logica de negocio
│   ├── Models/              # Modelos de dados
│   ├── Data/                # Contexto EF Core
│   └── Permissions.cs       # Permissoes do projeto
├── backend.tests/           # Testes unitarios
├── frontend/                # Interface em Next.js
│   └── src/
│       ├── app/             # Paginas (App Router)
│       ├── components/      # Componentes React
│       └── lib/             # Utilitarios
├── core/                    # Submodule core-system
│   ├── backend/src/         # Core.Auth, Core.FileManagement, Core.Infrastructure
│   └── frontend/            # Componentes UI, auth context, hooks compartilhados
└── .github/workflows/       # CI/CD
```

## 🔒 Segurança

- Senhas com hash BCrypt (work factor 12) via Core.Auth
- Rate limiting por IP+usuario (5 tentativas, lockout 15min)
- Cookies HttpOnly e SameSite
- Permissoes granulares string-based (RBAC via Core.Auth)
- Validacao de uploads (apenas PDFs, limite 50MB)
- Headers de seguranca configurados
- Audit logging de acoes via middleware

## 📄 Licença

Este projeto é de código aberto e está disponível sob a [Licença MIT](LICENSE).

## 🤝 Contribuindo

Atualmente não estou aceitando contribuições externas via Pull Request. No entanto, você pode fazer o clone do repositório e utilizá-lo conforme desejar para fins pessoais ou de estudo.


## 📞 Contato

- **Repositório:** [github.com/silva-mateus-org/musicas-igreja](https://github.com/silva-mateus-org/musicas-igreja)
- **Produção:** [cifras.networkmat.uk](https://cifras.networkmat.uk/)
