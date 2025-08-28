# 🗂️ Gerenciamento de Dados - Organizador de Música Litúrgica

Este guia explica como gerenciar, fazer backup e restaurar os dados do sistema com segurança durante deployments.

## 📊 Estrutura de Dados

### Dados Persistentes
- **🗄️ Banco de dados**: `pdf_organizer.db` (SQLite)
- **📄 PDFs organizados**: `./organized/[categoria]/arquivo.pdf`
- **📤 Uploads temporários**: `/data/uploads/`
- **⚙️ Configurações**: `credentials.json`, `token.json`, `.env`

### Volumes Docker
```yaml
volumes:
  - musicas_data:/data:rw          # Banco, uploads, logs
  - ./organized:/app/organized:rw  # PDFs organizados (host)
```

## 🛡️ Sistema de Backup/Restore

### 🔄 Scripts Disponíveis

#### 1. `backup-data.sh` - Backup Completo
```bash
./backup-data.sh
```
**Funcionalidades:**
- ✅ Backup do banco de dados SQLite
- ✅ Backup dos PDFs organizados
- ✅ Backup dos uploads
- ✅ Backup das configurações
- ✅ Verificação de integridade
- ✅ Compactação opcional
- ✅ Correção automática de permissões

#### 2. `restore-data.sh` - Restauração
```bash
./restore-data.sh <nome_do_backup>
```
**Funcionalidades:**
- ✅ Restauração do banco de dados
- ✅ Restauração dos PDFs organizados
- ✅ Restauração dos uploads
- ✅ Restauração das configurações
- ✅ Validação pós-restore
- ✅ Correção automática de permissões

#### 3. `deploy-safe.sh` - Deploy com Backup
```bash
./deploy-safe.sh
```
**Funcionalidades:**
- ✅ Backup automático antes do deploy
- ✅ Múltiplos tipos de deploy
- ✅ Restauração automática se necessário
- ✅ Validação pós-deploy
- ✅ Correção automática de permissões

## 🎯 Cenários de Uso

### 📦 Backup Manual
```bash
# Fazer backup imediato
./backup-data.sh

# Listar backups
ls -la backups/
```

### 🚀 Deploy Preservando Dados
```bash
# Deploy normal (recomendado)
./deploy-safe.sh
# Escolha: opção 1 (Deploy normal)
```

### 🗑️ Deploy Limpo com Restore
```bash
# Deploy removendo volumes
./deploy-safe.sh
# Escolha: opção 2 (Deploy limpo)
# Confirme: CONFIRMO
# Restaure: Y (quando perguntado)
```

### 📥 Restaurar Backup Específico
```bash
# Listar backups disponíveis
./restore-data.sh

# Restaurar backup específico
./restore-data.sh musicas_backup_20241201_143000
```

### 🔧 Backup Antes de Mudanças
```bash
# Antes de mudanças importantes
./backup-data.sh
# ... fazer mudanças ...
# Se der problema, restaurar:
./restore-data.sh <ultimo_backup>
```

## 🔧 Correção de Permissões

### Problema Comum
Após deploy ou restore, arquivos podem ter permissões incorretas.

### Solução Automática
Todos os scripts incluem correção automática de permissões:
- **Owner**: `appuser:appuser` (UID:1000, GID:1000)
- **Diretórios**: `755` (rwxr-xr-x)
- **Arquivos**: `644` (rw-r--r--)

### Correção Manual
```bash
# No container
docker exec musicas-igreja-app bash -c "
    chown -R appuser:appuser /data /app/organized
    find /data -type d -exec chmod 755 {} \;
    find /data -type f -exec chmod 644 {} \;
    find /app/organized -type d -exec chmod 755 {} \;
    find /app/organized -type f -exec chmod 644 {} \;
"

# No host
chmod -R 755 organized/
find organized/ -type f -exec chmod 644 {} \;
```

## 🚨 Troubleshooting

### Problema: "attempt to write a readonly database"
```bash
# Verificar permissões
docker exec musicas-igreja-app ls -la /data/

# Corrigir permissões
docker exec musicas-igreja-app chown appuser:appuser /data/pdf_organizer.db
docker exec musicas-igreja-app chmod 644 /data/pdf_organizer.db
```

### Problema: PDFs não encontrados
```bash
# Verificar mapeamento de volume
docker exec musicas-igreja-app ls -la /app/organized/

# Verificar no host
ls -la organized/

# Restaurar PDFs do backup
./restore-data.sh <backup_name>
```

### Problema: Backup corrompido
```bash
# Verificar integridade do banco
sqlite3 backups/backup_name/pdf_organizer.db "PRAGMA integrity_check;"

# Deve retornar: ok
```

### Problema: Container não inicia após restore
```bash
# Verificar logs
docker-compose logs musicas-igreja

# Verificar permissões
docker exec musicas-igreja-app bash -c "ls -la /data/ /app/organized/"

# Reiniciar com permissões corretas
docker-compose down
./deploy-safe.sh
```

## 📋 Comandos Úteis

### Verificação de Status
```bash
# Status dos containers
docker-compose ps

# Logs em tempo real
docker-compose logs -f

# Entrar no container
docker exec -it musicas-igreja-app bash

# Verificar banco
docker exec musicas-igreja-app python -c "
import sqlite3
conn = sqlite3.connect('/data/pdf_organizer.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM pdf_files')
print(f'Arquivos no banco: {cursor.fetchone()[0]}')
"
```

### Gerenciamento de Volumes
```bash
# Listar volumes
docker volume ls | grep musicas

# Inspecionar volume
docker volume inspect musicas_data

# Backup de volume
docker run --rm -v musicas_data:/data -v $(pwd):/backup alpine tar czf /backup/volume_backup.tar.gz -C /data .

# Restore de volume
docker run --rm -v musicas_data:/data -v $(pwd):/backup alpine tar xzf /backup/volume_backup.tar.gz -C /data
```

### Limpeza
```bash
# Remover backups antigos (>30 dias)
find backups/ -name "musicas_backup_*" -mtime +30 -delete

# Remover volumes órfãos
docker volume prune

# Limpeza completa (CUIDADO!)
docker-compose down
docker volume rm musicas_data
docker system prune -f
```

## 📅 Estratégia de Backup

### Frequência Recomendada
- **Antes de cada deploy**: Automático
- **Diário**: Backup manual ou automático
- **Antes de mudanças importantes**: Manual
- **Mensal**: Backup arquivado

### Retenção
- **Últimos 7 dias**: Todos os backups
- **Último mês**: Backups semanais
- **Último ano**: Backups mensais
- **Histórico**: Backups trimestrais

### Automação
```bash
# Adicionar ao crontab
# Backup diário às 2:00
0 2 * * * cd /path/to/backend && ./backup-data.sh

# Limpeza semanal (domingos às 3:00)
0 3 * * 0 find /path/to/backend/backups -name "musicas_backup_*" -mtime +7 -delete
```

## 🔒 Segurança

### Práticas Recomendadas
- ✅ **Sempre fazer backup antes de deploy**
- ✅ **Verificar integridade dos backups**
- ✅ **Manter permissões corretas**
- ✅ **Testar restore periodicamente**
- ✅ **Armazenar backups em local seguro**

### Permissões Críticas
```bash
# Estrutura correta:
drwxr-xr-x appuser appuser organized/
drwxr-xr-x appuser appuser data/
-rw-r--r-- appuser appuser data/pdf_organizer.db
-rw-r--r-- appuser appuser credentials.json
-rw-r--r-- appuser appuser token.json
```

---

## 🎵 Resumo dos Comandos

| Ação | Comando |
|------|---------|
| **Backup completo** | `./backup-data.sh` |
| **Deploy seguro** | `./deploy-safe.sh` |
| **Restaurar dados** | `./restore-data.sh <backup>` |
| **Listar backups** | `ls -la backups/` |
| **Verificar status** | `docker-compose ps` |
| **Corrigir permissões** | Ver seção "Correção Manual" |

**🎯 Com este sistema, seus dados ficam sempre protegidos durante deploys!**
