# 🔧 Como Aplicar Migrações via Python Script

## ✅ Dependências Instaladas

- ✅ `psycopg2-binary` já está instalado

## 📋 Próximos Passos

### 1️⃣ Obter a Senha do Postgres

A senha do Postgres é **diferente** das credenciais que você já tem. Para obter:

1. Abra: https://supabase.com/dashboard
2. Selecione projeto: `vkxgsejuqouozsejalhj`
3. Vá a: **Settings** → **Database** (no menu lateral)
4. Procure por **"Database password"** ou **"Connection string"**
5. Se não encontrar a senha, clique em **"Reset database password"**
6. Copie a **nova senha** gerada

**Alternativa**: Você pode encontrar em **Connection Info**:
- Host: `db.vkxgsejuqouozsejalhj.supabase.co`
- User: `postgres`
- Password: `[copie daqui]`
- Port: `5432`
- Database: `postgres`

### 2️⃣ Executar o Script Python

Abra o terminal na pasta do projeto e execute:

```bash
cd C:\Users\schab\sistema_curriularizacao
python apply_migrations.py
```

### 3️⃣ Durante a Execução

O script pedirá:

```
🔐 Digite a senha do Postgres (database password):
```

Cole a senha que você copiou no Passo 1 e pressione Enter.

### 4️⃣ Resultado Esperado

Se funcionar, você verá:

```
[1/2] Executando: 001_initial_schema.sql
✅ SQL executado com sucesso

[2/2] Executando: 002_rls_policies.sql
✅ SQL executado com sucesso

📊 Tabelas criadas: 7
  ✓ group_students
  ✓ groups
  ✓ organizers
  ✓ distributions
  ✓ student_preferences
  ✓ students
  ✓ themes

🔐 RLS Status: 7 tabelas com RLS habilitado
  ✓ HABILITADO: group_students
  ✓ HABILITADO: groups
  ...

✅ SUCESSO! 2/2 migrações executadas
```

---

## 🆘 Troubleshooting

### ❌ "Cannot connect to server"

**Causa**: Firewall ou rede bloqueando conexão ao Supabase

**Solução**:
1. Verifique se o IP local tem acesso ao Supabase
2. Tente desabilitar VPN/Proxy
3. Verifique se a porta 5432 está aberta

### ❌ "invalid password"

**Causa**: Senha incorreta

**Solução**:
1. Verifique senha novamente no Supabase Dashboard
2. Se não lembrar, clique em "Reset database password"
3. Gere nova senha e tente novamente

### ❌ "relation already exists"

**Causa**: Tabelas já foram criadas

**Solução**:
1. Script continuará mesmo assim (usa IF NOT EXISTS)
2. Se quiser limpar e recomeçar:
   ```bash
   # No Supabase Dashboard, SQL Editor:
   DROP TABLE IF EXISTS public.group_students CASCADE;
   DROP TABLE IF EXISTS public.groups CASCADE;
   DROP TABLE IF EXISTS public.organizers CASCADE;
   DROP TABLE IF EXISTS public.distributions CASCADE;
   DROP TABLE IF EXISTS public.student_preferences CASCADE;
   DROP TABLE IF EXISTS public.students CASCADE;
   DROP TABLE IF EXISTS public.themes CASCADE;
   ```

### ❌ "SSL/TLS error"

**Causa**: Certificado SSL

**Solução**:
Script já usa SSL por padrão. Se erro persistir:
1. Verifique conexão HTTPS no Supabase
2. Tente conectar via psql primeiro:
   ```bash
   psql -h db.vkxgsejuqouozsejalhj.supabase.co -U postgres
   ```

---

## ✅ Após Sucesso

Quando as migrações forem aplicadas com sucesso:

1. Verifique no Supabase Dashboard → SQL Editor:
   ```sql
   SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'public';
   ```
   Esperado: **7 tabelas**

2. Próximo passo: **Fase 1 - Setup Inicial do Backend**
   - Criar estrutura de diretórios
   - Inicializar Node.js + npm
   - Instalar dependências

---

## 📝 Nota sobre Segurança

⚠️ **IMPORTANTE**:
- Não compartilhe a senha do Postgres com ninguém
- Não comite `.env` com a senha em repositórios git
- Use variáveis de ambiente em produção
