# 🎵 Sistema Músicas Igreja - Configuração Automática

Este guia explica como configurar o sistema para iniciar automaticamente com o Windows e usar uma URL personalizada.

## 🚀 Configuração Rápida (Recomendada)

### Passo 1: Configurar Domínio Personalizado
1. **Clique com o botão direito** em `start_musicas_igreja.bat`
2. Selecione **"Executar como administrador"**
3. O sistema irá:
   - Configurar automaticamente o domínio `musicas-igreja.local`
   - Iniciar o servidor Flask

### Passo 2: Configurar Inicialização Automática

#### Opção A: Pasta de Inicialização (Mais Simples)
1. Pressione `Win + R` para abrir o "Executar"
2. Digite: `shell:startup` e pressione Enter
3. Copie o arquivo `start_musicas_igreja_silent.bat` para esta pasta
4. O sistema irá iniciar automaticamente após reinicializar

#### Opção B: Agendador de Tarefas (Mais Avançado)
1. Pressione `Win + R` e digite: `taskschd.msc`
2. No painel direito, clique em **"Criar Tarefa Básica"**
3. Configure:
   - **Nome**: "Músicas Igreja - Auto Start"
   - **Disparador**: "Quando o computador iniciar"
   - **Ação**: "Iniciar um programa"
   - **Programa**: Caminho completo para `start_musicas_igreja_silent.bat`

## 🌐 URLs Disponíveis

Após a configuração, você pode acessar o sistema através de:

- `http://localhost:5000` (padrão)
- `http://musicas-igreja.local:5000` (domínio personalizado)
- `http://127.0.0.1:5000` (IP local)

## 📁 Arquivos Criados

| Arquivo | Função |
|---------|--------|
| `start_musicas_igreja.bat` | Inicia o sistema manualmente (com interface) |
| `start_musicas_igreja_silent.bat` | Inicia o sistema silenciosamente (para auto-start) |
| `setup_custom_url.ps1` | Configura o domínio personalizado |
| `startup_log.txt` | Log das inicializações automáticas |

## 🔧 Configuração Manual (Avançada)

### Configurar Domínio Personalizado Manualmente

Se preferir configurar manualmente:

1. **Abra o Notepad como Administrador**:
   - Pressione `Win + R`, digite `notepad` e pressione `Ctrl + Shift + Enter`

2. **Abra o arquivo hosts**:
   - No Notepad, vá em Arquivo > Abrir
   - Navegue até: `C:\Windows\System32\drivers\etc\hosts`
   - Selecione "Todos os arquivos" no filtro

3. **Adicione a linha**:
   ```
   127.0.0.1    musicas-igreja.local
   ```

4. **Salve o arquivo**

### Configurar Startup Manualmente

#### Via Registro do Windows:
1. Pressione `Win + R` e digite: `regedit`
2. Navegue até: `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`
3. Clique com o botão direito > Novo > Valor da String
4. Nome: `MusicasIgreja`
5. Valor: Caminho completo para `start_musicas_igreja_silent.bat`

## 🛠️ Comandos Úteis

### Verificar se o sistema está rodando:
```cmd
netstat -an | find "5000"
```

### Parar o sistema:
```cmd
taskkill /f /im python.exe
```

### Remover domínio personalizado:
```powershell
powershell -ExecutionPolicy Bypass -File "setup_custom_url.ps1" -Remove
```

## 🚨 Solução de Problemas

### Problema: "Python não encontrado"
**Solução**: Instale o Python e adicione ao PATH do sistema

### Problema: "Acesso negado ao arquivo hosts"
**Solução**: Execute o script como Administrador

### Problema: "Sistema não inicia automaticamente"
**Solução**: 
1. Verifique se o arquivo está na pasta de inicialização
2. Teste executando `start_musicas_igreja_silent.bat` manualmente
3. Verifique o log em `startup_log.txt`

### Problema: "Domínio personalizado não funciona"
**Solução**:
1. Execute: `ipconfig /flushdns` no cmd
2. Reinicie o navegador
3. Teste com `ping musicas-igreja.local`

## 📋 Checklist de Configuração

- [ ] Sistema inicia manualmente com `start_musicas_igreja.bat`
- [ ] Domínio personalizado `musicas-igreja.local:5000` funciona
- [ ] Arquivo `start_musicas_igreja_silent.bat` foi copiado para pasta de inicialização
- [ ] Sistema inicia automaticamente após reinicialização
- [ ] Logs são gravados em `startup_log.txt`

## 🎯 Uso Diário

Após a configuração:
1. **Sistema inicia automaticamente** com o Windows
2. **Acesse pelo navegador**: `http://musicas-igreja.local:5000`
3. **Para parar**: Use o Gerenciador de Tarefas ou `Ctrl+C` no console

---

✅ **Configuração concluída!** Seu sistema de músicas da igreja agora roda automaticamente e tem uma URL personalizada! 