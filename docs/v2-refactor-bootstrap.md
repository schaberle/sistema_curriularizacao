# Refatoracao v2 - Bootstrap Implementado

## Estrutura atual
- `v1/backend`: copia congelada do backend atual.
- `v1/frontend`: copia congelada do frontend atual.
- `v2/backend`: backend funcional conectado ao Supabase (baseado no comportamento real do v1).
- `v2/frontend`: frontend funcional com mesmas rotas de fluxo do v1, sem rota dedicada de simulacao.

## Observacao operacional
As pastas `backend/` e `frontend/` originais permanecem no root porque estao bloqueadas por processos em execucao no ambiente (lock de filesystem). O conteudo completo ja foi replicado para `v1/`.

## Rodar local
1. Instalar dependencias por projeto:
- `npm run install:all`

2. Configurar variaveis:
- `npm run setup:env`
- validar segredos reais em `v1/backend/.env` e `v2/backend/.env`

3. Subir ambientes:
- v1 paralelo: `npm run dev:v1`
- v2 paralelo: `npm run dev:v2`
- shadow (v1 + v2): `npm run dev:shadow`

4. Validar v2:
- `npm run check:v2`

## Decisao de UX aplicada
- Sem rota dedicada de simulacao no v2.
- A URL legada `/organizer/:distributionId/simulation` redireciona para `step5-phase1-results`.

## Backend v2
- Rotas publicas do v1 preservadas sob `/api/*`.
- Conexao direta ao Supabase usando as variaveis de ambiente do backend.
- Porta padrao local do v2 backend: `4300`.
- Endpoints de seed protegidos por `DEV_SEED_ENABLED`.
