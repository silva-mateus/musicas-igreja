# 🧪 Teste de Desenvolvimento Local - Sistema Músicas Igreja

## 🎯 **Objetivo**

Verificar se a nova estrutura separada (Backend Flask + Frontend NextJS) está funcionando corretamente em desenvolvimento local.

---

## 📋 **Checklist de Teste**

### **✅ 1. Configuração Inicial**

```powershell
# Windows - Executar no PowerShell
.\start-dev-local.ps1 -Setup
```

**Verificações:**
- [ ] Python 3.8+ encontrado
- [ ] Node.js 18+ encontrado
- [ ] npm encontrado
- [ ] Ambiente virtual Python criado em `backend/venv`
- [ ] Dependências Python instaladas
- [ ] Dependências Node.js instaladas
- [ ] Arquivo `.env` criado
- [ ] Diretórios criados: `backend/data`, `backend/uploads`, `backend/organized`, `backend/logs`

### **✅ 2. Inicialização do Backend**

```powershell
# Terminal 1
.\start-dev-local.ps1 -Backend
```

**Verificações:**
- [ ] Backend inicia sem erros
- [ ] Log mostra: `🎵 MÚSICAS IGREJA API - Iniciando...`
- [ ] Servidor roda em `http://localhost:5000`
- [ ] Health check responde: `curl http://localhost:5000/health`

**Resposta esperada do health check:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-XX...",
  "database": "connected", 
  "directories": "ok",
  "version": "2.0.0"
}
```

### **✅ 3. Inicialização do Frontend**

```powershell
# Terminal 2
.\start-dev-local.ps1 -Frontend
```

**Verificações:**
- [ ] Frontend compila sem erros TypeScript
- [ ] Servidor NextJS inicia em `http://localhost:3000`
- [ ] Página inicial carrega
- [ ] Interface mostra cards com estatísticas

### **✅ 4. Teste de Integração**

**4.1 Comunicação Backend-Frontend:**
- [ ] Frontend consegue carregar dados do backend
- [ ] CORS configurado corretamente
- [ ] Não há erros de rede no console do navegador

**4.2 Funcionalidades Básicas:**
- [ ] Página de login acessível: `http://localhost:3000/login`
- [ ] Dashboard acessível: `http://localhost:3000/dashboard`
- [ ] API endpoints respondem corretamente

---

## 🧪 **Testes Específicos**

### **Teste 1: Health Check da API**

```bash
curl -X GET http://localhost:5000/health
```

**✅ Resultado Esperado:**
```json
{
  "status": "healthy",
  "timestamp": "...",
  "database": "connected",
  "directories": "ok", 
  "version": "2.0.0"
}
```

### **Teste 2: Rota de Autenticação**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

**✅ Resultado Esperado:**
```json
{
  "error": "Invalid credentials or inactive user"
}
```
*(Normal, pois não temos usuário ainda)*

### **Teste 3: CORS Frontend-Backend**

1. Abrir `http://localhost:3000` no navegador
2. Abrir DevTools (F12)
3. Verificar Network tab
4. Não devem haver erros de CORS

### **Teste 4: TypeScript Compilation**

```bash
cd frontend
npm run type-check
```

**✅ Resultado Esperado:**
```
No TypeScript errors found
```

### **Teste 5: Hot Reload**

**Backend:**
1. Editar `backend/app.py` (adicionar um comentário)
2. ✅ Backend deve recarregar automaticamente
3. Verificar logs no terminal

**Frontend:**
1. Editar `frontend/src/app/page.tsx` (mudar um texto)
2. ✅ Página deve recarregar automaticamente no navegador

---

## 🔧 **Comandos de Diagnóstico**

### **Verificar Processos Rodando:**

```powershell
# Windows
Get-Process | Where-Object {$_.ProcessName -like "*python*" -or $_.ProcessName -like "*node*"}

# Verificar portas
netstat -ano | findstr :5000
netstat -ano | findstr :3000
```

### **Verificar Logs:**

```bash
# Logs do backend
cat backend/logs/app.log

# Verificar estrutura criada
ls backend/
ls frontend/
```

### **Verificar Configurações:**

```bash
# Verificar .env
cat .env

# Verificar se banco foi criado
ls backend/data/

# Verificar dependências
cd backend && pip list
cd frontend && npm list --depth=0
```

---

## 🐛 **Problemas Comuns e Soluções**

### **❌ Problema: Backend não inicia**

**Sintomas:**
- Erro ao executar `python app.py`
- ImportError em dependências

**Solução:**
```bash
cd backend
# Reativar ambiente virtual
.\venv\Scripts\Activate.ps1
# Reinstalar dependências
pip install -r requirements.txt
```

### **❌ Problema: Frontend não compila**

**Sintomas:**
- Erros TypeScript
- Dependências não encontradas

**Solução:**
```bash
cd frontend
# Limpar e reinstalar
rm -rf node_modules package-lock.json
npm install
```

### **❌ Problema: CORS Error**

**Sintomas:**
- Erro "Access to fetch blocked by CORS policy"

**Solução:**
1. Verificar se `FRONTEND_URL=http://localhost:3000` no backend
2. Verificar se `NEXT_PUBLIC_API_URL=http://localhost:5000` no frontend
3. Reiniciar ambos os serviços

### **❌ Problema: Porta já em uso**

**Sintomas:**
- "Error: listen EADDRINUSE :::5000"
- "Error: listen EADDRINUSE :::3000"

**Solução:**
```powershell
# Encontrar processo usando a porta
netstat -ano | findstr :5000
# Matar processo
taskkill /PID <PID> /F
```

---

## 📊 **Resultado Final**

### **✅ Teste Passou Se:**

1. **Backend Flask** roda em `http://localhost:5000`
2. **Frontend NextJS** roda em `http://localhost:3000`
3. **Health check** retorna status healthy
4. **Interface** carrega sem erros
5. **CORS** configurado corretamente
6. **Hot reload** funciona em ambos
7. **TypeScript** compila sem erros
8. **Logs** mostram inicialização bem-sucedida

### **📈 Próximos Passos Após Teste:**

1. **✅ Desenvolvimento ativo** - Modificar código e ver mudanças
2. **📚 Implementar funcionalidades** - Adicionar novas features
3. **🧪 Testar upload** - Adicionar arquivo PDF de teste
4. **🔐 Testar autenticação** - Criar usuário e fazer login
5. **🚀 Preparar produção** - Quando pronto, usar Docker

---

## 📞 **Se Algo Der Errado**

1. **🔄 Reiniciar tudo:**
   ```bash
   # Parar serviços (Ctrl+C nos terminais)
   # Executar novamente
   .\start-dev-local.ps1 -Setup
   ```

2. **🧹 Limpar ambiente:**
   ```bash
   .\start-dev-local.ps1 -Clean
   ```

3. **📋 Verificar dependências:**
   ```bash
   python --version
   node --version
   npm --version
   ```

4. **🆘 Suporte:** Verificar logs em `backend/logs/app.log`

---

**🎯 O teste está pronto! Execute os passos e verifique se tudo funciona antes de começar a desenvolver novas funcionalidades! 🎉**