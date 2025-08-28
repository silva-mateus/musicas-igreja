# 🚀 Configuração de Produção - OAuth com Proxy Headers

Este guia explica como configurar o sistema para funcionar corretamente em produção com proxies/CDNs (nginx, Cloudflare, etc.).

## 🎯 Problema Resolvido

Agora o sistema:
- ✅ **Confia nos headers do proxy** (`X-Forwarded-Proto`, `X-Forwarded-Host`)
- ✅ **OAuth integrado no serviço principal** (não precisa de serviço separado)
- ✅ **Deploy simplificado** com uma única configuração
- ✅ **Debug completo** para verificar configuração de proxy

## ⚙️ Configuração Automática

### 1. Variáveis de Ambiente

Crie um arquivo `.env` com:

```bash
# Configuração básica
SECRET_KEY=musicas-igreja-secret-key-production-2024
FLASK_ENV=production

# OAuth Google Drive
OAUTH_CALLBACK_HOST=https://oauth.networkmat.uk
OAUTH_CALLBACK_PORT=  # Vazio para HTTPS padrão (443)
OAUTH_ALLOW_HTTP=     # Vazio para forçar HTTPS

# Proxy headers (OBRIGATÓRIO para produção)
TRUST_PROXY_HEADERS=true
```

### 2. Deploy Simplificado

```bash
# Deploy normal (OAuth já incluído)
docker-compose up -d

# Não precisa mais de --profile oauth
# OAuth agora faz parte do serviço principal
```

## 🔧 Configuração Técnica

### Flask com ProxyFix

O sistema agora usa `werkzeug.middleware.proxy_fix.ProxyFix`:

```python
if os.environ.get('TRUST_PROXY_HEADERS', '').lower() in ('1', 'true', 'yes'):
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
```

**Isso permite que Flask:**
- ✅ Detecte HTTPS através de `X-Forwarded-Proto: https`
- ✅ Use o host correto através de `X-Forwarded-Host`
- ✅ Gere URLs corretas para OAuth callbacks

### Detecção Inteligente de Callback

```python
# Se configurado explicitamente
if oauth_host:
    redirect_uri = f"{oauth_host}/api/google-drive/callback"

# Senão, usa ProxyFix para detectar automaticamente
else:
    redirect_uri = request.host_url.rstrip('/') + '/api/google-drive/callback'
    # request.host_url agora reflete X-Forwarded-Proto e X-Forwarded-Host
```

## 🌐 Configurações por Ambiente

### Produção com Cloudflare

```bash
# .env
OAUTH_CALLBACK_HOST=https://oauth.networkmat.uk
OAUTH_CALLBACK_PORT=
OAUTH_ALLOW_HTTP=
TRUST_PROXY_HEADERS=true
```

**Cloudflare deve enviar:**
- `X-Forwarded-Proto: https`
- `X-Forwarded-Host: oauth.networkmat.uk`

### Produção com nginx

```bash
# .env
OAUTH_CALLBACK_HOST=https://oauth.meusite.com
OAUTH_CALLBACK_PORT=
OAUTH_ALLOW_HTTP=
TRUST_PROXY_HEADERS=true
```

**nginx.conf:**
```nginx
location / {
    proxy_pass http://localhost:5001;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### Desenvolvimento com ngrok

```bash
# .env
OAUTH_CALLBACK_HOST=https://abc123.ngrok.io
OAUTH_CALLBACK_PORT=
OAUTH_ALLOW_HTTP=
TRUST_PROXY_HEADERS=true
```

### Desenvolvimento local

```bash
# .env
OAUTH_CALLBACK_HOST=http://localhost
OAUTH_CALLBACK_PORT=5001
OAUTH_ALLOW_HTTP=true
TRUST_PROXY_HEADERS=false
```

## 🔍 Debug e Verificação

### Interface de Debug

1. **Acesse:** `/settings` no frontend
2. **Clique:** "Verificar Configuração" na seção "Debug Google Drive"
3. **Verifique:**

**Configuração OAuth:**
- ✅ Callback customizado: Sim
- ✅ Host OAuth: https://oauth.networkmat.uk
- ✅ Permitir HTTP: Não (HTTPS)
- ✅ Confiar proxy: Sim

**Headers de Proxy:**
- ✅ Scheme detectado: `https`
- ✅ Host detectado: `oauth.networkmat.uk`
- ✅ X-Forwarded-Proto: `https`
- ✅ X-Forwarded-Host: `oauth.networkmat.uk`

### Logs de Debug

Nos logs do container você verá:

```
🔗 [PROXY] ProxyFix habilitado - Flask confiará em headers X-Forwarded-*
🔍 [OAUTH DEBUG] Headers recebidos:
  - request.host: oauth.networkmat.uk
  - request.host_url: https://oauth.networkmat.uk/
  - request.scheme: https
  - X-Forwarded-Proto: https
  - X-Forwarded-Host: oauth.networkmat.uk
🔗 [OAUTH] Usando callback host: https://oauth.networkmat.uk/api/google-drive/callback
```

## 🚨 Troubleshooting

### Erro: "OAuth 2 MUST utilize https"

**Causa:** Flask não está detectando HTTPS

**Verificar:**
```bash
# 1. Verificar se proxy envia headers
curl -H "X-Forwarded-Proto: https" http://localhost:5001/api/google-drive/debug

# 2. Verificar logs
docker-compose logs | grep PROXY

# 3. Verificar configuração
echo $TRUST_PROXY_HEADERS
```

**Soluções:**
1. ✅ Configure `TRUST_PROXY_HEADERS=true`
2. ✅ Configure proxy para enviar `X-Forwarded-Proto: https`
3. ✅ Reinicie container: `docker-compose restart`

### Headers não detectados

**Verificar se proxy está enviando:**
```bash
# nginx
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;

# Cloudflare (automático, mas verificar se habilitado)
```

### redirect_uri_mismatch

**Verificar configuração no Google Console:**
```
URI no Google Console: https://oauth.networkmat.uk/api/google-drive/callback
URI detectada nos logs: https://oauth.networkmat.uk/api/google-drive/callback
```

**Devem ser idênticas!**

## 📋 Checklist de Deploy

### Antes do Deploy

- [ ] Arquivo `.env` configurado
- [ ] `OAUTH_CALLBACK_HOST` com HTTPS
- [ ] `TRUST_PROXY_HEADERS=true`
- [ ] Proxy configurado para enviar headers corretos
- [ ] URI configurada no Google Console

### Após Deploy

- [ ] `docker-compose ps` - container rodando
- [ ] Logs sem erros de proxy
- [ ] Debug interface mostra headers corretos
- [ ] Teste OAuth funciona

### Comandos de Verificação

```bash
# Status do container
docker-compose ps

# Logs de proxy
docker-compose logs | grep -E "(PROXY|OAUTH|Forwarded)"

# Teste headers
curl -H "X-Forwarded-Proto: https" \
     -H "X-Forwarded-Host: oauth.networkmat.uk" \
     http://localhost:5001/api/google-drive/debug

# Debug interface
curl https://oauth.networkmat.uk/api/google-drive/debug
```

## 🎯 Resumo das Mudanças

### Antes (Complexo)
```bash
# Serviço OAuth separado
docker-compose --profile oauth up -d

# Configuração manual de portas
OAUTH_CALLBACK_PORT=5002

# Sem suporte a proxy headers
```

### Agora (Simples)
```bash
# Deploy único
docker-compose up -d

# Configuração automática
OAUTH_CALLBACK_HOST=https://oauth.networkmat.uk
TRUST_PROXY_HEADERS=true

# Suporte completo a proxy
```

**🎵 OAuth em produção agora funciona perfeitamente com qualquer proxy/CDN!**
