import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { DatabaseService } from './services/database/DatabaseService';
import { AuthService } from './services/auth/AuthService';
import { createAuthRoutes } from './routes/auth.routes';
import { createStudentRoutes } from './routes/student.routes';
import { createOrganizerRoutes } from './routes/organizer.routes';
import { createPublicRoutes } from './routes/public.routes';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';

// Carregar variáveis de ambiente
dotenv.config();

/**
 * Inicializa e configura a aplicação Express
 */
async function initializeApp(): Promise<Application> {
  const app = express();

  // ============================================================
  // VARIÁVEIS DE AMBIENTE
  // ============================================================
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
  const jwtSecret = process.env.JWT_SECRET || 'seu-secret-aqui';
  const port = process.env.PORT || 3001;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios');
  }

  // ============================================================
  // MIDDLEWARES GLOBAIS
  // ============================================================

  // CORS
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    })
  );

  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // ============================================================
  // SERVIÇOS
  // ============================================================

  const database = new DatabaseService(supabaseUrl, supabaseKey);
  const authService = new AuthService(database, jwtSecret);

  // Verificar conexão com banco de dados
  console.log('Verificando conexão com Supabase...');
  const isHealthy = await database.healthCheck();
  if (!isHealthy) {
    console.warn('⚠️  Aviso: Não foi possível conectar ao Supabase');
  } else {
    console.log('✅ Conexão com Supabase estabelecida');
  }

  // ============================================================
  // ROTAS
  // ============================================================

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Auth routes (sem autenticação)
  app.use('/api/auth', createAuthRoutes(authService));

  // Student routes (sem autenticação, apenas para registro)
  app.use('/api/students', createStudentRoutes(database));

  // Public routes (busca de resultados, sem autenticação)
  app.use('/api/search', createPublicRoutes(database));
  app.use('/api/themes', createPublicRoutes(database));

  // Organizer routes (requer autenticação)
  app.use('/api/organizer', createOrganizerRoutes(database, authService));

  // ============================================================
  // ERROR HANDLING
  // ============================================================

  // 404 handler (deve estar após todas as rotas)
  app.use(notFoundHandler);

  // Global error handler (deve estar por último)
  app.use(errorHandler);

  // ============================================================
  // INICIAR SERVIDOR
  // ============================================================

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    🚀 SERVIDOR BACKEND INICIADO 🚀                         ║
╚════════════════════════════════════════════════════════════════════════════╝

📊 INFORMAÇÕES DO SERVIDOR:
───────────────────────────────────────────────────────────────────────────
  URL:     http://localhost:${port}
  Ambiente: ${process.env.NODE_ENV || 'development'}
  CORS:    ${process.env.CORS_ORIGIN || 'http://localhost:5173'}

📚 ROTAS DISPONÍVEIS:
───────────────────────────────────────────────────────────────────────────
  GET  /health                                    → Health check

  POST /api/auth/login                           → Login organizador
  GET  /api/auth/verify                          → Verificar token

  POST /api/students/:distributionId             → Registrar aluno
  PUT  /api/students/:studentId/preferences      → Adicionar preferências
  GET  /api/students/:studentId                  → Buscar dados do aluno

  GET  /api/search?name=...&distributionId=...  → Buscar resultado (público)
  GET  /api/themes/:distributionId               → Listar temas (público)

  POST /api/organizer/distributions              → Criar distribuição
  POST /api/organizer/distributions/:id/themes   → Upload de temas
  POST /api/organizer/distributions/:id/execute  → Executar distribuição
  GET  /api/organizer/distributions/:id/results  → Resultados

🔐 AUTENTICAÇÃO:
───────────────────────────────────────────────────────────────────────────
  JWT Secret: Configurado (${jwtSecret.length} caracteres)
  Expiração: 24h

🗄️  BANCO DE DADOS:
───────────────────────────────────────────────────────────────────────────
  Supabase URL: ${supabaseUrl}
  Conexão: ${isHealthy ? '✅ OK' : '⚠️  Erro'}

═══════════════════════════════════════════════════════════════════════════
      Pressione Ctrl+C para parar o servidor
═══════════════════════════════════════════════════════════════════════════
      `);
      resolve(app);
    });
  });
}

// ============================================================
// INICIAR APLICAÇÃO
// ============================================================

if (require.main === module) {
  initializeApp()
    .catch((error) => {
      console.error('❌ Erro ao inicializar servidor:', error);
      process.exit(1);
    });
}

export default initializeApp;
