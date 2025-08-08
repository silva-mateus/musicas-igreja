# 🔧 Solução para Erro do Pillow no Windows

Se você ainda estiver enfrentando problemas com a instalação do Pillow, siga estas etapas:

## 📋 **Problema Identificado:**
```
Collecting Pillow==10.2.0
Installing build dependencies ... done
Getting requirements to build wheel ... error
```

## 🚀 **Soluções Passo a Passo:**

### **Solução 1: Usar Script Atualizado (Recomendado)**
```powershell
# O script já foi corrigido, tente novamente:
.\start-dev-local.ps1 -Setup
```

### **Solução 2: Instalação Manual**
```powershell
# 1. Entrar no diretório backend
cd backend

# 2. Ativar ambiente virtual
.\venv\Scripts\Activate.ps1

# 3. Atualizar ferramentas
pip install --upgrade pip setuptools wheel

# 4. Instalar Pillow com wheel apenas
pip install Pillow --only-binary=all

# 5. Instalar outras dependências
pip install Flask==3.0.0 Werkzeug==3.0.1 pypdf==3.17.4 bcrypt==4.1.2 flask-session==0.5.0 flask-cors==4.0.0

# 6. Voltar para raiz
cd ..
```

### **Solução 3: Usar Conda (Alternativa)**
```powershell
# Se você tem Anaconda/Miniconda instalado:
conda create -n musicas-igreja python=3.11
conda activate musicas-igreja
conda install pillow
pip install Flask==3.0.0 Werkzeug==3.0.1 pypdf==3.17.4 bcrypt==4.1.2 flask-session==0.5.0 flask-cors==4.0.0
```

### **Solução 4: Instalar Microsoft C++ Build Tools**
Se nada funcionar, instale as ferramentas de build:

1. **Baixe:** [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. **Instale:** Apenas "C++ build tools"
3. **Reinicie** o PowerShell
4. **Execute novamente:** `.\start-dev-local.ps1 -Setup`

## 🧪 **Verificar Instalação:**
```powershell
# Testar se Pillow foi instalado
cd backend
.\venv\Scripts\Activate.ps1
python -c "import PIL; print('Pillow instalado com sucesso!')"
```

## ✅ **Após Resolver:**
```powershell
# Continuar com a configuração
.\start-dev-local.ps1 -Setup

# Ou configurar frontend separadamente
.\start-dev-local.ps1 -Frontend
```

---

## 🔍 **Por que isso acontece?**

O Pillow às vezes precisa ser compilado no Windows quando:
- Não há wheel pré-compilado disponível
- Faltam ferramentas de compilação (Visual Studio Build Tools)
- Versão específica do Python não tem suporte

## 📞 **Precisa de Ajuda?**

Se ainda tiver problemas, me informe:
1. Versão do Python: `python --version`
2. Versão do Windows
3. Mensagem de erro completa

**A partir de agora o script tenta resolver automaticamente! 🎉**