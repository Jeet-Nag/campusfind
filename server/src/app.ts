import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './config/env';
import { db } from './db';
import { authRoutes } from './routes/auth.routes';
import { rbacTestRoutes } from './routes/rbac-test.routes';
import { categoryRoutes } from './routes/category.routes';
import { bookingRoutes } from './routes/booking.routes';
import { audioRoutes } from './routes/audio.routes';
import { providerRoutes } from './routes/provider.routes';
import { adminRoutes } from './routes/admin.routes';
import { configRoutes } from './routes/config.routes';
import { workerRoutes } from './routes/worker.routes';
import { ApiResponse } from '@shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolveClientDistPath(customPath?: string): string {
  if (customPath) {
    return path.resolve(customPath);
  }
  const relativeFromDir = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(relativeFromDir)) {
    return relativeFromDir;
  }
  const relativeFromCwd = path.resolve(process.cwd(), 'client/dist');
  if (fs.existsSync(relativeFromCwd)) {
    return relativeFromCwd;
  }
  const relativeFromCwdParent = path.resolve(process.cwd(), '../client/dist');
  if (fs.existsSync(relativeFromCwdParent)) {
    return relativeFromCwdParent;
  }
  return relativeFromDir;
}

export function resolveCorsOrigin(environment: string, corsOrigin?: string): boolean | string[] {
  if (environment !== 'production') {
    return true; // preserve development flexibility
  }

  if (!corsOrigin || corsOrigin.trim().length === 0) {
    // Fail safely in production if CORS_ORIGIN is missing
    return false;
  }

  const allowedOrigins = corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  if (allowedOrigins.length === 0) {
    return false;
  }

  return allowedOrigins;
}

export interface BuildAppOptions {
  customEnv?: {
    NODE_ENV?: 'development' | 'production' | 'test';
    CORS_ORIGIN?: string;
    JWT_SECRET?: string;
  };
  clientDistPath?: string;
}

export async function buildApp(options?: BuildAppOptions): Promise<FastifyInstance> {
  const currentEnv = options?.customEnv?.NODE_ENV || env.NODE_ENV;
  const currentCorsOrigin = options?.customEnv?.CORS_ORIGIN !== undefined
    ? options.customEnv.CORS_ORIGIN
    : env.CORS_ORIGIN;
  const currentJwtSecret = options?.customEnv?.JWT_SECRET || env.JWT_SECRET;

  const app = Fastify({
    logger: currentEnv !== 'test',
    bodyLimit: 25 * 1024 * 1024,
  });

  // CORS configuration
  await app.register(cors, {
    origin: resolveCorsOrigin(currentEnv, currentCorsOrigin),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Security headers hook
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    if (currentEnv === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });

  // JWT configuration
  await app.register(fastifyJwt, {
    secret: currentJwtSecret,
  });

  // Register Auth, Category, Booking, Audio, Provider, Admin, Worker, Config and RBAC routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(categoryRoutes, { prefix: '/api/categories' });
  await app.register(bookingRoutes, { prefix: '/api/bookings' });
  await app.register(audioRoutes, { prefix: '/api/audio' });
  await app.register(providerRoutes, { prefix: '/api/provider' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(workerRoutes, { prefix: '/api' });
  await app.register(configRoutes, { prefix: '/api/config' });
  await app.register(rbacTestRoutes);

  // Health check endpoint
  app.get('/health', async () => {
    const dbHealth = await db.checkHealth();
    return {
      status: 'ok',
      service: 'chandil-home-services-api',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      database: dbHealth,
    };
  });

  // Base API ping endpoint
  app.get('/api/ping', async () => {
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Chandil Home Services API Foundation is operational.',
      },
    };
    return response;
  });

  const clientDistPath = resolveClientDistPath(options?.clientDistPath);

  // Register static asset serving
  await app.register(fastifyStatic, {
    root: clientDistPath,
    prefix: '/',
    wildcard: false,
    serveDotFiles: true,
    setHeaders: (reply, filePath) => {
      const normalizedPath = filePath.replace(/\\/g, '/');
      if (normalizedPath.endsWith('index.html') || normalizedPath.endsWith('admin.html')) {
        reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        reply.header('Pragma', 'no-cache');
        reply.header('Expires', '0');
      } else if (normalizedPath.includes('/assets/')) {
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        reply.header('Cache-Control', 'no-cache');
      }
    },
  });

  // Dedicated Admin Web Panel routes
  const serveAdminHtml = async (_request: any, reply: any) => {
    const adminPath = path.join(clientDistPath, 'admin.html');
    if (fs.existsSync(adminPath)) {
      reply.type('text/html; charset=utf-8');
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
      return reply.sendFile('admin.html');
    }
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      reply.type('text/html; charset=utf-8');
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
      return reply.sendFile('index.html');
    }
    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        messageEn: 'Admin web panel is not built or admin.html is missing.',
        messageHi: 'एडमिन वेब पैनल उपलब्ध नहीं है।',
      },
    });
  };

  app.get('/admin', serveAdminHtml);
  app.get('/admin/', serveAdminHtml);
  app.get('/admin/*', serveAdminHtml);

  // SPA fallback and strict route exclusion handling
  app.setNotFoundHandler(async (request, reply) => {
    const rawUrl = request.raw.url || request.url;
    const pathname = rawUrl.split('?')[0];

    // 1. Strictly exclude API routes: return standard JSON 404
    if (pathname.startsWith('/api/') || pathname === '/api') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          messageEn: 'Resource not found.',
          messageHi: 'संसाधन नहीं मिला।',
        },
      };
      return reply.status(404).send(response);
    }

    // 2. Strictly exclude missing static assets under /assets/: return 404, never index.html
    if (pathname.startsWith('/assets/') || pathname === '/assets') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          messageEn: 'Static asset not found.',
          messageHi: 'फाइल नहीं मिली।',
        },
      };
      return reply.status(404).send(response);
    }

    // 3. Strictly exclude /health: return 404
    if (pathname === '/health' || pathname.startsWith('/health/')) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Route not found',
        statusCode: 404,
      });
    }

    // 4. SPA Fallback applies ONLY to GET and HEAD requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          messageEn: 'Resource not found.',
          messageHi: 'संसाधन नहीं मिला।',
        },
      };
      return reply.status(404).send(response);
    }

    // 5. If request has a file extension (e.g. .js, .css, .png, etc.) and was not found on disk, do not serve HTML
    if (path.extname(pathname) !== '' && pathname !== '/index.html' && pathname !== '/admin.html') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          messageEn: 'File not found.',
          messageHi: 'फाइल नहीं मिली।',
        },
      };
      return reply.status(404).send(response);
    }

    // 6. SPA fallback: serve admin.html for /admin navigation, index.html for other frontend routes
    if (pathname.startsWith('/admin')) {
      const adminPath = path.join(clientDistPath, 'admin.html');
      if (fs.existsSync(adminPath)) {
        reply.type('text/html; charset=utf-8');
        reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        reply.header('Pragma', 'no-cache');
        reply.header('Expires', '0');
        return reply.sendFile('admin.html');
      }
    }

    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      reply.type('text/html; charset=utf-8');
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
      return reply.sendFile('index.html');
    }

    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        messageEn: 'Application front-end is not built or index.html is missing.',
        messageHi: 'एप्लिकेशन फ्रंट-एंड उपलब्ध नहीं है।',
      },
    });
  });

  // Standard error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    const isServerError = statusCode >= 500;
    const messageEn = isServerError && currentEnv === 'production'
      ? 'An unexpected internal error occurred.'
      : (error.message || 'An unexpected internal error occurred.');

    const response: ApiResponse = {
      success: false,
      error: {
        code: isServerError ? 'INTERNAL_ERROR' : (error.code || 'VALIDATION_ERROR'),
        messageEn,
        messageHi: 'एक अप्रत्याशित समस्या आई है। कृपया दोबारा प्रयास करें।',
      },
    };
    reply.status(statusCode).send(response);
  });

  return app;
}
