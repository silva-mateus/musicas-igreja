# Músicas Igreja

Sistema de gerenciamento de partituras e cifras para músicas litúrgicas. Permite organizar, categorizar e criar listas de músicas em PDF para celebrações religiosas.

## Tecnologias

### Backend
- **C# / .NET 9** (ASP.NET Core Web API)
- **Entity Framework Core** com SQLite
- **Swagger** para documentação da API

### Frontend
- **Next.js 14** com App Router
- **TypeScript**
- **Tailwind CSS** + **shadcn/ui**

## Funcionalidades

- Upload e organização de partituras em PDF
- Categorização por tipo de música (Entrada, Comunhão, Ofertório, etc.)
- Classificação por tempo litúrgico (Advento, Quaresma, Páscoa, etc.)
- Busca por nome da música, artista ou tom
- Criação de listas para celebrações (merge lists)
- Exportação de listas como PDF único
- Detecção automática de duplicatas via hash MD5

## Estrutura do Projeto

```
musicas-igreja/
├── backend/                   # API ASP.NET Core
│   ├── Controllers/           # Endpoints da API
│   ├── Models/                # Entidades do domínio
│   ├── Data/                  # DbContext e configuração
│   ├── Services/              # Lógica de negócio
│   ├── DTOs/                  # Data Transfer Objects
│   ├── Program.cs             # Configuração da aplicação
│   ├── MusicasIgreja.Api.csproj
│   └── Dockerfile
├── frontend/                  # Interface Next.js
│   ├── src/
│   │   ├── app/               # Páginas e rotas (App Router)
│   │   ├── components/        # Componentes React
│   │   └── lib/               # Utilitários e cliente API
│   └── package.json
└── README.md
```

## Instalação

### Pré-requisitos
- .NET SDK 9.0+
- Node.js 18+
- npm ou pnpm

### Backend

```bash
cd backend
dotnet restore
dotnet run
```

O backend estará disponível em `http://localhost:5000`

A documentação Swagger está em `http://localhost:5000/swagger`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend estará disponível em `http://localhost:3000`

## Configuração

### Backend (appsettings.json)

```json
{
  "Database": {
    "Path": "data/musicas.db"
  },
  "Storage": {
    "OrganizedFolder": "organized"
  }
}
```

### Frontend (.env.local)

```env
BACKEND_URL=http://localhost:5000
```

## API Endpoints

### Arquivos (PDFs)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/files` | Listar arquivos com paginação e filtros |
| POST | `/api/files` | Upload de novo arquivo |
| GET | `/api/files/{id}` | Detalhes do arquivo |
| PUT | `/api/files/{id}` | Atualizar metadados |
| DELETE | `/api/files/{id}` | Remover arquivo |
| GET | `/api/files/{id}/download` | Download do PDF |
| GET | `/api/files/{id}/stream` | Visualização inline |

### Listas de Músicas
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/merge_lists` | Listar todas as listas |
| POST | `/api/merge_lists` | Criar nova lista |
| GET | `/api/merge_lists/{id}` | Detalhes da lista |
| PUT | `/api/merge_lists/{id}` | Atualizar lista |
| DELETE | `/api/merge_lists/{id}` | Remover lista |
| POST | `/api/merge_lists/{id}/items` | Adicionar músicas à lista |
| POST | `/api/merge_lists/{id}/reorder` | Reordenar itens |
| POST | `/api/merge_lists/{id}/duplicate` | Duplicar lista |
| GET | `/api/merge_lists/{id}/export` | Exportar como PDF |

### Categorias e Metadados
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/categories` | Listar categorias |
| POST | `/api/categories` | Criar categoria |
| GET | `/api/liturgical_times` | Listar tempos litúrgicos |
| POST | `/api/liturgical_times` | Criar tempo litúrgico |
| GET | `/api/dashboard/stats` | Estatísticas do sistema |
| GET | `/api/dashboard/get_artists` | Listar artistas |
| GET | `/api/filters/suggestions` | Sugestões para filtros |
| GET | `/api/health` | Health check |

## Deploy com Docker

```bash
cd backend
docker build -t musicas-igreja-api .
docker run -p 5000:5000 -v ./data:/app/data -v ./organized:/app/organized musicas-igreja-api
```

## Arquitetura

O projeto segue uma arquitetura em camadas:

- **Controllers**: Recebem requisições HTTP e delegam para serviços
- **Services**: Contêm a lógica de negócio
- **Models**: Entidades do domínio mapeadas para o banco
- **DTOs**: Objetos de transferência entre camadas
- **Data**: Configuração do Entity Framework e DbContext

## Licença

MIT License

