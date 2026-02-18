# v2

Codigo novo da refatoracao para producao.

- `v2/backend`: backend funcional conectado ao Supabase com contratos publicos do v1.
- `v2/frontend`: app funcional com mesmas URLs de fluxo do v1.

Observacoes:
- Sem rota dedicada de simulacao no v2.
- `/organizer/:distributionId/simulation` redireciona para o fluxo padrao (`step5-phase1-results`).

Use `npm run dev:v2` na raiz para executar.
