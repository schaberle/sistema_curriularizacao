# Setup do Banco de Dados Supabase

## Credenciais do Projeto

```
Project ID: vkxgsejuqouozsejalhj
URL: https://vkxgsejuqouozsejalhj.supabase.co
```

## Passo 1: Executar as Migrações SQL

### Como fazer:

1. **Acesse o Supabase Dashboard**:
   - Vá para https://supabase.com/dashboard
   - Selecione o projeto `vkxgsejuqouozsejalhj`

2. **Abra o SQL Editor**:
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New Query"

3. **Copie e execute a primeira migração** (`001_initial_schema.sql`):
   - Abra o arquivo: `supabase/migrations/001_initial_schema.sql`
   - Copie TODO o conteúdo
   - Cole no SQL Editor do Supabase
   - Clique em "Run" (ou Ctrl+Enter)
   - Aguarde até ver "Success"

4. **Copie e execute a segunda migração** (`002_rls_policies.sql`):
   - Abra o arquivo: `supabase/migrations/002_rls_policies.sql`
   - Copie TODO o conteúdo
   - Cole em uma nova query do SQL Editor
   - Clique em "Run"
   - Aguarde até ver "Success"

### Verificação

Após executar as migrações, você deve ter:

1. **7 tabelas criadas**:
   - `organizers` - Organizadores/Admin
   - `distributions` - Histórico de distribuições
   - `themes` - Temas/Projetos
   - `students` - Alunos
   - `student_preferences` - Preferências de temas
   - `groups` - Grupos formados
   - `group_students` - Aluno → Grupo (junction table)

2. **Verificar tabelas**: Execute esta query no SQL Editor:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```
   Esperado: 7 tabelas listadas

3. **Verificar RLS está habilitado**: Execute:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public';
   ```
   Esperado: Todas as tabelas devem ter `rowsecurity = true`

## Passo 2: Criar Primeiro Organizador (via SQL)

1. No SQL Editor, execute:
   ```sql
   INSERT INTO public.organizers (email, password_hash, name)
   VALUES ('admin@example.com', 'placeholder_hash', 'Admin')
   RETURNING id, email;
   ```

2. Anote o `id` retornado - você precisará disso no backend

**Nota**: O `password_hash` será gerado pelo backend ao fazer login

## Passo 3: Verificar Conexão (Backend)

Quando o backend estiver implementado, execute:

```bash
# No backend
npm run test:db
```

Isso testará:
- Conexão ao Supabase
- Leitura de tabelas
- Integridade dos dados

## Variáveis de Ambiente (.env)

Crie um arquivo `.env` na raiz do backend com:

```
SUPABASE_URL=https://vkxgsejuqouozsejalhj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreGdzZWp1cW91b3pzZWphbGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDkxNjgsImV4cCI6MjA4NjQyNTE2OH0.FdWqe4hGHDknTos4BghG60DOSewH3qRuqQFnlAamcSw
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreGdzZWp1cW91b3pzZWphbGhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0OTEzMCwiZXhwIjoyMDg2NDI1MTY4fQ.0HcFmGbqirpwF2hEIYARSEWAwj0cwN8Le1L-E-wAPAc
NODE_ENV=development
```

## Troubleshooting

### "Permission denied" na migration
- Certifique-se de estar logado como owner do projeto no Supabase
- Verifique se as credenciais estão corretas

### "Table already exists"
- Se receber erro que tabela já existe, verifique se ela realmente existe:
  ```sql
  SELECT to_regclass('public.organizers');
  ```
- Se existir, pode ignorar ou deletar:
  ```sql
  DROP TABLE IF EXISTS public.organizers CASCADE;
  ```

### RLS bloqueando queries
- Se depois do RLS você não conseguir ler dados, execute esta query para verificar:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'students';
  ```
- Pode ser necessário desabilitar RLS temporariamente:
  ```sql
  ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
  ```

## Próximos Passos

1. ✅ Criar tabelas SQL (você vai fazer)
2. ✅ Configurar RLS (você vai fazer)
3. **Implementar backend** (Node.js + Express + conexão Supabase)
4. **Implementar frontend** (React + Vite)
5. Testar fluxo completo
