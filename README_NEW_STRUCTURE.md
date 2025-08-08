# 🎵 Sistema de Músicas da Igreja - Nova Arquitetura

## 📋 Visão Geral

Sistema completo para gerenciamento de músicas religiosas, agora com arquitetura moderna separando **Backend Flask** e **Frontend NextJS + ShadcnUI**.

### 🏗️ **Nova Estrutura do Projeto**

```
musicas-igreja/
├── backend/                    # 🐍 Backend Flask API
│   ├── app.py                 # Aplicação principal Flask
│   ├── requirements.txt       # Dependências Python
│   ├── data/                  # Dados persistentes
│   ├── uploads/               # Arquivos enviados
│   ├── organized/             # Arquivos organizados
│   └── logs/                  # Logs da aplicação
├── frontend/                   # ⚛️ Frontend NextJS + ShadcnUI
│   ├── src/                   # Código fonte
│   ├── components/            # Componentes React
│   ├── lib/                   # Utilitários
│   ├── hooks/                 # React Hooks customizados
│   ├── types/                 # Tipos TypeScript
│   ├── package.json           # Dependências Node.js
│   └── next.config.js         # Configuração NextJS
├── docker/                     # 🐳 Configurações Docker
│   ├── backend/               # Dockerfile do backend
│   ├── frontend/              # Dockerfile do frontend
│   └── nginx/                 # Configuração Nginx
├── .github/                    # 🚀 CI/CD GitHub Actions
│   └── workflows/
├── docs/                       # 📚 Documentação
└── docker-compose.yml         # Orquestração dos serviços
```

---

## 🚀 **Como Executar**

### **Desenvolvimento Local**

1. **Clonar o repositório:**
```bash
git clone <repo-url>
cd musicas-igreja
```

2. **Executar com Docker (Recomendado):**
```bash
# Desenvolvimento
docker-compose -f docker-compose.dev.yml up --build

# Produção
docker-compose up --build
```

3. **Executar manualmente (Desenvolvimento):**

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python app.py
# Disponível em: http://localhost:5000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Disponível em: http://localhost:3000
```

### **URLs dos Serviços**

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **Health Check:** http://localhost:5000/health
- **Nginx (Produção):** http://localhost:8080

---

## 🔧 **Configuração**

### **Variáveis de Ambiente**

Crie um arquivo `.env` na raiz do projeto:

```env
# Backend
SECRET_KEY=your-secret-key-here
FLASK_ENV=development
DATABASE_PATH=/app/data/pdf_organizer.db
UPLOAD_FOLDER=/app/data/uploads

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:5000
NODE_ENV=development

# Produção
APP_URL=https://seu-dominio.com
```

### **Configuração de Desenvolvimento**

```bash
# Instalar dependências do backend
cd backend && pip install -r requirements.txt

# Instalar dependências do frontend
cd frontend && npm install

# Executar backend
cd backend && python app.py

# Executar frontend (novo terminal)
cd frontend && npm run dev
```

---

## 🎯 **Principais Funcionalidades Mantidas**

### ✅ **Sistema de Autenticação**
- Login/Registro de usuários
- Controle de sessões
- Papéis de usuário (admin/user)
- Painel administrativo

### ✅ **Gerenciamento de PDFs**
- Upload múltiplo de arquivos
- Extração automática de metadados
- Sistema de substituição de arquivos
- Visualizador PDF integrado

### ✅ **Catalogação Avançada**
- Metadados editáveis (nome, artista, categoria, etc.)
- Sistema multi-categoria
- Tempos litúrgicos
- Links do YouTube

### ✅ **Sistema de Listas**
- Criação de listas personalizadas
- Drag-and-drop para reordenação
- Merge de PDFs
- Relatórios automáticos

### ✅ **Busca e Filtros**
- Busca textual avançada
- Filtros por categoria/tempo litúrgico
- Seleção múltipla
- Ações em lote

### ✅ **Dashboard e Análises**
- Estatísticas detalhadas
- Gráficos interativos
- Rankings de músicas/artistas
- Análises por categoria

---

## 🔄 **Migração dos Dados**

Os dados existentes são **100% compatíveis**:

1. **Banco SQLite**: Mantido integralmente
2. **Arquivos PDF**: Preservados com mesmo sistema
3. **Estrutura de dados**: Idêntica ao sistema anterior
4. **Sessões**: Compatibilidade total

### **Como Migrar**

1. Copie o arquivo `pdf_organizer.db` para `backend/data/`
2. Copie a pasta `uploads/` para `backend/uploads/`
3. Copie a pasta `organized/` para `backend/organized/`

---

## 🐳 **Docker em Produção**

### **Builds Separados**

```bash
# Build do backend
docker build -f docker/backend/Dockerfile -t musicas-backend .

# Build do frontend  
docker build -f docker/frontend/Dockerfile -t musicas-frontend .

# Executar com docker-compose
docker-compose up -d
```

### **Volumes Persistentes**

- `backend_data`: Dados do backend (SQLite, uploads, logs)
- Configurações via volume montado em `/app/config`

---

## 🚀 **CI/CD Atualizado**

O workflow do GitHub Actions foi atualizado para:

1. **Testar** backend (Python) e frontend (TypeScript)
2. **Buildar** imagens separadas para cada serviço
3. **Deploy** orquestrado com docker-compose
4. **Health checks** para ambos os serviços

### **Registry de Imagens**

- Backend: `ghcr.io/usuario/musicas-igreja-backend:latest`
- Frontend: `ghcr.io/usuario/musicas-igreja-frontend:latest`

---

## 🎨 **Frontend Moderno**

### **Tecnologias Utilizadas**

- **NextJS 14**: Framework React com SSR
- **ShadcnUI**: Componentes modernos e acessíveis
- **TailwindCSS**: Styling utilitário
- **TypeScript**: Tipagem estática
- **React Query**: Gerenciamento de estado/cache
- **React Hook Form**: Formulários performáticos

### **Componentes Principais**

- **Layout responsivo** com design mobile-first
- **Componentes reutilizáveis** com ShadcnUI
- **Sistema de temas** claro/escuro
- **Navegação intuitiva** e moderna
- **Performance otimizada** com lazy loading

---

## 🔐 **Segurança**

### **Backend**
- Autenticação JWT/Session
- Validação rigorosa de uploads
- Sanitização de dados
- Rate limiting

### **Frontend**
- CSP (Content Security Policy)
- XSS Protection
- CSRF Protection
- Validação de formulários

### **Docker**
- Usuários não-root
- Multi-stage builds
- Imagens minimalistas
- Secrets via environment

---

## 📊 **Performance**

### **Backend**
- Cache de metadados
- Lazy loading de PDFs
- Otimização de queries SQL
- Compressão de responses

### **Frontend**
- Code splitting automático
- Lazy loading de componentes
- Otimização de imagens
- Service Worker (PWA ready)

---

## 🔧 **Desenvolvimento**

### **Estrutura do Código**

#### **Backend (`/backend`)**
```
app.py              # Aplicação Flask principal
requirements.txt    # Dependências Python
config/            # Configurações
models/            # Modelos de dados (futuro)
utils/             # Utilitários (futuro)
```

#### **Frontend (`/frontend`)**
```
src/
  pages/           # Páginas NextJS
  components/      # Componentes React
  lib/            # Utilitários e configurações
  hooks/          # React Hooks customizados
  types/          # Tipos TypeScript
  styles/         # Estilos globais
```

### **Scripts Úteis**

```bash
# Desenvolvimento
npm run dev          # Frontend dev server
python app.py        # Backend dev server

# Build
npm run build        # Build do frontend
docker-compose build # Build dos containers

# Teste
npm run lint         # Lint do frontend
python -m pytest    # Testes do backend

# Tipo checking
npm run type-check   # TypeScript checking
```

---

## 📚 **API Documentation**

### **Endpoints Principais**

- `GET /health` - Health check
- `POST /api/auth/login` - Login
- `GET /api/music` - Listar músicas
- `POST /api/upload` - Upload de arquivos
- `GET /api/lists` - Listar listas
- `GET /api/dashboard/stats` - Estatísticas

### **Autenticação**

A API utiliza **sessões Flask** para autenticação. Todas as rotas protegidas requerem login válido.

---

## 🤝 **Contribuição**

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📞 **Suporte**

- **Documentação**: Ver pasta `/docs`
- **Issues**: GitHub Issues
- **Logs**: Disponíveis em `backend/logs/`

---

## 🎉 **Próximos Passos**

- [ ] Implementar componentes ShadcnUI restantes
- [ ] Adicionar testes automatizados
- [ ] Configurar PWA
- [ ] Implementar modo offline
- [ ] Adicionar autenticação OAuth
- [ ] Migrar para PostgreSQL (opcional)

---

**🎵 Sistema criado com ❤️ para comunidades religiosas**