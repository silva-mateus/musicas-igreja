# Músicas Igreja - Backend API

API REST desenvolvida em ASP.NET Core para gerenciamento de partituras musicais litúrgicas.

## Stack Tecnológica

- **.NET 9** / **ASP.NET Core**
- **Entity Framework Core 9** com SQLite
- **Swagger/OpenAPI** para documentação

## Estrutura

```
backend/
├── Controllers/
│   ├── FilesController.cs         # CRUD de arquivos PDF
│   ├── MergeListsController.cs    # Listas de músicas
│   ├── CategoriesController.cs    # Categorias e tempos litúrgicos
│   ├── DashboardController.cs     # Estatísticas
│   ├── FiltersController.cs       # Sugestões para filtros
│   ├── ReportsController.cs       # Geração de relatórios
│   └── HealthController.cs        # Health check
├── Models/
│   ├── PdfFile.cs                 # Entidade principal
│   ├── Category.cs
│   ├── LiturgicalTime.cs
│   ├── MergeList.cs
│   └── ...
├── Data/
│   └── AppDbContext.cs            # Contexto do EF Core
├── Services/
│   ├── IFileService.cs
│   └── FileService.cs             # Lógica de arquivos
├── DTOs/
│   ├── FileDto.cs
│   └── MergeListDto.cs
├── Program.cs                     # Configuração
├── appsettings.json
└── MusicasIgreja.Api.csproj
```

## Executando

```bash
# Restaurar dependências
dotnet restore

# Executar em desenvolvimento
dotnet run

# Ou com watch para hot reload
dotnet watch run
```

A API estará disponível em `http://localhost:5000`.

## Endpoints Principais

Acesse `/swagger` para documentação interativa completa.

### Files
```
GET    /api/files              # Listar com filtros
POST   /api/files              # Upload (multipart/form-data)
GET    /api/files/{id}         # Detalhes
PUT    /api/files/{id}         # Atualizar
DELETE /api/files/{id}         # Remover
GET    /api/files/{id}/stream  # Visualizar PDF
```

### Merge Lists
```
GET    /api/merge_lists             # Listar
POST   /api/merge_lists             # Criar
GET    /api/merge_lists/{id}        # Detalhes
PUT    /api/merge_lists/{id}        # Atualizar
DELETE /api/merge_lists/{id}        # Remover
POST   /api/merge_lists/{id}/items  # Adicionar música
```

## Configuração

### appsettings.json

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

## Docker

```bash
docker build -t musicas-api .
docker run -p 5000:5000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/organized:/app/organized \
  musicas-api
```

