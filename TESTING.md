# 🧪 Testes - Sistema de Distribuição de Grupos

## Visão Geral

Este documento descreve a estratégia de testes e como executar os testes do sistema de distribuição de grupos.

## Estrutura de Testes

```
backend/
├── __tests__/                    # Testes de integração e E2E
│   ├── integration/             # Testes de integração entre serviços
│   └── e2e/                     # Testes end-to-end
├── src/
│   ├── middleware/
│   │   └── validation.middleware.test.ts    # ✅ Testes de validação
│   ├── domain/
│   │   ├── Student.test.ts      # TODO
│   │   ├── Group.test.ts        # TODO
│   │   ├── Theme.test.ts        # TODO
│   │   └── Solution.test.ts     # TODO
│   ├── services/
│   │   ├── auth/
│   │   │   └── AuthService.test.ts          # TODO
│   │   ├── database/
│   │   │   └── DatabaseService.test.ts      # TODO
│   │   └── optimization/
│   │       └── DistributionEngine.test.ts   # TODO
│   └── routes/
│       ├── auth.routes.test.ts              # TODO
│       ├── student.routes.test.ts           # TODO
│       ├── organizer.routes.test.ts         # TODO
│       └── public.routes.test.ts            # TODO
└── jest.config.js               # Configuração Jest

frontend/
├── src/
│   ├── components/
│   │   └── __tests__/           # Testes de componentes
│   ├── hooks/
│   │   └── __tests__/           # Testes de hooks
│   ├── pages/
│   │   └── __tests__/           # Testes de páginas
│   └── services/
│       └── __tests__/           # Testes de serviços
└── vitest.config.ts            # Configuração Vitest
```

## Status de Testes

### Backend ✅ (Em Progresso)

| Módulo | Status | Testes | Cobertura |
|--------|--------|--------|-----------|
| Validation Middleware | ✅ PRONTO | 18/18 | 80% |
| Domain Models | ⏳ TODO | 0/48 | 0% |
| AuthService | ⏳ TODO | 0/12 | 0% |
| DatabaseService | ⏳ TODO | 0/20 | 0% |
| Routes (Auth) | ⏳ TODO | 0/4 | 0% |
| Routes (Student) | ⏳ TODO | 0/6 | 0% |
| Routes (Organizer) | ⏳ TODO | 0/8 | 0% |
| Routes (Public) | ⏳ TODO | 0/4 | 0% |
| **TOTAL** | ⏳ | **18/120** | **5.98%** |

### Frontend ⏳ (Não Iniciado)

| Módulo | Status | Testes |
|--------|--------|--------|
| Components | ⏳ TODO | 0 |
| Hooks | ⏳ TODO | 0 |
| Pages | ⏳ TODO | 0 |
| Services | ⏳ TODO | 0 |
| **TOTAL** | ⏳ | **0** |

### E2E ⏳ (Não Iniciado)

- Fluxo completo de aluno
- Fluxo completo de organizador
- Fluxo de distribuição
- Busca de resultados

## Como Executar Testes

### Backend

```bash
# Instalar dependências
cd backend
npm install

# Executar todos os testes
npm test

# Modo watch (re-executa ao salvar arquivos)
npm run test:watch

# Apenas testes unitários
npm run test:unit

# Apenas testes E2E
npm run test:e2e

# Com cobertura detalhada
npm test -- --coverage

# Executar teste específico
npm test -- src/middleware/validation.middleware.test.ts

# Filtrar por nome do teste
npm test -- --testNamePattern="validateStudentRegistration"
```

### Frontend

```bash
cd frontend

# Será implementado com Vitest + React Testing Library
npm run test
```

## Testes Implementados

### 1. Validation Middleware ✅

**Arquivo:** `backend/src/middleware/validation.middleware.test.ts`

**Cobertura:**
- ✅ `validateStudentRegistration` (5 testes)
  - Válido com dados corretos
  - Falha com nome ausente
  - Falha com curso inválido
  - Falha com fase inválida
  - Valida cursos EE e ME

- ✅ `validateStudentPreferences` (4 testes)
  - Válido com preferências corretas
  - Falha com array vazio
  - Falha com themeId ausente
  - Falha com ranks não-sequenciais

- ✅ `validateThemeUpload` (3 testes)
  - Válido com temas corretos
  - Falha com array vazio
  - Falha com maxGroups inválido

- ✅ `validateLoginCredentials` (3 testes)
  - Válido com credenciais corretas
  - Falha com email ausente
  - Falha com senha ausente

- ✅ `validateSearchQuery` (3 testes)
  - Válido com parâmetros corretos
  - Falha com name ausente
  - Falha com distributionId ausente

**Executar:**
```bash
npm test -- src/middleware/validation.middleware.test.ts
```

## Padrões de Teste

### Estrutura Básica

```typescript
describe('Recurso', () => {
  let resource: Tipo;

  beforeEach(() => {
    // Setup
    resource = new Tipo();
  });

  describe('Método', () => {
    it('deve fazer algo quando condição é verdadeira', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = resource.method(input);

      // Assert
      expect(result).toBe(expectedValue);
    });

    it('deve falhar quando entrada é inválida', () => {
      // Arrange
      const input = null;

      // Act & Assert
      expect(() => resource.method(input)).toThrow();
    });
  });
});
```

### Nomenclatura de Testes

- ✅ Positivos: `should [fazer algo] with [dados válidos]`
- ❌ Negativos: `should fail/throw with [dados inválidos]`
- 🔄 Edge cases: `should handle [caso extremo]`

### Cobertura Esperada

```
Instrução: > 80%
Branching: > 75%
Funções:   > 80%
Linhas:    > 80%
```

## Próximas Etapas

### 1. Testes de Domain Models (Prioridade Alta)
```bash
npm test -- src/domain/
```

Precisa testar:
- Validação de constructores
- Métodos de negócio
- Casos extremos

### 2. Testes de Serviços (Prioridade Alta)
```bash
npm test -- src/services/
```

Precisa testar:
- AuthService (autenticação, JWT)
- DatabaseService (CRUD operations)
- DistributionEngine (algoritmo)

### 3. Testes de Rotas (Prioridade Média)
```bash
npm test -- src/routes/ --setup supertest
```

Precisa testar:
- Endpoints HTTP
- Status codes
- Request/Response payloads

### 4. Testes Frontend (Prioridade Média)
```bash
cd frontend
npm test
```

Precisa testar:
- Componentes React
- Hooks customizados
- Integrações com API

### 5. Testes E2E (Prioridade Média)
```bash
npm run test:e2e
```

Precisa testar:
- Fluxo completo aluno
- Fluxo completo organizador
- Distribuição e resultados

## Configuração Jest

**Arquivo:** `backend/jest.config.js`

```javascript
{
  preset: 'ts-jest',              // Suporta TypeScript
  testEnvironment: 'node',        // Ambiente Node.js
  roots: ['<rootDir>/src'],       // Diretório raiz
  testMatch: [...],               // Padrão de arquivos de teste
  collectCoverageFrom: [...],     // Arquivos para cobertura
  coverageThreshold: {            // Limiares mínimos
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  }
}
```

## Debugging de Testes

### Executar teste específico com debug
```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand src/path/to/test.ts
```

### Verbose output
```bash
npm test -- --verbose
```

### Mostrar que teste falhou
```bash
npm test -- --verbose --bail
```

### Ver cobertura de arquivo específico
```bash
npm test -- --coverage --collectCoverageFrom="src/services/**"
```

## Integração Contínua

### GitHub Actions (Exemplo)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 18
      - run: npm install
      - run: npm test -- --coverage
```

## Troubleshooting

### Erro: "Cannot find module"
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
npm test
```

### Erro: "Timeout exceeded"
```bash
# Aumentar timeout (padrão: 5000ms)
jest.setTimeout(10000);
```

### Erro: "Test failed but no error"
```bash
# Executar em modo verbose
npm test -- --verbose
```

## Recursos Úteis

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [React Testing Library](https://testing-library.com/react)
- [Cypress Documentation](https://docs.cypress.io/)

## Métricas de Qualidade

### Alvo (Sprint atual)
- Cobertura: 80%+ dos testes críticos
- Testes passando: 100%
- Tempo execução: < 1 minuto

### Tendência
- Incrementar testes conforme se desenvolve
- Priorizar testes de camada de validação
- Focar em testes de integração para APIs

## Contato & Suporte

Para dúvidas sobre testes:
1. Verificar este documento
2. Consultar código existente em `src/middleware/validation.middleware.test.ts`
3. Executar `npm test -- --help` para opções Jest

---

**Última atualização:** 2026-02-11
**Mantido por:** Sistema de Distribuição de Grupos
**Status:** Em Progresso (18/120 testes)
