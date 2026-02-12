# Plano: Sistema Web de Distribuição de Grupos para Atividade Interdisciplinar

## Contexto
Sistema web completo para distribuição automática de grupos (4 alunos) em atividade colaborativa entre Engenharia Elétrica e Mecânica. Inclui:
- **Backend**: Algoritmo de otimização (Node.js + TypeScript)
- **Banco de Dados**: Supabase/PostgreSQL
- **Frontend**: Interface para alunos (coleta de dados, busca) + Dashboard para organizadores (gerenciamento)

**Fluxo de Usuário**:
1. Organizador: Login → Upload temas → Executar distribuição → Visualizar resultados
2. Aluno: Preenche formulário (nome, curso, fase) → Rankeia temas → Sistema distribui → Busca resultado público

**Escala**: 50-200 alunos, ~12 grupos (5 temas), 10 fases distintas

## Requisitos Funcionais

### 1. Distribuição
- Grupos de exatamente 4 alunos
- Alocação em N temas/projetos (flexível, definido em tempo de execução)

### 2. Restrições (por ordem de importância)
1. **CRÍTICA**: 1-2 alunos de Eng. Elétrica por grupo (resto Eng. Mecânica)
2. **CRÍTICA**: MÍNIMO 2 fases diferentes por grupo
3. **DESEJÁVEL**: IDEAL 3 fases diferentes por grupo (máximo 3)
4. **DESEJÁVEL**: Idealmente cada aluno de uma fase diferente

### 3. Otimização por Preferência
- Cada aluno fornece ranking de temas (do mais ao menos preferido)
- **OBJETIVO**: Maximizar satisfação global respeitando restrições críticas
- **ESTRATÉGIA**: Otimização global (não greedy)

## Arquitetura de Solução

### Stack Tecnológico

**Backend**
- Node.js + TypeScript + Express
- Supabase/PostgreSQL (banco de dados)
- Autenticação com JWT (organizadores)
- APIs REST para comunicação com frontend

**Frontend**
- React + Vite (bundler rápido)
- Axios para requisições HTTP
- TypeScript
- Styled components ou Tailwind CSS (estilo)

**Banco de Dados**
- Supabase (PostgreSQL gerenciado)
- RLS (Row Level Security) para controle de acesso

**Dependências principais**:
- Backend: `express`, `supabase`, `jsonwebtoken`, `joi`, `csv-parser`, `exceljs`, `pdfkit`
- Frontend: `react`, `react-router-dom`, `axios`, `tailwindcss`
- Testes: `jest`, `testing-library`

### Estrutura de Módulos

**Backend** (`backend/src/`)
```
domain/                       # Modelos de domínio
├── Student.ts               # Aluno (curso, fase, preferências)
├── Group.ts                 # Grupo (4 alunos + tema)
├── Theme.ts                 # Tema/Projeto
├── Solution.ts              # Solução (alocação + violações)
└── types.ts                 # Enums (Course, Phase) e interfaces

services/
├── optimization/
│   ├── DistributionEngine.ts    # Orquestrador (3 fases)
│   ├── ConstraintValidator.ts   # Valida restrições
│   ├── PreferenceScorer.ts      # Calcula satisfação
│   └── SolutionGenerator.ts     # Gera solução inicial
├── algorithms/
│   ├── LocalSearch.ts           # Busca local
│   └── SimulatedAnnealing.ts    # Otimização global
├── database/
│   └── DatabaseService.ts       # Operações com Supabase
└── auth/
    └── AuthService.ts           # Validação JWT para organizadores

routes/
├── auth.routes.ts           # Login organizadores
├── organizer.routes.ts      # Upload temas, executar distribuição
├── student.routes.ts        # Coleta dados alunos, rankear temas
└── public.routes.ts         # Busca pública de resultados

middleware/
├── auth.middleware.ts       # Verificar JWT (organizadores)
└── validation.middleware.ts # Validar requisições

config/
├── constraints.config.ts    # Restrições
├── database.ts              # Conexão Supabase
└── env.ts                   # Variáveis de ambiente

utils/
├── logger.ts
└── helpers.ts

main.ts                       # Express app + rotas
```

**Frontend** (`frontend/src/`)
```
pages/
├── StudentFormPage.tsx      # Formulário aluno (nome, curso, fase)
├── StudentPreferencesPage.tsx   # Rankear temas
├── StudentResultPage.tsx    # Busca resultado (nome → grupo)
├── LoginPage.tsx            # Login organizador
├── OrganizerDashboard.tsx   # Painel organizador
├── ThemeUploadPage.tsx      # Upload temas
└── ResultsViewer.tsx        # Visualizar distribuição

components/
├── StudentForm/             # Componentes do formulário
├── PreferenceRanker/        # Widget de rankear temas
├── SearchBar/               # Busca de aluno
├── GroupResultCard/         # Card mostrando grupo do aluno
├── ResultTable/             # Tabela de resultados
└── Navigation/              # Header/Menu

services/
├── api.ts                   # Requisições HTTP (axios)
├── authService.ts           # Login/logout
└── types.ts                 # TypeScript types

hooks/
├── useAuth.ts               # Contexto de autenticação
└── useForm.ts               # Gerenciar dados de formulário

styles/                       # Tailwind CSS ou styled-components
└── globals.css

pages/
├── index.tsx                # Home/Rota raiz
└── App.tsx                  # Router principal
```

**Banco de Dados** (`supabase/`)
```
migrations/
├── 001_create_users_organizers.sql      # Tabela organizadores
├── 002_create_students.sql              # Tabela alunos
├── 003_create_themes.sql                # Tabela temas
├── 004_create_groups.sql                # Tabela grupos
├── 005_create_distributions.sql         # Histórico distribuições
└── 006_rls_policies.sql                 # Row Level Security

Schema Principal:
- organizers: id, email, password_hash, created_at
- students: id, name, course, phase, created_at, distribution_id
- student_preferences: id, student_id, theme_id, rank
- themes: id, name, description, max_groups, distribution_id, created_at
- groups: id, theme_id, distribution_id, created_at
- group_students: group_id, student_id (junction table)
- distributions: id, status, created_at, executed_at, organizer_id
```

### Algoritmo: Abordagem em 3 Fases

**Fase 1: Geração de Solução Inicial**
- Heurística construtiva baseada em preferências
- Garante restrições CRÍTICAS
- Resultado: Solução viável básica

**Fase 2: Refinamento Local**
- Busca local (2-opt, 3-opt)
- Troca de alunos entre grupos
- Melhora satisfação mantendo viabilidade

**Fase 3: Otimização Global**
- Simulated Annealing para escapar ótimos locais
- Aceita soluções piores temporariamente
- Resultado: Melhor solução global encontrada

### Fluxo de Dados e Rotas

**Fluxo de Coleta (Alunos)**
```
Frontend - StudentFormPage
       ↓
POST /api/students (registrar aluno)
       ↓
Backend salva em DB
       ↓
Frontend - StudentPreferencesPage
       ↓
PUT /api/students/:id/preferences (rankear temas)
       ↓
Backend salva em DB
       ↓
Aluno pode buscar resultado
```

**Fluxo de Distribuição (Organizadores)**
```
Frontend - OrganizerDashboard
       ↓
POST /api/distributions/create (iniciar distribuição)
       ↓
Backend: DistributionEngine.solve()
  ├─ Fetch alunos e temas do DB
  ├─ SolutionGenerator.createInitial()
  ├─ LocalSearch.optimize()
  └─ SimulatedAnnealing.optimize()
       ↓
POST /api/distributions/:id/save (salvar resultado)
       ↓
Backend salva grupos no DB
       ↓
GET /api/distributions/:id/results (visualizar)
       ↓
Frontend - ResultsViewer mostra tabela
```

**Fluxo de Busca Pública (Alunos)**
```
Frontend - StudentResultPage
       ↓
GET /api/search?name=João (busca pública - sem autenticação)
       ↓
Backend retorna grupo + tema
       ↓
Frontend mostra resultado (GroupResultCard)
```

**Fluxo de Autenticação (Organizadores)**
```
Frontend - LoginPage
       ↓
POST /api/auth/login (email + password)
       ↓
Backend valida credenciais, retorna JWT
       ↓
Frontend armazena token em localStorage
       ↓
Requisições subsequentes incluem Authorization header
```

## Arquivos Críticos a Implementar

### Backend (Node.js/Express)
1. **backend/src/domain/types.ts** - Enums (Course, Phase) e interfaces
2. **backend/src/domain/Student.ts** - Modelo aluno
3. **backend/src/domain/Group.ts** - Modelo grupo
4. **backend/src/domain/Solution.ts** - Solução
5. **backend/src/services/optimization/DistributionEngine.ts** - Orquestrador
6. **backend/src/services/algorithms/** - LocalSearch, SimulatedAnnealing
7. **backend/src/services/database/DatabaseService.ts** - Operações Supabase
8. **backend/src/services/auth/AuthService.ts** - Autenticação JWT
9. **backend/src/routes/** - Auth, organizer, student, public routes
10. **backend/src/config/database.ts** - Conexão Supabase
11. **backend/src/config/constraints.config.ts** - Restrições
12. **backend/src/main.ts** - Express app

### Frontend (React/Vite)
1. **frontend/src/pages/StudentFormPage.tsx** - Coleta dados aluno
2. **frontend/src/pages/StudentPreferencesPage.tsx** - Rankear temas
3. **frontend/src/pages/StudentResultPage.tsx** - Busca resultado
4. **frontend/src/pages/LoginPage.tsx** - Login organizadores
5. **frontend/src/pages/OrganizerDashboard.tsx** - Painel controle
6. **frontend/src/pages/ThemeUploadPage.tsx** - Upload temas
7. **frontend/src/pages/ResultsViewer.tsx** - Visualizar distribuição
8. **frontend/src/services/api.ts** - Cliente HTTP
9. **frontend/src/services/authService.ts** - Gerenciar auth
10. **frontend/src/hooks/useAuth.ts** - Contexto autenticação

### Banco de Dados (Supabase/PostgreSQL)
1. **supabase/migrations/001_create_users_organizers.sql**
2. **supabase/migrations/002_create_students.sql**
3. **supabase/migrations/003_create_themes.sql**
4. **supabase/migrations/004_create_groups.sql**
5. **supabase/migrations/005_create_distributions.sql**
6. **supabase/migrations/006_rls_policies.sql** - Row Level Security

## Formato de Entrada/Saída

### Formulário Aluno (Web)
```
Fase 1: Dados Básicos
- Nome (text)
- Curso (select: EE, ME)
- Fase (select: 1-10)

Fase 2: Preferências
- Rankear temas (drag & drop ou select)
- Salvar
```

### Upload Organizador (CSV → Web)
Organizador faz upload de CSV com temas:
```
id,nome,descricao,max_grupos
tema_a,Tema A,Descrição A,3
tema_b,Tema B,Descrição B,2
```

### Saída de Distribuição
```json
{
  "id": "dist_123",
  "status": "completed",
  "groups": [
    {
      "id": "g1",
      "themeId": "tema_a",
      "students": [
        { "id": "s1", "name": "João", "course": "EE", "phase": 3 },
        ...
      ]
    }
  ],
  "score": 8750,
  "isFeasible": true,
  "violations": []
}
```

### Resultado Público (GET /api/search?name=João)
```json
{
  "found": true,
  "name": "João Silva",
  "group": "G1",
  "theme": "Tema A",
  "members": ["João Silva", "Maria Santos", "Pedro Costa", "Ana Silva"]
}
```

## Tratamento de Cenários Infeasíveis

- Verificar suficiência de alunos de EE para restrição 1-2 por grupo
- Verificar distribuição adequada de fases
- Reportar claramente quais cenários são impossíveis
- Sugerir ajustes (aumentar alunos, reduzir grupos, etc.)

## Validação e Testes

### Casos Críticos
- Grupo com 1 EE vs 2 EE (ambos válidos)
- Rejeitar 0 ou 3+ elétricos
- Rejeitar mesma fase para todos
- Alertar se nem todas fases são diferentes
- Distribuir 50-200 alunos mantendo viabilidade
- Otimizar satisfação sem violar criticalidades

### E2E
CSV → Validação → Distribuição → PDF/Excel/JSON/Web

## Performance Esperada
- **50 alunos**: ~2 segundos
- **100 alunos**: ~5 segundos
- **200 alunos**: ~10 segundos

## Roadmap de Implementação

### Fase 0: Preparação (PRÉ-REQUISITOS)
- [ ] Executar migrações SQL no Supabase Dashboard
  - `supabase/migrations/001_initial_schema.sql` (cria 7 tabelas)
  - `supabase/migrations/002_rls_policies.sql` (configura RLS)
- [ ] Verificar: 7 tabelas criadas em `public` schema
- [ ] Verificar: RLS habilitado em todas as tabelas

### Fase 1: Setup Inicial
- [ ] Criar estrutura de diretórios: `backend/`, `frontend/`, `supabase/`
- [ ] Inicializar projeto Node.js: `npm init -y` (backend)
- [ ] Inicializar projeto React: `npm create vite@latest frontend -- --template react` (frontend)
- [ ] Setup git: `git init`, `.gitignore`
- [ ] Instalar dependências principais (próximo passo)

### Fase 2: Banco de Dados
- [ ] Criar tabelas no Supabase (via SQL Editor no dashboard)
  - Tabela organizers (id, email, password_hash, created_at)
  - Tabela students (id, name, course, phase, distribution_id, created_at)
  - Tabela themes (id, name, description, max_groups, distribution_id, created_at)
  - Tabela groups (id, theme_id, distribution_id, created_at)
  - Tabela group_students (group_id, student_id) - junction table
  - Tabela student_preferences (id, student_id, theme_id, rank)
  - Tabela distributions (id, status, created_at, executed_at, organizer_id)
- [ ] Configurar RLS policies (Row Level Security)
- [ ] Setup conexão Supabase no backend
- [ ] Testar conexão via código

### Fase 3: Backend - Autenticação & Routes Base
- [ ] Implementar AuthService (JWT)
- [ ] Implementar auth routes (login, validar token)
- [ ] Implementar student routes (registrar, preferências)
- [ ] Implementar organizer routes (criar distribuição)
- [ ] Implementar public routes (busca resultado)

### Fase 4: Backend - Domain Models
- [ ] Implementar Student, Group, Theme, Solution
- [ ] Implementar ConstraintValidator
- [ ] Implementar PreferenceScorer

### Fase 5: Backend - Algoritmo de Otimização
- [ ] Implementar SolutionGenerator
- [ ] Implementar LocalSearch
- [ ] Implementar SimulatedAnnealing
- [ ] Implementar DistributionEngine (orquestrador)

### Fase 6: Frontend - Páginas Alunos
- [ ] StudentFormPage (coleta dados)
- [ ] StudentPreferencesPage (rankear temas)
- [ ] StudentResultPage (busca pública)
- [ ] Componentes auxiliares

### Fase 7: Frontend - Páginas Organizadores
- [ ] LoginPage (autenticação)
- [ ] OrganizerDashboard (painel controle)
- [ ] ThemeUploadPage (upload CSV)
- [ ] ResultsViewer (visualizar distribuição)

### Fase 8: Integração & Testes
- [ ] Testes unitários (backend)
- [ ] Testes de integração (API)
- [ ] Testes E2E (fluxo completo)
- [ ] Testes de UI (frontend)
- [ ] Deploy (Vercel frontend, Render/Railway backend, Supabase DB)

### Fase 9: Refinamento & Documentação
- [ ] Otimizações de performance
- [ ] Melhorar UX/UI
- [ ] Documentação de código
- [ ] README com instruções de setup

## Setup do Banco de Dados Supabase

**Projeto**: vkxgsejuqouozsejalhj

**Status**:
- ✅ Credenciais obtidas
- ✅ Scripts SQL criados em `supabase/migrations/`
- ✅ Documentação completa criada (README.md, PLANO.md, etc)
- ✅ 4 scripts de migração criados (apply_migrations.py, migrate.sh, migrate.bat, migrate.py)
- ✅ .gitignore e ARQUIVOS_CRIADOS.md configurados
- ⏳ **PRÓXIMO PASSO: Executar migrações SQL**

**Problema Encontrado & Resolvido**: MCP do Supabase retorna erro de permissão
**Solução Implementada**: Script Python com psycopg2 (veja APLICAR_MIGRACAO_PYTHON.md)

**Soluções Disponíveis** (em ordem de praticidade):
1. ✅ **Python Script** (RECOMENDADO) - `apply_migrations.py`
2. 📊 **Dashboard Manual** - EXECUTAR_MIGRACAO.md
3. 💻 **Supabase CLI** - Requer instalação adicional

**Instruções**:
1. Abra https://supabase.com/dashboard
2. Selecione projeto `vkxgsejuqouozsejalhj`
3. Vá para "SQL Editor" → "New Query"
4. Copie conteúdo de `supabase/migrations/001_initial_schema.sql` e execute
5. Copie conteúdo de `supabase/migrations/002_rls_policies.sql` e execute
6. Verifique: 7 tabelas criadas + RLS habilitado

**Variáveis de Ambiente** (backend `.env`):
```
SUPABASE_URL=https://vkxgsejuqouozsejalhj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreGdzZWp1cW91b3pzZWphbGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDkxNjgsImV4cCI6MjA4NjQyNTE2OH0.FdWqe4hGHDknTos4BghG60DOSewH3qRuqQFnlAamcSw
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreGdzZWp1cW91b3pzZWphbGhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0OTEzMCwiZXhwIjoyMDg2NDI1MTY4fQ.0HcFmGbqirpwF2hEIYARSEWAwj0cwN8Le1L-E-wAPAc
NODE_ENV=development
```

Ver arquivo: `SETUP_SUPABASE.md` para instruções detalhadas

## Verificação Final

### Checklist de Funcionalidades
- [ ] Aluno consegue preencher formulário (nome, curso, fase)
- [ ] Aluno consegue rankear temas
- [ ] Aluno consegue buscar seu resultado por nome (público, sem login)
- [ ] Organizador consegue fazer login
- [ ] Organizador consegue upload de temas (CSV)
- [ ] Organizador consegue executar distribuição
- [ ] Sistema respeita restrições criticamente (1-2 EE, 2+ fases)
- [ ] Sistema otimiza preferências
- [ ] Resultados são salvos no DB
- [ ] Distribuição leva < 10 segundos para 200 alunos
- [ ] Sistema trata cenários infeasíveis gracefully
