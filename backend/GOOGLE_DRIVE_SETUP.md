# Configuração do Google Drive - Instruções

## 📋 Pré-requisitos

1. **Projeto no Google Cloud Console**
2. **Credenciais OAuth 2.0**
3. **Arquivo credentials.json**

## 🔧 Passo a Passo

### 1. Criar Projeto no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Anote o **Project ID**

### 2. Ativar a API do Google Drive

1. No menu lateral, vá para **APIs & Services** > **Library**
2. Procure por "Google Drive API"
3. Clique em **Enable**

### 3. Criar Credenciais OAuth 2.0

1. Vá para **APIs & Services** > **Credentials**
2. Clique em **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Se necessário, configure a **OAuth consent screen** primeiro:
   - User Type: **External**
   - App name: `Músicas Igreja`
   - User support email: seu email
   - Developer contact: seu email
   - Scopes: adicione `https://www.googleapis.com/auth/drive`

4. Para o OAuth client ID:
   - Application type: **Web application**
   - Name: `Músicas Igreja Backend`
   - Authorized redirect URIs: 
     - `http://localhost:5000/api/google-drive/callback`
     - `http://127.0.0.1:5000/api/google-drive/callback`

### 4. Baixar credentials.json

1. Após criar as credenciais, clique no ícone de **download**
2. Salve o arquivo como `credentials.json`
3. **IMPORTANTE**: Coloque o arquivo na pasta raiz do backend:

```
backend/
├── app.py
├── credentials.json  ← AQUI
├── requirements.txt
└── ...
```

### 5. Configurar Pasta no Google Drive

1. Abra o [Google Drive](https://drive.google.com/)
2. Crie uma pasta para sincronização (ex: "PDFs Igreja")
3. Abra a pasta
4. Copie o **ID da pasta** da URL:
   ```
   https://drive.google.com/drive/folders/1ABC123def456GHI789
                                        ↑
                                   Este é o ID
   ```

## 🚀 Como Usar

### 1. Instalar Dependências

```bash
cd backend
pip install -r requirements.txt
```

### 2. Iniciar Backend

```bash
python app.py
```

### 3. Configurar no Frontend

1. Acesse `/settings` no frontend
2. Na seção **Google Drive**:
   - Clique em **Conectar**
   - Autorize o acesso no popup
   - Cole o **ID da pasta** no campo correspondente
   - Configure sincronização automática se desejar
   - Clique em **Salvar Configurações**

### 4. Sincronizar

- **Manual**: Clique em "Sincronizar Agora"
- **Automática**: Configure o intervalo desejado

## 📁 Estrutura no Google Drive

A sincronização criará esta estrutura:

```
📁 Sua Pasta de Sync
├── 📁 Adoração/
│   ├── 📄 A Ele a Glória - Em - Gabriela Rocha.pdf
│   └── 📄 Diante do Rei - A - Vida Reluz.pdf
├── 📁 Entrada/
│   ├── 📄 A Alegria - G - Músicas Católicas.pdf
│   └── 📄 Celebrai a Cristo - E - Músicas Católicas.pdf
└── ...
```

## 🔒 Segurança

- **credentials.json**: Contém informações sensíveis, nunca commitar
- **token.json**: Criado automaticamente após autorização
- Adicione ao `.gitignore`:

```gitignore
credentials.json
token.json
```

## 🐛 Solução de Problemas

### Erro: "credentials.json não encontrado"
- Verifique se o arquivo está na pasta raiz do backend
- Confirme o nome exato: `credentials.json`

### Erro: "redirect_uri_mismatch"
- Verifique se a URL de callback está correta nas credenciais OAuth
- URLs devem incluir protocolo e porta exata

### Erro: "access_denied"
- Usuário cancelou a autorização
- Tente conectar novamente

### Sincronização não funciona
- Verifique se o ID da pasta está correto
- Confirme que a autorização está ativa
- Veja os logs do backend para mais detalhes

## 📊 Logs

Os logs do Google Drive aparecem no backend com prefixo `[DRIVE]`:

```
✅ [DRIVE] Upload realizado: Nome da Música - Tom - Artista.pdf
❌ [DRIVE] Erro no upload: Invalid folder ID
🔄 [DRIVE] Auto-sync iniciado (intervalo: 30min)
```

## 🔄 Sincronização

- **Upload apenas**: Arquivos locais → Google Drive
- **Por categoria**: Cada categoria vira uma pasta
- **Sem duplicatas**: Arquivos já sincronizados são ignorados
- **Automática**: Roda em background conforme configurado

