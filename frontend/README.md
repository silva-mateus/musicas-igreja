# Frontend (Next.js + shadcn/ui)

## Configuração rápida

1. Node 18+
2. Instalar dependências:

```bash
cd frontend
npm install
```

3. Rodar em dev:

```bash
npm run dev
```

4. Configurar backend:
- Backend deve estar rodando em `http://localhost:5000` (ou defina `NEXT_PUBLIC_API_BASE`)
- Variável opcional no `.env.local`:

```env
NEXT_PUBLIC_API_BASE=http://localhost:5000
```

## Estrutura
- App Router (`src/app`) com páginas: `musics`, `upload`, `lists`, `dashboard`.
- Proxy simples para download/stream via rotas `api-proxy`.
- Componentes shadcn mínimos: `Button`, `Input`, `Card`, `Badge`.

## Integração com backend
- Lista de músicas: GET `/api/files`
- Upload: POST `/api/files`
- Listas: GET `/api/merge_lists`, GET `/api/merge_lists/{id}`
- Dashboard: GET `/api/dashboard/top_musics`, GET `/api/dashboard/top_artists`

A UI pode ser expandida para cobrir todos os endpoints disponíveis conforme necessário.


