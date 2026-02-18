import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { createAuthRoutes } from './routes/auth.routes';
import { createOrganizerRegistryRoutes } from './routes/organizerRegistry.routes';
import { createOrganizerRoutes } from './routes/organizer.routes';
import { createPublicRoutes } from './routes/public.routes';
import { createSecurityRoutes } from './routes/security.routes';
import { createStudentRoutes } from './routes/student.routes';
import { createThemeRoutes } from './routes/theme.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import {
  publicErrorContractMiddleware,
  sendPublicError,
} from './middleware/publicError.middleware';
import {
  createSecurityAuditMiddleware,
  requestIdMiddleware,
  structuredLoggingMiddleware,
} from './middleware/security.middleware';
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

function parseCspConnectSources(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
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
  const isProduction = nodeEnv === 'production';
  const rawAllowedOrigins = process.env.CORS_ORIGIN || 'http://localhost:5174';
  const allowedOrigins = parseAllowedOrigins(rawAllowedOrigins);
  const cspEnforce = String(process.env.CSP_ENFORCE || '').toLowerCase() === 'true';
  const cspReportUri = String(process.env.CSP_REPORT_URI || '/api/security/csp-report').trim();
  const cspConnectExtra = parseCspConnectSources(process.env.CSP_CONNECT_SRC);

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL obrigatoria');
  }

  assertServiceKey(serviceKey);
  assertStrongJwtSecret(jwtSecret);

  if (isProduction && allowedOrigins.length === 0) {
    throw new Error('CORS_ORIGIN deve ser configurado em producao');
  }
  if (isProduction && allowedOrigins.some((origin) => /localhost|127\.0\.0\.1/i.test(origin))) {
    throw new Error('CORS_ORIGIN em producao nao pode conter localhost/127.0.0.1');
  }

  const cspConnectSrc = Array.from(
    new Set([
      "'self'",
      ...allowedOrigins,
      ...cspConnectExtra,
      supabaseUrl,
      supabaseUrl.replace(/^http/i, 'ws'),
    ])
  );

  app.use(requestIdMiddleware);
  app.use(publicErrorContractMiddleware);
  app.use(structuredLoggingMiddleware);

  app.use(
    helmet({
      hsts: isProduction,
      referrerPolicy: { policy: 'no-referrer' },
      contentSecurityPolicy: {
        useDefaults: false,
        reportOnly: !cspEnforce,
        directives: {
          defaultSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: cspConnectSrc,
          reportUri: [cspReportUri],
        },
      },
    })
  );

  app.use((req: Request, res: Response, next) => {
    res.setHeader(
      'Report-To',
      JSON.stringify({
        group: 'csp-endpoint',
        max_age: 10886400,
        endpoints: [{ url: cspReportUri }],
      })
    );
    next();
  });

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

  if (isProduction) {
    app.use((req: Request, res: Response, next) => {
      const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
      if (forwardedProto && forwardedProto !== 'https') {
        return sendPublicError(req, res, {
          status: 400,
          errorCode: 'VALIDATION_FAILED',
          message: 'HTTPS obrigatorio',
        });
      }

      return next();
    });
  }

  app.use(
    express.json({
      limit: '2mb',
      type: ['application/json', 'application/csp-report', 'application/reports+json'],
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1200,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) =>
      sendPublicError(req, res, {
        status: 429,
        errorCode: 'RATE_LIMITED',
        message: 'Limite global de requisicoes excedido. Tente novamente em alguns minutos.',
      }),
  });
  const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 80,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) =>
      sendPublicError(req, res, {
        status: 429,
        errorCode: 'RATE_LIMITED',
        message: 'Muitas tentativas de autenticacao. Tente novamente em alguns minutos.',
      }),
  });
  const studentWriteLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) =>
      sendPublicError(req, res, {
        status: 429,
        errorCode: 'RATE_LIMITED',
        message: 'Limite de operacoes de aluno excedido. Aguarde para tentar novamente.',
      }),
  });
  const searchLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) =>
      sendPublicError(req, res, {
        status: 429,
        errorCode: 'RATE_LIMITED',
        message: 'Limite de consultas excedido. Aguarde para tentar novamente.',
      }),
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
        cspMode: cspEnforce ? 'enforce' : 'report-only',
      },
    });
  });

  app.use('/api/security', createSecurityRoutes(database));
  app.use('/api/auth', authLimiter, createAuthRoutes(authService, studentSessionService));
  app.use('/api/themes', createThemeRoutes(database, authService));
  app.use('/api/search', searchLimiter, createPublicRoutes(database));
  app.use('/api/students', studentWriteLimiter, createStudentRoutes(database, studentSessionService));
  app.use('/api/organizer', createOrganizerRegistryRoutes(database, authService));
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
          cspMode: cspEnforce ? 'enforce' : 'report-only',
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
