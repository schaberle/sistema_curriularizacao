import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { createAuthRoutes } from './routes/auth.routes';
import { createOrganizerRoutes } from './routes/organizer.routes';
import { createPublicRoutes } from './routes/public.routes';
import { createStudentRoutes } from './routes/student.routes';
import { createThemeRoutes } from './routes/theme.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { createSecurityAuditMiddleware, requestIdMiddleware, structuredLoggingMiddleware } from './middleware/security.middleware';
import { AuthService } from './services/auth/AuthService';
import { StudentSessionService } from './services/auth/StudentSessionService';
import { DatabaseService } from './services/database/DatabaseService';

dotenv.config();

function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertStrongJwtSecret(secret: string): void {
  const isPlaceholder =
    !secret ||
    secret.length < 32 ||
    /^change_me/i.test(secret) ||
    /^seu-secret-aqui/i.test(secret);

  if (isPlaceholder) {
    throw new Error('JWT_SECRET ausente ou fraco. Defina um segredo forte com pelo menos 32 caracteres.');
  }
}

function assertServiceKey(serviceKey: string): void {
  const placeholderValues = new Set([
    '',
    'your_service_role_key',
    'your_service_role_key_here',
    'your_service_key',
  ]);

  if (placeholderValues.has(serviceKey.trim())) {
    throw new Error('SUPABASE_SERVICE_KEY obrigatoria. O backend nao aceita fallback para anon key.');
  }
}

async function initializeApp(): Promise<Application> {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  const jwtSecret = (process.env.JWT_SECRET || '').trim();
  const port = Number(process.env.PORT || 4300);
  const nodeEnv = (process.env.NODE_ENV || 'development').trim();
  const rawAllowedOrigins = process.env.CORS_ORIGIN || 'http://localhost:5174';
  const allowedOrigins = parseAllowedOrigins(rawAllowedOrigins);

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL obrigatoria');
  }

  assertServiceKey(serviceKey);
  assertStrongJwtSecret(jwtSecret);

  if (nodeEnv === 'production' && allowedOrigins.length === 0) {
    throw new Error('CORS_ORIGIN deve ser configurado em producao');
  }

  app.use(requestIdMiddleware);
  app.use(structuredLoggingMiddleware);

  app.use(
    helmet({
      hsts: nodeEnv === 'production',
      referrerPolicy: { policy: 'no-referrer' },
      contentSecurityPolicy: false,
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Permite clients sem origem (CLI/health probes).
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
    })
  );

  if (nodeEnv === 'production') {
    app.use((req: Request, res: Response, next) => {
      const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
      if (forwardedProto && forwardedProto !== 'https') {
        return res.status(400).json({
          error: 'HTTPS obrigatorio',
        });
      }

      return next();
    });
  }

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1200,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 80,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de autenticacao. Tente novamente em alguns minutos.' },
  });
  const studentWriteLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Limite de operacoes de aluno excedido. Aguarde para tentar novamente.' },
  });
  const searchLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Limite de consultas excedido. Aguarde para tentar novamente.' },
  });

  app.use(globalLimiter);

  const database = new DatabaseService(supabaseUrl, serviceKey);
  const authService = new AuthService(database, supabaseUrl, serviceKey);
  const studentSessionService = new StudentSessionService(database, jwtSecret, {
    jwtIssuer: process.env.JWT_ISSUER || 'curricularizacao-api',
    jwtAudience: process.env.JWT_AUDIENCE || 'student-api',
  });

  app.use(createSecurityAuditMiddleware(database));

  const isHealthy = await database.healthCheck();
  if (!isHealthy) {
    console.warn('Supabase health check falhou na inicializacao. O servidor subiu em modo degradado.');
  }

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      security: {
        rlsRequired: true,
        backendOnly: true,
      },
    });
  });

  app.use('/api/auth', authLimiter, createAuthRoutes(authService, studentSessionService));
  app.use('/api/themes', createThemeRoutes(database, authService));
  app.use('/api/search', searchLimiter, createPublicRoutes(database));
  app.use('/api/students', studentWriteLimiter, createStudentRoutes(database, studentSessionService));
  app.use('/api/organizer', createOrganizerRoutes(database, authService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'server_started',
          port,
          nodeEnv,
          allowedOrigins,
          supabaseUrl,
          timestamp: new Date().toISOString(),
        })
      );
      resolve();
    });
  });

  return app;
}

if (require.main === module) {
  initializeApp().catch((error) => {
    console.error('Falha ao inicializar servidor', error);
    process.exit(1);
  });
}

export default initializeApp;
