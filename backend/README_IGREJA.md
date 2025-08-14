# 🎵 Organizador de Música Litúrgica

Sistema web moderno para organizar, buscar e gerenciar partituras musicais da igreja católica. Desenvolvido com Flask e interface responsiva Bootstrap.

## ✨ Novas Funcionalidades

### 🎶 **Foco em Música Litúrgica**
- **Categorias da Missa** - Organize por partes: Entrada, Ato penitencial, Glória, Salmo, Aclamação, Ofertório, Santo, Cordeiro, Comunhão, Pós Comunhão, Final
- **Tempos Litúrgicos** - Filtre por: Tempo Comum, Quaresma, Advento, Maria, Espírito Santo, Natal
- **Interface em Português** - Completamente traduzida para português brasileiro

### 📋 **Sistema de Listas de Fusão**
- **Seleção Múltipla** - Selecione vários arquivos na página inicial
- **Criar Listas** - Crie listas nomeadas com arquivos selecionados
- **Editar Listas** - Adicione/remova arquivos, reordene por arrastar e soltar
- **Mesclar Direto** - Mescle arquivos diretamente da lista editável

### 🔍 **Busca Aprimorada**
- **Filtro Duplo** - Busque por categoria E tempo litúrgico
- **Busca Inteligente** - Pesquise em nomes, descrições e metadados
- **Resultados Detalhados** - Veja tempo litúrgico e categoria em cada resultado

### 🔄 **Substituição de PDF** ✨ NOVO!
- **Preview Lado a Lado** - Compare o PDF atual com o novo antes de substituir
- **Navegação por Páginas** - Visualize qualquer página de ambos os PDFs
- **Preservação de Dados** - Mantém nome, artista, categoria e todos os metadados
- **Segurança Total** - Confirmação obrigatória antes da substituição
- **Logs Completos** - Registra todas as operações para auditoria

### 📝 **Auto-Preenchimento Inteligente** ✨ NOVO!
- **Nome da Música** - Extrai automaticamente do nome do arquivo PDF
- **Limpeza Automática** - Remove extensões, números e formatações desnecessárias
- **Capitalização** - Formata corretamente primeira letra de cada palavra
- **Preservação** - Só preenche se o campo estiver vazio
- **Economia de Tempo** - Reduz digitação manual durante upload

## 🚀 Como Usar

### 1. **Executar a Aplicação**
```bash
python app.py
```
Acesse: http://localhost:5000

### 2. **Enviar Músicas**
1. Clique em "Enviar" no menu
2. Selecione arquivo PDF da música
3. Escolha categoria (parte da missa)
4. Selecione tempo litúrgico (opcional)
5. Adicione descrição (compositor, estilo, etc.)

### 3. **Organizar com Listas de Fusão**
1. Na página inicial, clique "Seleção Múltipla"
2. Marque os arquivos desejados
3. Digite nome da lista e clique "Criar Lista"
4. Na lista criada:
   - Arraste arquivos para reordenar
   - Adicione mais arquivos
   - Clique "Mesclar Agora" quando pronto

### 4. **Buscar e Filtrar**
- **Busca rápida**: Use a barra de busca no topo
- **Filtro por categoria**: Clique nos botões de categoria
- **Filtro litúrgico**: Use os botões de tempo litúrgico
- **Busca avançada**: Combine texto + filtros na página de busca

### 5. **Substituir PDF de Música** ✨ NOVO!
1. Clique em uma música para ver detalhes
2. Clique no botão "Editar" (ícone de lápis)
3. No campo "Substituir Arquivo PDF" (última opção), selecione o novo arquivo
4. Visualize ambos os PDFs lado a lado no modal
5. Use os controles de navegação para comparar páginas
6. Confirme a substituição ou cancele se não estiver certo
7. **Sem recarregamento:** Página atualiza automaticamente preservando suas edições

### 6. **Upload com Auto-Preenchimento** ✨ NOVO!
1. Vá para página de **"Upload"** → **"Upload Individual"**
2. Selecione um arquivo PDF com nome bem formatado
3. O campo **"Nome da Música"** será preenchido automaticamente
4. Exemplo: `"Ave Maria - C - Schubert.pdf"` vira `"Ave Maria"`
5. Complete as outras informações (artista, categoria, etc.)
6. O sistema preserva suas seleções mesmo se remover outros arquivos

## 📁 Estrutura de Categorias

### Partes da Missa
- **Entrada** - Cânticos de abertura
- **Ato penitencial** - Kyrie, perdão
- **Glória** - Hino de louvor
- **Salmo** - Salmo responsorial
- **Aclamação** - Aleluia, aclamação ao Evangelho
- **Ofertório** - Apresentação das ofertas
- **Santo** - Sanctus
- **Cordeiro** - Agnus Dei
- **Comunhão** - Durante a comunhão
- **Pós Comunhão** - Após a comunhão
- **Final** - Cântico de saída
- **Diversos** - Outros cânticos

### Tempos Litúrgicos
- **Tempo Comum** - Período ordinário
- **Quaresma** - Preparação para Páscoa
- **Advento** - Preparação para Natal
- **Maria** - Festividades marianas
- **Espírito Santo** - Pentecostes, Crisma
- **Natal** - Tempo natalino

## 🎯 Funcionalidades Específicas

### Listas de Fusão
1. **Criar**: Selecione múltiplos arquivos → Digite nome → "Criar Lista"
2. **Editar**: Arraste para reordenar, adicione/remova arquivos
3. **Mesclar**: Combine em um único PDF na ordem desejada
4. **Gerenciar**: Veja todas as listas, edite ou delete

### Organização Automática
- Arquivos salvos em `organized/[Categoria]/`
- Detecção de duplicatas por hash MD5
- Nomes únicos automáticos se necessário
- Metadados extraídos (páginas, tamanho)

### Interface Responsiva
- Design moderno com Bootstrap 5
- Funciona em desktop, tablet e mobile
- Ícones Font Awesome contextuais
- Feedback visual para todas as ações

## 🔧 Tecnologias

- **Backend**: Python Flask + SQLite
- **Frontend**: Bootstrap 5 + JavaScript
- **PDFs**: pypdf para manipulação
- **UI**: Font Awesome icons, drag & drop

## 📊 Banco de Dados

Novas tabelas adicionadas:
- `liturgical_time` - Campo para tempo litúrgico
- `merge_lists` - Listas de fusão salvas
- `merge_list_items` - Itens das listas com ordem

## 🎵 Exemplo de Uso Prático

**Cenário**: Preparar músicas para Missa do 2º Domingo do Advento

1. **Filtrar por tempo**: Clique "Advento"
2. **Buscar específicas**: Digite "entrada" na busca
3. **Criar lista**: Selecione múltiplas → "Lista Missa Advento"
4. **Organizar ordem**: 
   - Entrada → Gloria → Salmo → Aclamação → etc.
5. **Mesclar**: Gere PDF único com todas as músicas em ordem

## 🚀 Melhorias Implementadas

- ✅ Interface 100% em português
- ✅ Categorias específicas para missa católica
- ✅ Filtros por tempo litúrgico
- ✅ Sistema de listas de fusão editáveis
- ✅ Seleção múltipla na página inicial
- ✅ Reordenação por arrastar e soltar
- ✅ Mesclagem direta das listas
- ✅ Busca combinada (categoria + tempo litúrgico)
- ✅ **Substituição de PDF com preview lado a lado** ✨ NOVO!
- ✅ **Atualização dinâmica sem recarregamento** ✨ NOVO!
- ✅ **Auto-preenchimento do nome da música** ✨ NOVO!
- ✅ **Preservação do estado dos checkboxes** ✨ NOVO!
- ✅ Sistema de toasts em vez de banners
- ✅ Botões com ícones e tooltips na página de detalhes
- ✅ Integração automática de escaneamento durante upload
- ✅ Campo de substituição reorganizado (última opção)
- ✅ Interface melhorada para edição de música
- ✅ Botões padronizados em toda a aplicação
- ✅ Correções de altura em formulários

## 📝 Próximos Passos

A aplicação está completamente funcional! Para melhorias futuras:
- Backup automático do banco
- Importação em lote
- Templates de listas por tempo litúrgico
- Exportar listas como texto

## 🚀 Início Rápido

### 1. Aplicação Está Rodando
- Acesse: http://localhost:5000
- Ou use a URL personalizada: http://musicas-igreja.local:5000

### 2. Primeira Música
1. Clique "Enviar" no menu
2. Selecione um arquivo PDF
3. Escolha categoria e tempo litúrgico
4. Adicione tom musical e link do YouTube (opcional)
5. Clique "Enviar PDF"

### 3. Comandos Rápidos

**Parar o sistema:**
Pressione Ctrl+C no terminal

**Reiniciar o sistema:**
```bash
python app.py
```

**Iniciar automaticamente:**
Execute: `start_musicas_igreja.bat`

---

**🎵 Organize sua música litúrgica de forma simples e eficiente! 🎵** 