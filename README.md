# 🎓 Sistema de Distribuição de Grupos Interdisciplinares

**Status**: 🚀 Em Desenvolvimento

Sistema web completo para distribuição automática de grupos (4 alunos) em atividade colaborativa entre Engenharia Elétrica e Engenharia Mecânica.

---

## 📋 Documentação

### 📖 Leia Primeiro
1. **[PLANO.md](./PLANO.md)** - Plano detalhado da arquitetura e roadmap (LEIA PRIMEIRO!)
2. **[APLICAR_MIGRACAO_PYTHON.md](./APLICAR_MIGRACAO_PYTHON.md)** - Como aplicar migrações SQL
3. **[EXECUTAR_MIGRACAO.md](./EXECUTAR_MIGRACAO.md)** - Alternativa: executar manualmente no Dashboard

### 🔧 Scripts
- **[apply_migrations.py](./apply_migrations.py)** - Script Python para aplicar migrações
- **[migrate.sh](./migrate.sh)** - Script Bash (Linux/Mac)
- **[migrate.bat](./migrate.bat)** - Script Batch (Windows)
- **[migrate.py](./migrate.py)** - Alternativa Python com Supabase SDK

### 📚 Setup
- **[SETUP_SUPABASE.md](./SETUP_SUPABASE.md)** - Setup completo do Supabase

---

## 🚀 Quick Start

### Pré-Requisitos
- Node.js 18+ (para backend)
- Python 3.9+ (para migrações)
- npm ou yarn
- Conta Supabase (já criada)

### 1️⃣ Aplicar Migrações SQL (PRIMEIRO PASSO!)

```bash
# Instalar dependência
pip install psycopg2-binary

# Executar migrações
python apply_migrations.py

# Será pedido: Digite a senha do Postgres (database password):
# Obtenha em: https://supabase.com/dashboard → Settings → Database
```

**Resultado esperado**: ✅ 7 tabelas criadas + RLS habilitado

### 2️⃣ Setup Inicial do Projeto

```bash
# Criar estrutura de diretórios
mkdir backend frontend

# Backend: Node.js + TypeScript
cd backend
npm init -y
npm install express typescript @types/express @types/node ts-node
npm install supabase @supabase/supabase-js jsonwebtoken joi axios

# Frontend: React + Vite
cd ../frontend
npm create vite@latest . -- --template react
npm install axios react-router-dom tailwindcss
```

### 3️⃣ Configurar Variáveis de Ambiente

**Backend** (`.env`):
```
SUPABASE_URL=https://vkxgsejuqouozsejalhj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_ENV=development
PORT=3001
```

**Frontend** (`.env`):
```
VITE_API_URL=http://localhost:3001
```

---

## 📁 Estrutura do Projeto

```
sistema_curricular/
├── backend/                          # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── domain/                   # Modelos (Student, Group, Theme, Solution)
│   │   ├── services/                 # Serviços (optimization, auth, database)
│   │   ├── routes/                   # APIs (auth, student, organizer, public)
│   │   ├── middleware/               # Validação e autenticação
│   │   ├── config/                   # Configurações
│   │   └── main.ts                   # Express app
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                         # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/                    # Páginas (StudentForm, Login, Dashboard, etc)
│   │   ├── components/               # Componentes reutilizáveis
│   │   ├── services/                 # API client, auth
│   │   ├── hooks/                    # Custom hooks
│   │   └── App.tsx
│   ├── .env
│   ├── package.json
│   └── vite.config.ts
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql    # ✅ Aplicada
│       └── 002_rls_policies.sql      # ✅ Aplicada
│
├── PLANO.md                          # 📖 Plano detalhado
├── README.md                         # Este arquivo
├── APLICAR_MIGRACAO_PYTHON.md        # Como executar migrações
├── EXECUTAR_MIGRACAO.md              # Alternativa manual
├── apply_migrations.py               # Script de migrações
└── .gitignore
```

---

## 🎯 Roadmap

### ✅ Fase 0: Preparação (ATUAL)
- [x] Credenciais Supabase obtidas
- [x] Scripts SQL criados
- [ ] **Migrações aplicadas** ← PRÓXIMO PASSO
- [ ] Verificar 7 tabelas + RLS

### 📋 Fase 1: Setup Inicial
- [ ] Criar estrutura de diretórios
- [ ] Inicializar backend Node.js
- [ ] Inicializar frontend React
- [ ] Setup git e .gitignore

### 💻 Fase 2: Backend - Domain Models
- [ ] Implementar Student, Group, Theme, Solution
- [ ] Implementar ConstraintValidator
- [ ] Implementar PreferenceScorer

### 🔄 Fase 3: Backend - Algoritmo
- [ ] Implementar SolutionGenerator
- [ ] Implementar LocalSearch
- [ ] Implementar SimulatedAnnealing
- [ ] Implementar DistributionEngine

### 🌐 Fase 4: Backend - Routes
- [ ] Auth routes (login, validar token)
- [ ] Student routes (registrar, preferências)
- [ ] Organizer routes (distribuição)
- [ ] Public routes (busca resultado)

### 🎨 Fase 5: Frontend
- [ ] StudentFormPage (coleta dados)
- [ ] StudentPreferencesPage (rankear temas)
- [ ] StudentResultPage (busca pública)
- [ ] LoginPage e OrganizerDashboard
- [ ] ThemeUploadPage e ResultsViewer

### 🧪 Fase 6: Testes
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] Testes E2E
- [ ] Deploy

---

## 🔐 Arquitetura

### Backend
- **Framework**: Express.js
- **Linguagem**: TypeScript
- **Banco**: Supabase (PostgreSQL)
- **Autenticação**: JWT (organizadores)
- **Algoritmo**: Simulated Annealing + Local Search

### Frontend
- **Framework**: React 18+
- **Bundler**: Vite
- **Styling**: Tailwind CSS
- **Roteamento**: React Router v6
- **HTTP Client**: Axios

### Banco de Dados
- **Provider**: Supabase
- **Motor**: PostgreSQL
- **Segurança**: RLS (Row Level Security)
- **7 Tabelas**: organizers, distributions, themes, students, groups, student_preferences, group_students

---

## 🚀 Próximos Passos Imediatos

1. **Execute as migrações SQL**:
   ```bash
   python apply_migrations.py
   ```

2. **Verifique no Supabase Dashboard**:
   - SQL Editor → Execute: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'`
   - Esperado: **7**

3. **Faça o Setup Inicial** (próxima fase):
   ```bash
   mkdir backend frontend
   cd backend
   npm init -y
   ```

---

## 📚 Recursos

- [Documentação Supabase](https://supabase.com/docs)
- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)

---

## 📞 Contato / Suporte

Se encontrar problemas:
1. Consulte [PLANO.md](./PLANO.md) seção "Troubleshooting"
2. Verifique [APLICAR_MIGRACAO_PYTHON.md](./APLICAR_MIGRACAO_PYTHON.md) seção "Troubleshooting"
3. Consulte documentação oficial das tecnologias

---

**Versão**: 1.0.0 | **Última Atualização**: Fev 11, 2026 | **Status**: 🚀 Desenvolvimento Ativo
