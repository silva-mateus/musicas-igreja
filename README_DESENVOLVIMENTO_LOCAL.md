# 🚀 Guia de Desenvolvimento Local - Sistema Músicas Igreja

## 📋 Visão Geral

Este guia explica como executar o sistema **sem Docker** em ambiente de desenvolvimento local, ideal para desenvolvimento ativo do código.

---

## 🔧 **Pré-requisitos**

### **Obrigatórios:**
- **Python 3.8+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** (incluído com Node.js)

### **Opcionais:**
- **Git** - Para controle de versão
- **VS Code** - Editor recomendado

---

## ⚡ **Início Rápido**

### **🖥️ Windows (PowerShell)**
```powershell
# Configurar ambiente (primeira vez)
.\start-dev-local.ps1 -Setup

# Iniciar backend (Terminal 1)
.\start-dev-local.ps1 -Backend

# Iniciar frontend (Terminal 2)  
.\start-dev-local.ps1 -Frontend
```

### **🐧 Linux/Mac (Bash)**
```bash
# Dar permissão e configurar ambiente
chmod +x start-dev-local.sh
./start-dev-local.sh

# Escolher opção 1 para configurar
# Depois opção 4 para iniciar ambos
```

---

## 📁 **Estrutura para Desenvolvimento**

```
musicas-igreja/
├── backend/                    # 🐍 API Flask
│   ├── venv/                  # Ambiente virtual Python
│   ├── app.py                 # Aplicação principal
│   ├── app_routes.py          # Rotas de músicas
│   ├── app_routes_lists.py    # Rotas de listas
│   ├── app_routes_dashboard.py # Rotas do dashboard
│   ├── requirements.txt       # Dependências
│   ├── data/                  # Dados (SQLite)
│   ├── uploads/               # Arquivos enviados
│   ├── organized/             # Arquivos organizados
│   └── logs/                  # Logs do sistema
├── frontend/                   # ⚛️ Interface NextJS
│   ├── node_modules/          # Dependências Node
│   ├── src/app/               # Páginas do app
│   ├── components/            # Componentes React
│   ├── lib/                   # Utilitários
│   ├── hooks/                 # React Hooks
│   └── types/                 # Tipos TypeScript
├── .env                       # Variáveis de ambiente
└── start-dev-local.*          # Scripts de desenvolvimento
```

---

## 🔧 **Configuração Passo a Passo**

### **1. Preparar Repositório**
```bash
git clone <url-do-repositorio>
cd musicas-igreja

# Criar arquivo de configuração
cp env.example.new .env
```

### **2. Configurar Backend Python**
```bash
cd backend

# Criar ambiente virtual
python -m venv venv

# Ativar ambiente virtual
# Windows:
.\venv\Scripts\Activate.ps1
# Linux/Mac:
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Criar diretórios necessários
mkdir -p data uploads organized logs

# Voltar ao diretório raiz
cd ..
```

### **3. Configurar Frontend NextJS**
```bash
cd frontend

# Instalar dependências
npm install

# Voltar ao diretório raiz
cd ..
```

### **4. Migrar Dados (Se Aplicável)**
```bash
# Se você tem dados do sistema antigo
cp pdf_organizer.db backend/data/
cp -r uploads/* backend/uploads/
cp -r organized/* backend/organized/
```

---

## 🚀 **Executando o Sistema**

### **Opção 1: Scripts Automáticos (Recomendado)**

**Windows:**
```powershell
# Menu interativo
.\start-dev-local.ps1

# Ou comandos diretos
.\start-dev-local.ps1 -Backend   # Só backend
.\start-dev-local.ps1 -Frontend  # Só frontend
.\start-dev-local.ps1 -Both      # Instruções para ambos
```

**Linux/Mac:**
```bash
# Menu interativo
./start-dev-local.sh

# As opções são:
# 1) Configurar ambiente
# 2) Iniciar backend
# 3) Iniciar frontend
# 4) Iniciar ambos
# 5) Verificar status
```

### **Opção 2: Comandos Manuais**

**Backend (Terminal 1):**
```bash
cd backend

# Ativar ambiente virtual
# Windows:
.\venv\Scripts\Activate.ps1
# Linux/Mac:
source venv/bin/activate

# Configurar variáveis
export FLASK_ENV=development
export DATABASE_PATH=./data/pdf_organizer.db
export UPLOAD_FOLDER=./uploads
export ORGANIZED_FOLDER=./organized
export LOG_FOLDER=./logs
export SECRET_KEY=dev-secret-key-not-for-production
export FRONTEND_URL=http://localhost:3000

# Iniciar servidor
python app.py
```

**Frontend (Terminal 2):**
```bash
cd frontend

# Configurar variáveis
export NEXT_PUBLIC_API_URL=http://localhost:5000
export NODE_ENV=development

# Iniciar servidor de desenvolvimento
npm run dev
```

---

## 🌐 **URLs de Acesso**

Após iniciar ambos os serviços:

- **🎨 Frontend (Interface):** http://localhost:3000
- **🔧 Backend (API):** http://localhost:5000
- **❤️ Health Check:** http://localhost:5000/health
- **📊 Dashboard:** http://localhost:3000/dashboard
- **🔐 Login:** http://localhost:3000/login

---

## 📊 **Verificação de Status**

### **Verificar Backend:**
```bash
curl http://localhost:5000/health

# Resposta esperada:
# {"status":"healthy","timestamp":"...","database":"connected","directories":"ok","version":"2.0.0"}
```

### **Verificar Frontend:**
```bash
curl http://localhost:3000

# Deve retornar HTML da página inicial
```

### **Verificar Logs:**
```bash
# Logs do backend
tail -f backend/logs/app.log

# Logs do frontend (no terminal onde rodou npm run dev)
```

---

## 🔧 **Desenvolvimento Ativo**

### **Hot Reload Configurado:**
- ✅ **Backend:** Flask recarrega automaticamente quando arquivos `.py` são modificados
- ✅ **Frontend:** NextJS recarrega automaticamente quando arquivos são modificados

### **Estrutura de Desenvolvimento:**
```bash
# Editar backend
code backend/app.py
code backend/app_routes.py

# Editar frontend  
code frontend/src/app/page.tsx
code frontend/components/ui/button.tsx

# Tipos TypeScript
code frontend/types/index.ts

# Configurações
code .env
```

### **Comandos Úteis:**

**Instalar nova dependência Python:**
```bash
cd backend
source venv/bin/activate  # ou .\venv\Scripts\Activate.ps1
pip install nome-do-pacote
pip freeze > requirements.txt
```

**Instalar nova dependência Node:**
```bash
cd frontend
npm install nome-do-pacote
# ou para dev dependencies:
npm install -D nome-do-pacote
```

**Verificar tipos TypeScript:**
```bash
cd frontend
npm run type-check
```

**Build de produção (teste):**
```bash
cd frontend
npm run build
```

---

## 🐛 **Resolução de Problemas**

### **Backend não inicia:**
```bash
# Verificar Python
python --version

# Verificar ambiente virtual
cd backend
ls venv/  # Deve existir

# Recriar ambiente se necessário
rm -rf venv
python -m venv venv
```

### **Frontend não inicia:**
```bash
# Verificar Node.js
node --version
npm --version

# Limpar cache npm
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### **Erro de CORS:**
```bash
# Verificar se FRONTEND_URL está correto no backend
echo $FRONTEND_URL  # Deve ser http://localhost:3000

# Verificar se NEXT_PUBLIC_API_URL está correto no frontend
echo $NEXT_PUBLIC_API_URL  # Deve ser http://localhost:5000
```

### **Banco de dados não encontrado:**
```bash
# Verificar se banco existe
ls backend/data/pdf_organizer.db

# Criar banco vazio se necessário (o Flask criará automaticamente)
cd backend
python -c "import app; app.init_db()"
```

### **Porta já em uso:**
```bash
# Verificar processos usando as portas
# Windows:
netstat -ano | findstr :5000
netstat -ano | findstr :3000

# Linux/Mac:
lsof -ti:5000
lsof -ti:3000

# Matar processo se necessário
# Windows:
taskkill /PID <PID> /F

# Linux/Mac:
kill -9 <PID>
```

---

## 📝 **Configurações Importantes**

### **Arquivo .env:**
```bash
# Backend
SECRET_KEY=dev-secret-key-not-for-production
FLASK_ENV=development
DATABASE_PATH=./backend/data/pdf_organizer.db
UPLOAD_FOLDER=./backend/uploads
ORGANIZED_FOLDER=./backend/organized
LOG_FOLDER=./backend/logs

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:5000
NODE_ENV=development
```

### **Configurações de Desenvolvimento:**
- **Debug Mode:** Ativado automaticamente
- **Hot Reload:** Habilitado para ambos
- **Logs:** Verbose para desenvolvimento
- **CORS:** Configurado para localhost

---

## 🚀 **Próximos Passos**

1. **✅ Sistema funcionando localmente**
2. **🔧 Desenvolver novas funcionalidades**  
3. **🧪 Testar alterações**
4. **📦 Fazer commit das mudanças**
5. **🚀 Deploy em produção (Docker)**

---

## 📞 **Suporte**

### **Scripts de Ajuda:**
```bash
# Windows
.\start-dev-local.ps1 -Status    # Verificar status
.\start-dev-local.ps1 -Clean     # Limpar ambiente

# Linux/Mac  
./start-dev-local.sh            # Menu com todas as opções
```

### **Logs Úteis:**
- **Backend:** `backend/logs/app.log`
- **Frontend:** Terminal onde rodou `npm run dev`
- **Banco:** `backend/data/pdf_organizer.db`

### **Comandos Debug:**
```bash
# Testar API diretamente
curl -X GET http://localhost:5000/health
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"senha"}'

# Verificar banco SQLite
cd backend/data
sqlite3 pdf_organizer.db ".tables"
sqlite3 pdf_organizer.db "SELECT COUNT(*) FROM pdf_files;"
```

---

**🎵 Desenvolvimento local configurado com sucesso! Agora você pode desenvolver com hot reload e debug completo! 🎉**