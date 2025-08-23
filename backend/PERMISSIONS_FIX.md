# 🔧 Correção de Problemas de Permissões

## Problema Identificado

O container backend está em **restart loop** devido a problemas de permissões no diretório `/app/organized` (volume mount).

**Sintoma:** Container fica reiniciando com exit code 1

**Causa:** O usuário `appuser` (UID 1000) dentro do container não consegue alterar permissões do volume montado `./organized:/app/organized`.

---

## 🚀 Soluções (em ordem de preferência)

### **Solução 1: Script Automático (Recomendado)**

```bash
# No servidor, execute:
chmod +x ./fix-permissions.sh
./fix-permissions.sh
```

O script vai:
- ✅ Parar containers
- ✅ Corrigir permissões do `./organized` para UID 1000
- ✅ Corrigir permissões do volume Docker
- ✅ Oferecer opção para reiniciar

### **Solução 2: Comandos Manuais**

```bash
# 1. Parar containers
docker-compose down

# 2. Corrigir permissões do diretório host
sudo chown -R 1000:1000 ./organized
sudo chmod -R 755 ./organized

# 3. Corrigir permissões do volume Docker
docker run --rm -v musicas_data:/data alpine chown -R 1000:1000 /data

# 4. Reiniciar
docker-compose up -d
```

### **Solução 3: Modo Root Temporário**

```bash
# Se as soluções acima não funcionarem, use:
docker-compose -f docker-compose.fix-permissions.yml up -d

# Este modo:
# - ✅ Roda como root temporariamente
# - ✅ Corrige permissões automaticamente
# - ✅ Muda para usuário normal após correção
```

---

## 📋 Verificação de Sucesso

### Sinais de que está funcionando:
```bash
# Container rodando (não mais restarting)
docker ps | grep musicas-igreja-app
# Status: Up X minutes (healthy)

# Logs sem erros de permissão
docker logs musicas-igreja-app --tail=20
# Deve mostrar: "🚀 Iniciando aplicação..."

# Health check OK
curl http://localhost:5001/health
# Deve retornar: {"status":"healthy"}
```

### Se ainda tiver problemas:
```bash
# Debug detalhado
docker logs musicas-igreja-app --tail=100

# Verificar permissões
ls -la ./organized
# Deve mostrar: drwxr-xr-x ... 1000 1000 ...

# Executar debug manual
docker run -it --rm \
  -v musicas_data:/data \
  -v $(pwd)/organized:/app/organized \
  ghcr.io/silva-mateus-org/musicas-igreja:latest bash
```

---

## 🔍 Comando de Debug Completo

```bash
echo "=== STATUS CONTAINERS ==="
docker ps -a | grep musicas

echo "=== LOGS BACKEND ==="  
docker logs --tail=30 musicas-igreja-app

echo "=== PERMISSÕES LOCAL ==="
ls -la ./organized

echo "=== VOLUME DOCKER ==="
docker run --rm -v musicas_data:/data alpine ls -la /data

echo "=== HEALTH CHECK ==="
curl -s http://localhost:5001/health | jq . || echo "Health check falhou"
```

---

## ⚡ Solução Rápida (1 Linha)

```bash
docker-compose down && sudo chown -R 1000:1000 ./organized && docker-compose up -d
```

---

## 💡 Por que isso acontece?

1. **Container não-root**: Por segurança, o container roda como `appuser` (UID 1000)
2. **Volume mount**: O diretório `./organized` é montado do host para `/app/organized` 
3. **Conflito de permissões**: Se o host tem permissões diferentes, o container não consegue escrever
4. **chmod falha**: O usuário `appuser` não pode alterar permissões de um volume mount

**A correção garante que o diretório do host tenha o mesmo UID/GID do usuário do container.**
