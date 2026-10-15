import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

// Search current working dir and repository root for .env and .env.local
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env.local') });

interface PreflightResult {
  dbName: string;
  dbUser: string;
  pgVersion: string;
  isStagingName: boolean;
  tableCount: number;
  tables: string[];
  migrationHistoryCount: number;
  appliedMigrations: string[];
}

export async function runStagingDbPreflight(rawUrl?: string): Promise<PreflightResult> {
  const connectionString = rawUrl || process.env.STAGING_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      '[PREFLIGHT BLOCKER] STAGING_DATABASE_URL is not set. Please provide the staging connection string via STAGING_DATABASE_URL environment variable or as a parameter.'
    );
  }

  // Parse connection URI safely without revealing password
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error('[PREFLIGHT ERROR] STAGING_DATABASE_URL is not a valid URL.');
  }

  const hostname = parsedUrl.hostname;
  const dbNameFromUrl = parsedUrl.pathname.replace(/^\//, '');

  // 1. Pre-connection safety guard
  if (dbNameFromUrl === 'chandil_home_services' || dbNameFromUrl === 'chandil_prod') {
    throw new Error(`[CRITICAL SAFETY GUARD] Refusing connection! Database name "${dbNameFromUrl}" is a production database.`);
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.warn('[WARNING] Connecting to a local host instead of remote Neon staging.');
  }

  // Connect using TLS for Neon
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const pool = new pg.Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    try {
      // 2. Verified In-Engine Identity Check
      const { rows: idRows } = await client.query<{
        current_db: string;
        current_user: string;
        pg_version: string;
      }>('SELECT current_database() AS current_db, current_user, version() AS pg_version;');

      const dbName = idRows[0].current_db;
      const dbUser = idRows[0].current_user;
      const pgVersion = idRows[0].pg_version;

      if (dbName !== 'chandil_staging') {
        throw new Error(
          `[CRITICAL SAFETY GUARD] Target database mismatch! Expected "chandil_staging", connected to "${dbName}". Connection rejected.`
        );
      }

      // 3. Inspect public schema tables
      const { rows: tableRows } = await client.query<{ table_name: string }>(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC;
      `);
      const tables = tableRows.map((r) => r.table_name);

      // 4. Inspect migration tracking table if present
      let migrationHistoryCount = 0;
      let appliedMigrations: string[] = [];

      if (tables.includes('_migrations')) {
        const { rows: migRows } = await client.query<{ name: string; applied_at: Date }>(
          'SELECT name, applied_at FROM _migrations ORDER BY id ASC;'
        );
        migrationHistoryCount = migRows.length;
        appliedMigrations = migRows.map((r) => r.name);
      }

      return {
        dbName,
        dbUser,
        pgVersion,
        isStagingName: dbName === 'chandil_staging',
        tableCount: tables.length,
        tables,
        migrationHistoryCount,
        appliedMigrations,
      };
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

// CLI Execution
if (process.argv[1] && process.argv[1].includes('staging-db-preflight')) {
  runStagingDbPreflight()
    .then((res) => {
      console.log('\n============================================================');
      console.log('CHANDIL HOME SERVICES - STAGING DATABASE PREFLIGHT REPORT');
      console.log('============================================================');
      console.log(`Database Name:          ${res.dbName} (VERIFIED: chandil_staging)`);
      console.log(`Database User:          ${res.dbUser}`);
      console.log(`PostgreSQL Engine:      ${res.pgVersion.split(' ')[0]} ${res.pgVersion.split(' ')[1]}`);
      console.log(`Public Base Tables:     ${res.tableCount}`);
      if (res.tableCount > 0) {
        console.log(`Tables Present:         ${res.tables.join(', ')}`);
      }
      console.log(`Migration History:      ${res.migrationHistoryCount} recorded migrations`);
      if (res.migrationHistoryCount > 0) {
        console.log(`Applied Migrations:     ${res.appliedMigrations.join(', ')}`);
      } else {
        console.log(`Status:                 Fresh/Empty (No migrations applied yet)`);
      }
      console.log('============================================================\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[PREFLIGHT RESULT]:', err.message);
      process.exit(1);
    });
}
