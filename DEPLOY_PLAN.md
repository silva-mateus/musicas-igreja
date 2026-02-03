# Plano de Deploy - Migração Backend Python → C#

## 📊 Análise de Segurança

### ✅ Backend C# - Seguro

| Área | Status | Notas |
|------|--------|-------|
| **SQL Injection** | ✅ Seguro | Usa Entity Framework com LINQ, não há queries raw com input do usuário |
| **Password Hashing** | ✅ BCrypt | Work factor 12, com suporte retroativo para SHA256 legado |
| **Session Management** | ✅ Seguro | Cookies HttpOnly, SameSite, expiração 24h |
| **CORS** | ✅ Configurado | Apenas origens específicas (localhost:3000, localhost:5000) |
| **Debug Endpoints** | ✅ Protegidos | Retornam 404 em ambiente de produção |
| **File Upload** | ✅ Validado | Limite 50MB, apenas PDFs, hash para duplicados |
| **Path Traversal** | ✅ Protegido | Normalização de paths, arquivos dentro de `organized/` |

### ✅ Frontend Next.js - Seguro

| Área | Status | Notas |
|------|--------|-------|
| **XSS** | ✅ Seguro | Não usa `dangerouslySetInnerHTML`, React escapa por padrão |
| **Security Headers** | ✅ Configurado | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection |
| **CSRF** | ✅ Protegido | Cookies SameSite + Sessions server-side |
| **API Proxy** | ✅ Seguro | Next.js API routes fazem proxy seguro para backend |
| **Secrets** | ✅ Env vars | BACKEND_URL via variáveis de ambiente |

### ⚠️ Avisos Menores (Baixo Risco)

1. **Program.cs SQL com string interpolation** - O hash BCrypt é gerado internamente (não é input do usuário), então é seguro mas gera warning do EF Core.

2. **highlightText não utilizada** - Função em `lib/utils.ts` retorna HTML mas não é usada em lugar nenhum. Pode ser removida.

---

## 🔄 Comparação Backend Python vs C#

### Funcionalidades Migradas ✅

| Funcionalidade | Python | C# | Status |
|----------------|--------|-----|--------|
| Upload de PDFs | ✅ | ✅ | ✅ OK |
| Listagem com filtros | ✅ | ✅ | ✅ OK |
| Busca de músicas | ✅ | ✅ | ✅ OK (+ fuzzy search) |
| Download/Stream PDF | ✅ | ✅ | ✅ OK (melhorado com PhysicalFile) |
| Merge Lists (playlists) | ✅ | ✅ | ✅ OK |
| Export PDF (merge) | ✅ | ✅ | ✅ OK |
| Categorias CRUD | ✅ | ✅ | ✅ OK |
| Tempos Litúrgicos CRUD | ✅ | ✅ | ✅ OK |
| Artistas CRUD | ✅ | ✅ | ✅ OK |
| Verificar PDFs | ✅ | ✅ | ✅ OK |
| Corrigir nomes PDFs | ✅ | ✅ | ✅ OK |
| Dashboard stats | ✅ | ✅ | ✅ OK |
| Merge entidades | ✅ | ✅ | ✅ OK |
| Discovery entidades | ✅ | ✅ | ✅ OK |
| Cleanup entidades | ✅ | ✅ | ✅ OK |
| Search suggestions | ✅ | ✅ | ✅ OK (novo endpoint) |
| Check duplicate | ✅ | ✅ | ✅ OK (novo endpoint) |

### Funcionalidades Novas no C# 🆕

| Funcionalidade | Descrição |
|----------------|-----------|
| **Autenticação completa** | Login, logout, sessões, change password |
| **RBAC (Roles)** | Sistema de permissões granular |
| **Gestão de Usuários** | CRUD completo de usuários |
| **Gestão de Roles** | CRUD de roles com permissões |
| **Busca fuzzy** | Busca insensível a acentos |
| **BCrypt passwords** | Hash seguro de senhas |
| **Testes unitários** | 143 testes automatizados |

### O que NÃO foi migrado (intencionalmente)

| Funcionalidade | Motivo |
|----------------|--------|
| Templates HTML | Frontend agora é React/Next.js separado |
| Flask session | Substituído por ASP.NET Core session |
| Google Drive sync | Não implementado (futuro) |

---

## 📋 Checklist Pré-Deploy

### 1. Verificar Ambiente de Produção

```bash
# Variáveis de ambiente necessárias
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://+:5000
Database__Path=/app/data/musicas.db
```

### 2. Backup do Banco de Dados Atual

```bash
# No servidor de produção, antes do deploy:
cp backend-py/data/pdf_organizer.db backup_$(date +%Y%m%d_%H%M%S).db
```

### 3. Migrar Dados do SQLite

O banco de dados SQLite do Python (`pdf_organizer.db`) pode ser usado diretamente pelo C# (`musicas.db`). As tabelas são compatíveis:

```bash
# Copiar banco de dados
cp backend-py/data/pdf_organizer.db backend/data/musicas.db
```

**IMPORTANTE:** O novo backend irá:
- Adicionar tabelas `roles` e `users` automaticamente
- Criar usuário `admin` com senha `admin123` (se não existir)
- Adicionar colunas novas se necessário

### 4. Copiar Arquivos PDFs

```bash
# Os PDFs ficam em organized/
# Se estiverem em locais diferentes:
cp -r backend-py/organized/* backend/organized/
```

### 5. Rodar Testes Antes do Deploy

```bash
cd backend.tests
dotnet test --configuration Release
# TODOS os 143 testes devem passar
```

---

## 🚀 Processo de Deploy

### Opção A: Deploy Substituindo Backend Python

```
┌─────────────────────────────────────────────────┐
│           ARQUITETURA ATUAL                      │
├─────────────────────────────────────────────────┤
│  Frontend (Next.js:3000)                         │
│       ↓                                          │
│  Backend Python (Flask:5000)  ← SERÁ REMOVIDO    │
│       ↓                                          │
│  SQLite (pdf_organizer.db)                       │
└─────────────────────────────────────────────────┘

                    ⬇️ MIGRAÇÃO ⬇️

┌─────────────────────────────────────────────────┐
│           ARQUITETURA NOVA                       │
├─────────────────────────────────────────────────┤
│  Frontend (Next.js:3000)                         │
│       ↓                                          │
│  Backend C# (ASP.NET:5000)    ← NOVO             │
│       ↓                                          │
│  SQLite (musicas.db)          ← MESMO SCHEMA     │
└─────────────────────────────────────────────────┘
```

### Passos para Deploy

```bash
# 1. Parar serviços atuais
docker-compose down  # ou pm2 stop all

# 2. Backup completo
tar -czvf backup_$(date +%Y%m%d).tar.gz backend-py/data/ backend-py/organized/

# 3. Copiar banco de dados
cp backend-py/data/pdf_organizer.db backend/data/musicas.db

# 4. Copiar PDFs (se em local diferente)
cp -r backend-py/organized/* backend/organized/

# 5. Build do novo backend
cd backend
dotnet publish -c Release -o ./publish

# 6. Iniciar novo backend
cd publish
dotnet MusicasIgreja.Api.dll

# 7. Verificar funcionamento
curl http://localhost:5000/api/health
```

### Deploy com Docker

```bash
# Build das imagens
docker build -t musicas-backend:latest ./backend
docker build -t musicas-frontend:latest ./frontend

# Rodar containers
docker-compose up -d
```

---

## 📁 Arquivamento do Backend Python

Após confirmar que o deploy funcionou:

### 1. Criar branch de arquivo

```bash
git checkout -b archive/backend-python
git add backend-py/
git commit -m "archive: backend python before C# migration"
git push origin archive/backend-python
```

### 2. Remover do branch principal

```bash
git checkout main
git rm -r backend-py/
git commit -m "chore: remove deprecated python backend (migrated to C#)"
git push origin main
```

### 3. Atualizar .gitignore (opcional)

```bash
echo "# Archived backends" >> .gitignore
echo "backend-py/" >> .gitignore
```

---

## ⏪ Rollback (se necessário)

Se algo der errado após o deploy:

```bash
# 1. Parar backend C#
# 2. Restaurar backup
tar -xzvf backup_YYYYMMDD.tar.gz
cp backup_YYYYMMDD/pdf_organizer.db backend-py/data/

# 3. Reiniciar backend Python
cd backend-py
python app.py  # ou docker-compose up
```

---

## ✅ Verificação Pós-Deploy

Execute estes testes após o deploy:

| Teste | Comando/Ação |
|-------|--------------|
| Health check | `curl http://localhost:5000/api/health` |
| Login | Tentar login com admin/admin123 |
| Listar músicas | Abrir `/music` no frontend |
| Buscar música | Pesquisar por nome/artista |
| Upload PDF | Fazer upload de um PDF teste |
| Download PDF | Baixar um PDF existente |
| Criar lista | Criar uma merge list |
| Exportar lista | Exportar lista como PDF |
| Verificar roles | Acessar `/settings/roles` |
| Verificar usuários | Acessar `/settings/users` |

---

## 📝 Notas Finais

1. **Primeira execução**: O backend C# criará automaticamente as tabelas de `roles` e `users` com dados default.

2. **Senhas existentes**: Se houver usuários do Python com senhas SHA256, eles poderão fazer login normalmente (compatibilidade retroativa). A senha será atualizada para BCrypt no próximo login.

3. **PDFs**: Os arquivos PDF não são alterados. O C# usa a mesma estrutura de pastas `organized/`.

4. **Performance**: O backend C# é significativamente mais rápido que o Python (compilado vs interpretado).

5. **Suporte futuro**: Com testes unitários e CI/CD configurados, futuras alterações são mais seguras.
