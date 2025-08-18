# 🎵 INSTRUÇÕES DE IMPORTAÇÃO - DADOS DE MÚSICA

## 📋 O que foi exportado:
- ✅ music_data_export.sql - Script SQL com todos os dados de música
- ❌ Usuários e configurações admin foram EXCLUÍDOS

## 🚀 Como importar no servidor de produção:

### Opção 1: Via Docker (Recomendado)
```bash
# 1. Copiar o arquivo SQL para o servidor
scp music_data_export.sql seu-servidor:~/musicas-igreja/

# 2. No servidor, entrar no container
cd ~/musicas-igreja
docker compose exec musicas-igreja bash

# 3. Dentro do container, executar o script
sqlite3 /data/pdf_organizer.db < /app/music_data_export.sql
```

### Opção 2: Via terminal local (se tiver acesso SSH)
```bash
# 1. Enviar arquivo para servidor
scp music_data_export.sql seu-servidor:~/

# 2. No servidor, executar
cd ~/musicas-igreja
docker compose exec musicas-igreja sqlite3 /data/pdf_organizer.db < /tmp/music_data_export.sql
```

### Opção 3: Via container local e depois copiar DB
```bash
# 1. Aplicar no banco local
sqlite3 nova_base.db < music_data_export.sql

# 2. Copiar arquivo de banco para servidor
scp nova_base.db seu-servidor:~/musicas-igreja/
docker compose down
docker run --rm -v musicas_data:/data -v $(pwd):/backup alpine cp /backup/nova_base.db /data/pdf_organizer.db
docker compose up -d
```

## ⚠️ IMPORTANTE:
- Este script VAI APAGAR todos os dados de música existentes no banco de destino
- Os usuários do banco de destino NÃO serão afetados
- Faça backup do banco de produção antes de executar!

## 🔍 Verificação pós-importação:
```bash
# Verificar se os dados foram importados
docker compose exec musicas-igreja python -c "
import sqlite3
conn = sqlite3.connect('/data/pdf_organizer.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM pdf_files')
print(f'Músicas: {cursor.fetchone()[0]}')
cursor.execute('SELECT COUNT(*) FROM merge_lists') 
print(f'Listas: {cursor.fetchone()[0]}')
cursor.execute('SELECT COUNT(*) FROM users')
print(f'Usuários: {cursor.fetchone()[0]}')
conn.close()
"
```

## 📱 Acessar aplicação:
Após a importação, acesse sua aplicação normalmente. Os usuários existentes no servidor de produção continuarão funcionando, mas agora terão acesso a todas as músicas e listas do desenvolvimento.
