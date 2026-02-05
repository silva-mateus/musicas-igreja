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
- **Entity Framework Core** - ORM para SQLite
- **BCrypt** - Hash seguro de senhas
- **iText7** - Manipulação de PDFs

### Frontend
- **Next.js 14** - Framework React com Server-Side Rendering
- **TypeScript** - Tipagem estática
- **TanStack Query** - Gerenciamento de estado e cache
- **React Hook Form + Zod** - Validação de formulários
- **Tailwind CSS** - Estilização
- **shadcn/ui** - Componentes UI

### Infraestrutura
- **Docker / Docker Compose** - Containerização
- **GitHub Actions** - CI/CD automatizado
- **SQLite** - Banco de dados

## 🚀 Instalação e Execução

### Pré-requisitos
- [Docker](https://www.docker.com/) e Docker Compose
- Ou: [.NET 9.0 SDK](https://dotnet.microsoft.com/download) + [Node.js 20+](https://nodejs.org/)

### Opção 1: Docker (Recomendado)

```bash
# Clone o repositório
git clone https://github.com/silva-mateus-org/musicas-igreja.git
cd musicas-igreja

# Inicie os containers
docker-compose up -d

# Acesse a aplicação
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
```

### Opção 2: Desenvolvimento Local

#### Backend
```bash
cd backend
dotnet restore
dotnet run
# API disponível em http://localhost:5000
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
# Interface disponível em http://localhost:3000
```

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

## 📁 Estrutura do Projeto

```
musicas-igreja/
├── backend/                 # API em C# / ASP.NET Core
│   ├── Controllers/         # Endpoints da API
│   ├── Services/            # Lógica de negócio
│   ├── Models/              # Modelos de dados
│   ├── Data/                # Contexto EF Core
│   └── Migrations/          # Migrações do banco
├── backend.tests/           # Testes unitários
├── frontend/                # Interface em Next.js
│   └── src/
│       ├── app/             # Páginas (App Router)
│       ├── components/      # Componentes React
│       ├── contexts/        # Context API (Auth, etc)
│       └── lib/             # Utilitários
└── .github/workflows/       # CI/CD
```

## 🔒 Segurança

- ✅ Senhas com hash BCrypt (work factor 12)
- ✅ Migração automática de senhas legadas (SHA256 → BCrypt)
- ✅ Invalidação de sessões ao reiniciar servidor
- ✅ Proteção contra SQL Injection (Entity Framework)
- ✅ Validação de uploads (apenas PDFs, limite 50MB)
- ✅ Cookies HttpOnly e SameSite
- ✅ Controle de permissões granular (RBAC)
- ✅ Headers de segurança configurados

## 📄 Licença

Este projeto é de código aberto e está disponível sob a [Licença MIT](LICENSE).

## 🤝 Contribuindo

Atualmente não estou aceitando contribuições externas via Pull Request. No entanto, você pode fazer o clone do repositório e utilizá-lo conforme desejar para fins pessoais ou de estudo.


## 📞 Contato

- **Repositório:** [github.com/silva-mateus-org/musicas-igreja](https://github.com/silva-mateus-org/musicas-igreja)
- **Produção:** [cifras.networkmat.uk](https://cifras.networkmat.uk/)
