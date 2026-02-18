import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { DatabaseService } from './services/database/DatabaseService';
import { AuthService } from './services/auth/AuthService';
import { createAuthRoutes } from './routes/auth.routes';
import { createStudentRoutes } from './routes/student.routes';
import { createOrganizerRoutes } from './routes/organizer.routes';
import { createPublicRoutes } from './routes/public.routes';
import { createThemeRoutes } from './routes/theme.routes';
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
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  // Use Service Key to bypass RLS on backend if provided and not a placeholder
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();

  const supabaseKey = (serviceKey && serviceKey !== 'your_service_role_key_here')
    ? serviceKey
    : anonKey;
  const jwtSecret = process.env.JWT_SECRET || 'seu-secret-aqui';
  const port = process.env.PORT || 4300;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY são obrigatórios');
  }

  // ============================================================
  // MIDDLEWARES GLOBAIS
  // ============================================================

  // CORS
  const allowedOrigins = [
    process.env.CORS_ORIGIN || 'http://localhost:5174',
    'http://localhost:5174',
    'http://localhost:5173',
    'http://localhost:3000'
  ];

  app.use(
    cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
          callback(null, true);
        } else {
          // Temporarily allow all for debugging if needed, but for now stick to list
          // console.warn('Blocked by CORS:', origin);
          // return callback(new Error('Not allowed by CORS'));
          // For development ease, let's essentially allow all localhost
          if (origin.startsWith('http://localhost')) {
            return callback(null, true);
          }
          callback(new Error('Not allowed by CORS'));
        }
      },
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
  const authService = new AuthService(database, supabaseUrl, supabaseKey);

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

  // Themes route FIRST (to see if it hits)
  app.use('/api/themes', createThemeRoutes(database));

  // Auth routes (sem autenticação)
  app.use('/api/auth', createAuthRoutes(authService));

  // Student routes (sem autenticação, apenas para registro)
  app.use('/api/students', createStudentRoutes(database));

  // Public/Search routes (sem autenticação)
  app.use('/api/search', createPublicRoutes(database));

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
  CORS:    ${process.env.CORS_ORIGIN || 'http://localhost:5174'}

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
