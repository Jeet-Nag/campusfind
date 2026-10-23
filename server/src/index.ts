import { buildApp } from './app';
import { env } from './config/env';
import { db } from './db';
import { shutdownManager } from './shutdown';

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`[Server] CampusFind API & Web Portal running at http://${env.HOST}:${env.PORT}`);
    console.log(`[Server] Environment: ${env.NODE_ENV}`);

    const handleSignal = async (signal: string) => {
      try {
        const completed = await shutdownManager.shutdown(signal, app, { dbInstance: db, timeoutMs: 10000 });
        if (completed) {
          process.exit(0);
        }
      } catch (err) {
        console.error('[Server] Fatal error during shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => handleSignal('SIGTERM'));
    process.on('SIGINT', () => handleSignal('SIGINT'));
  } catch (err) {
    console.error('[Server] Fatal error during startup:', err);
    process.exit(1);
  }
}

start();
