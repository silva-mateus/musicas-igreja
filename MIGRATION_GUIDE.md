# 🔄 Guia de Migração - Sistema Músicas Igreja

## 📋 Visão Geral

Este guia detalha como migrar do sistema antigo (Flask monolítico) para a nova arquitetura separada (Backend Flask + Frontend NextJS).

---

## 🎯 **Passos de Migração**

### **1. Backup dos Dados Atuais**

**IMPORTANTE:** Faça backup completo antes de iniciar a migração!

```bash
# Criar diretório de backup
mkdir backup_migracao_$(date +%Y%m%d)
cd backup_migracao_$(date +%Y%m%d)

# Backup do banco de dados
cp ../pdf_organizer.db ./

# Backup dos arquivos
cp -r ../uploads ./
cp -r ../organized ./
cp -r ../logs ./

# Backup do código atual
cp ../app.py ./app_antigo.py
cp ../requirements.txt ./requirements_antigo.txt
```

### **2. Preparar Nova Estrutura**

```bash
# Voltar ao diretório do projeto
cd ..

# Verificar se a nova estrutura foi criada
ls -la
# Deve mostrar: backend/, frontend/, docker/, docs/
```

### **3. Migrar Dados do Backend**

#### **3.1 Banco de Dados**
```bash
# Copiar banco existente para novo local
cp pdf_organizer.db backend/data/

# Verificar integridade
sqlite3 backend/data/pdf_organizer.db "SELECT COUNT(*) FROM pdf_files;"
```

#### **3.2 Arquivos PDF**
```bash
# Copiar uploads
cp -r uploads/* backend/uploads/

# Copiar arquivos organizados
cp -r organized/* backend/organized/

# Verificar arquivos
ls -la backend/uploads/
ls -la backend/organized/
```

#### **3.3 Logs (Opcional)**
```bash
# Copiar logs existentes
cp -r logs/* backend/logs/
```

### **4. Configurar Ambiente**

#### **4.1 Variáveis de Ambiente**
```bash
# Copiar template
cp env.example.new .env

# Editar configurações
nano .env
```

Configurações importantes:
```env
SECRET_KEY=your-current-secret-key  # Use a mesma chave atual
FLASK_ENV=production
DATABASE_PATH=/app/data/pdf_organizer.db
UPLOAD_FOLDER=/app/data/uploads
ORGANIZED_FOLDER=/app/data/organized
```

#### **4.2 Permissões (Linux/Mac)**
```bash
# Dar permissões aos scripts
chmod +x start-dev.sh
chmod +x docker/backend/entrypoint.sh

# Verificar permissões dos dados
chmod -R 755 backend/data/
chmod -R 755 backend/uploads/
chmod -R 755 backend/organized/
```

### **5. Testar Migração**

#### **5.1 Teste Local**

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python app.py
```

Verificar:
- ✅ Aplicação inicia sem erros
- ✅ Health check: http://localhost:5000/health
- ✅ Login funciona
- ✅ Músicas são listadas

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Verificar:
- ✅ Interface carrega
- ✅ Pode acessar: http://localhost:3000
- ✅ Conecta com backend

#### **5.2 Teste com Docker**

```bash
# Desenvolvimento
docker-compose -f docker-compose.dev.yml up --build

# Produção
docker-compose up --build
```

### **6. Validação dos Dados**

#### **6.1 Verificar Banco de Dados**
```sql
-- Conectar ao banco
sqlite3 backend/data/pdf_organizer.db

-- Verificar tabelas
.tables

-- Verificar dados
SELECT COUNT(*) as total_musicas FROM pdf_files;
SELECT COUNT(*) as total_usuarios FROM users;
SELECT COUNT(*) as total_listas FROM merge_lists;
SELECT COUNT(*) as total_categorias FROM categories;

-- Verificar integridade
PRAGMA integrity_check;
```

#### **6.2 Verificar Arquivos**
```bash
# Contar arquivos no backend
find backend/uploads -name "*.pdf" | wc -l
find backend/organized -name "*.pdf" | wc -l

# Verificar se não há arquivos órfãos
sqlite3 backend/data/pdf_organizer.db "
SELECT filename FROM pdf_files 
WHERE filename NOT IN (
    SELECT filename FROM pdf_files 
    WHERE EXISTS (
        SELECT 1 FROM sqlite_master 
        WHERE type='table' AND name='pdf_files'
    )
);"
```

#### **6.3 Testar Funcionalidades**

**Autenticação:**
- [ ] Login com usuário existente
- [ ] Logout funciona
- [ ] Sessões são mantidas

**Músicas:**
- [ ] Lista todas as músicas
- [ ] Busca funciona
- [ ] Filtros funcionam
- [ ] Download de PDFs

**Upload:**
- [ ] Upload de novos arquivos
- [ ] Metadados são extraídos
- [ ] Arquivos são organizados

**Listas:**
- [ ] Listas existentes aparecem
- [ ] Criação de novas listas
- [ ] Edição de listas
- [ ] Merge de PDFs

---

## 🔧 **Resolução de Problemas**

### **Erro: Banco não encontrado**
```bash
# Verificar localização
ls -la backend/data/
# Copiar se necessário
cp pdf_organizer.db backend/data/
```

### **Erro: Arquivos PDF não encontrados**
```bash
# Verificar uploads
ls -la backend/uploads/
# Atualizar caminhos no banco se necessário
sqlite3 backend/data/pdf_organizer.db "
UPDATE pdf_files SET filename = 'novo_caminho/' || filename 
WHERE filename NOT LIKE 'novo_caminho/%';
"
```

### **Erro: Permissões negadas (Linux)**
```bash
# Corrigir permissões
sudo chown -R $USER:$USER backend/
chmod -R 755 backend/data/
chmod -R 755 backend/uploads/
chmod -R 755 backend/organized/
```

### **Erro: Docker não consegue acessar arquivos**
```bash
# Verificar volumes
docker-compose ps
docker-compose logs backend

# Recriar volumes se necessário
docker-compose down -v
docker-compose up --build
```

### **Erro: Frontend não conecta com Backend**
```bash
# Verificar variáveis de ambiente
cat .env | grep API_URL

# Verificar conectividade
curl http://localhost:5000/health

# Verificar logs
docker-compose logs frontend
docker-compose logs backend
```

---

## 📊 **Checklist de Migração**

### **Pré-Migração**
- [ ] Backup completo realizado
- [ ] Sistema atual funcional
- [ ] Documentação atual revisada
- [ ] Usuários notificados

### **Migração**
- [ ] Nova estrutura criada
- [ ] Dados copiados
- [ ] Configurações ajustadas
- [ ] Testes locais passaram
- [ ] Testes Docker passaram

### **Validação**
- [ ] Banco de dados íntegro
- [ ] Arquivos acessíveis
- [ ] Todas as funcionalidades testadas
- [ ] Performance adequada
- [ ] Logs funcionando

### **Pós-Migração**
- [ ] Sistema em produção estável
- [ ] Usuários conseguem acessar
- [ ] Monitoramento ativo
- [ ] Backup da nova estrutura
- [ ] Documentação atualizada

---

## 🚀 **Deploy em Produção**

### **1. Preparar Servidor**
```bash
# Parar sistema antigo
sudo systemctl stop musicas-igreja  # ou processo atual

# Fazer backup final
cp -r /caminho/atual /backup/pre-migration-$(date +%Y%m%d)
```

### **2. Deploy da Nova Versão**
```bash
# Clonar código novo
git clone <novo-repo>
cd musicas-igreja

# Configurar ambiente
cp env.example.new .env
nano .env  # Ajustar configurações de produção

# Migrar dados
cp /backup/pdf_organizer.db backend/data/
cp -r /backup/uploads/* backend/uploads/
cp -r /backup/organized/* backend/organized/

# Iniciar novo sistema
docker-compose up -d
```

### **3. Configurar Nginx/Apache** (se aplicável)
```nginx
# Atualizar configuração para proxy
location / {
    proxy_pass http://localhost:3000;  # Frontend
}

location /api/ {
    proxy_pass http://localhost:5000;  # Backend
}
```

### **4. Configurar Monitoramento**
```bash
# Verificar logs
docker-compose logs -f

# Configurar healthcheck
curl http://localhost:5000/health
curl http://localhost:3000
```

---

## 🔄 **Rollback (Se Necessário)**

### **Se algo der errado:**

```bash
# Parar nova versão
docker-compose down

# Restaurar backup
cp /backup/pre-migration-*/pdf_organizer.db ./
cp -r /backup/pre-migration-*/uploads ./
cp -r /backup/pre-migration-*/organized ./
cp /backup/pre-migration-*/app.py ./

# Iniciar versão antiga
python app.py
```

---

## 📞 **Suporte**

- **Logs**: `docker-compose logs -f`
- **Status**: `docker-compose ps`
- **Debug**: Executar em modo desenvolvimento
- **Docs**: Ver `README_NEW_STRUCTURE.md`

---

**✅ Migração concluída com sucesso!**

Agora você tem um sistema moderno, escalável e fácil de manter! 🎉