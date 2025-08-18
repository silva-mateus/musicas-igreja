# 🐳 Deploy Docker - Organizador de Música Litúrgica

Este guia explica como fazer o deploy da aplicação usando Docker e configurar CI/CD com GitHub Actions.

## 📋 Pré-requisitos

- Docker e Docker Compose instalados
- Git configurado
- Conta no GitHub (para CI/CD)
- Servidor com acesso SSH (para deploy automático)

## 🚀 Deploy Rápido

### 1. Clone do Repositório

```bash
git clone https://github.com/seu-usuario/musicas-igreja.git
cd musicas-igreja
```

### 2. Configurar Variáveis de Ambiente

```bash
# Copiar template de configuração
cp env.example .env

# Editar configurações
nano .env
```

**Configurações importantes:**
```env
# Aplicação
SECRET_KEY=sua-chave-super-secreta-aqui-change-this
PORT=5000

# Domínio (para SSL automático)
DOMAIN=musicas.seudominio.com
ACME_EMAIL=admin@seudominio.com

# Paths (deixar padrão para Docker)
DATABASE_PATH=/data/pdf_organizer.db
UPLOAD_FOLDER=/data/uploads
ORGANIZED_FOLDER=/data/organized
LOG_FOLDER=/data/logs
```

### 3. Deploy Local (backend + frontend)

```bash
# Build e start (ambos serviços)
docker compose up -d

# Verificar logs
docker-compose logs -f musicas-igreja

# Verificar status
docker-compose ps
```

### 4. Acesso

- **Backend (API):** http://localhost:5000
- **Frontend:** http://localhost:3000
- **Health Check:** http://localhost:5000/health

## 🌐 Deploy com SSL (Traefik)

Para deploy em produção com SSL automático:

```bash
# Deploy com Traefik (proxy reverso + SSL)
docker-compose --profile traefik up -d

# Verificar status do Traefik
docker-compose logs traefik
```

**Serviços disponíveis:**
- **Aplicação:** https://musicas.seudominio.com
- **Traefik Dashboard:** http://seu-servidor:8080

## ⚙️ Configuração CI/CD (GitHub Actions)

### 1. Secrets do Repositório

Configure no GitHub (`Settings > Secrets and Variables > Actions`):

```bash
# Servidor de deploy
HOST=seu-servidor.com
USERNAME=usuario-ssh
SSH_KEY=chave-privada-ssh-aqui
PORT=22

# Configurações da aplicação (opcional)
APP_URL=https://musicas.seudominio.com
SECRET_KEY=sua-chave-secreta
```

### 2. Deploy Automático

O CI/CD é executado automaticamente quando você:
- Faz push para `main` ou `master`
- Abre Pull Request

**Pipeline incluí:**
1. ✅ **Testes** - Verificação de sintaxe e imports
2. 🐳 **Build** - Construção da imagem Docker
3. 📦 **Registry** - Push para GitHub Container Registry
4. 🚀 **Deploy** - Deploy automático no servidor
5. 🔍 **Health Check** - Verificação de saúde da aplicação

### 3. Preparar Servidor para Deploy Automático

No seu servidor de destino:

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Criar diretório do projeto
mkdir -p ~/musicas-igreja
cd ~/musicas-igreja

# Criar arquivo .env de produção
cat > .env << EOF
SECRET_KEY=sua-chave-super-secreta-de-producao
DOMAIN=musicas.seudominio.com
ACME_EMAIL=admin@seudominio.com
FLASK_ENV=production
EOF
```

## 📊 Monitoramento

### Health Check

```bash
# Verificar saúde via curl
curl http://localhost:5000/health

# Verificar via Docker
docker-compose exec musicas-igreja curl -f http://localhost:5000/health
```

**Resposta esperada:**
```json
{
  "status": "healthy",
  "timestamp": "2024-08-03T14:30:00",
  "database": "connected",
  "directories": "ok",
  "version": "1.0.0"
}
```

### Logs

```bash
# Ver logs da aplicação
docker-compose logs -f musicas-igreja

# Ver logs do Traefik
docker-compose logs -f traefik

# Ver logs específicos (últimas 100 linhas)
docker-compose logs --tail=100 musicas-igreja
```

### Volumes e Dados

```bash
# Backup do banco de dados
docker compose exec musicas-igreja cp /data/pdf_organizer.db /tmp/
docker cp $(docker compose ps -q musicas-igreja):/tmp/pdf_organizer.db ./backup.db

# Backup completo dos dados
docker run --rm -v musicas_data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz -C /data .

# Restaurar backup
docker run --rm -v musicas_data:/data -v $(pwd):/backup alpine tar xzf /backup/backup.tar.gz -C /data
```

## 🔧 Comandos Úteis

### Desenvolvimento

```bash
# Build apenas da aplicação
docker build -t musicas-igreja .

# Run sem docker-compose
docker run -p 5000:5000 -e FLASK_ENV=development musicas-igreja

# Shell dentro do container
docker-compose exec musicas-igreja bash
```

### Produção

```bash
# Atualizar aplicação
docker-compose pull
docker-compose up -d

# Restart apenas da aplicação
docker-compose restart musicas-igreja

# Ver status e recursos
docker-compose ps
docker stats $(docker-compose ps -q)
```

### Limpeza

```bash
# Parar e remover containers
docker-compose down

# Remover também volumes (⚠️ CUIDADO: apaga dados!)
docker-compose down -v

# Limpeza geral Docker
docker system prune -f
docker image prune -f
```

## 🛠️ Troubleshooting

### Problemas Comuns

**Container não inicia:**
```bash
# Verificar logs
docker-compose logs musicas-igreja

# Verificar saúde
docker-compose exec musicas-igreja curl -f http://localhost:5000/health || echo "Health check failed"
```

**Erro de permissão:**
```bash
# Verificar permissões dos volumes
docker-compose exec musicas-igreja ls -la /app/data/
```

**SSL não funciona:**
```bash
# Verificar logs do Traefik
docker-compose logs traefik

# Verificar configuração DNS
nslookup musicas.seudominio.com
```

**Banco de dados corrompido:**
```bash
# Backup e recriar
docker compose exec musicas-igreja cp /data/pdf_organizer.db /data/pdf_organizer.db.backup
docker compose exec musicas-igreja python -c "from app import init_db; init_db()"
```

## 📈 Performance

### Configurações Recomendadas

**Para servidor pequeno (1-2 GB RAM):**
```yaml
# docker-compose.yml
services:
  musicas-igreja:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

**Para servidor médio (4+ GB RAM):**
```yaml
services:
  musicas-igreja:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

### Proxy Reverso

Para múltiplas aplicações, configure um proxy reverso externo (Nginx, Traefik, etc.) e remova o Traefik do docker-compose:

```bash
# Deploy apenas da aplicação
docker-compose up -d musicas-igreja
```

## 🔐 Segurança

### Recomendações

1. **Sempre use HTTPS em produção**
2. **Configure SECRET_KEY forte e única**
3. **Mantenha backups regulares**
4. **Monitor logs de acesso**
5. **Atualize imagens regularmente**

### Backup Automático

```bash
# Script de backup diário
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker compose exec musicas-igreja cp /data/pdf_organizer.db /tmp/backup_$DATE.db
docker cp $(docker compose ps -q musicas-igreja):/tmp/backup_$DATE.db ./backups/
find ./backups -name "backup_*.db" -mtime +30 -delete
EOF

chmod +x backup.sh

# Adicionar ao crontab
echo "0 2 * * * /path/to/backup.sh" | crontab -
```

## 📞 Suporte

- **GitHub Issues:** Para bugs e solicitações de features
- **Health Check:** http://seu-servidor:5000/health
- **Logs:** `docker-compose logs musicas-igreja`

---

**🎵 Organizador de Música Litúrgica - Deploy Docker Guide**