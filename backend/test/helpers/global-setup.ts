import { execSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

interface EmbeddedPg {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  createDatabase(name: string): Promise<void>;
}

type EmbeddedPgConstructor = new (options: Record<string, unknown>) => EmbeddedPg;

async function loadEmbeddedPostgres(): Promise<EmbeddedPgConstructor> {
  const nativeImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<{ default: EmbeddedPgConstructor }>;
  const entry = pathToFileURL(join(process.cwd(), 'node_modules', 'embedded-postgres', 'dist', 'index.js')).href;
  return (await nativeImport(entry)).default;
}

const PORT = Number(process.env.TEST_DB_PORT ?? 15432);
const DATABASE = 'mesocorreaki_test';

export default async function globalSetup(): Promise<void> {
  process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'mesocorreaki-uploads-'));
  process.env.LOGIN_RATE_LIMIT = '1000';
  process.env.COOKIE_SECURE = 'false';

  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  } else {
    const databaseDir = mkdtempSync(join(tmpdir(), 'mesocorreaki-pg-'));
    const EmbeddedPostgres = await loadEmbeddedPostgres();
    const pg = new EmbeddedPostgres({
      databaseDir,
      user: 'postgres',
      password: 'postgres',
      port: PORT,
      persistent: false,
      onLog: () => undefined,
      onError: () => undefined,
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase(DATABASE);
    (globalThis as { __EMBEDDED_PG__?: EmbeddedPg }).__EMBEDDED_PG__ = pg;
    process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:${PORT}/${DATABASE}`;
  }

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
