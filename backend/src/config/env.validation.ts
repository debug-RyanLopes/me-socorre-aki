import { Global, Injectable, Module } from '@nestjs/common';

export interface AppSettings {
  databaseUrl: string;
  port: number;
  sessionTtlHours: number;
  cookieSecure: boolean;
  uploadDir: string;
  maxUploadMb: number;
  maxFilesPerRequest: number;
  reopenWindowHours: number;
  passwordMinLength: number;
  appTimezone: string;
  seedOnStart: boolean;
  seedPassword: string;
}

function readNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Variável de ambiente ${name} inválida: ${raw}`);
  }
  return value;
}

function readBoolean(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true';
}

export function loadSettings(env: NodeJS.ProcessEnv = process.env): AppSettings {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Variável de ambiente DATABASE_URL é obrigatória');
  return {
    databaseUrl,
    port: readNumber(env, 'PORT', 3000),
    sessionTtlHours: readNumber(env, 'SESSION_TTL_HOURS', 8),
    cookieSecure: readBoolean(env, 'COOKIE_SECURE', false),
    uploadDir: env.UPLOAD_DIR ?? './uploads',
    maxUploadMb: readNumber(env, 'MAX_UPLOAD_MB', 5),
    maxFilesPerRequest: readNumber(env, 'MAX_FILES_PER_REQUEST', 5),
    reopenWindowHours: readNumber(env, 'REOPEN_WINDOW_HOURS', 72),
    passwordMinLength: readNumber(env, 'PASSWORD_MIN_LENGTH', 10),
    appTimezone: env.APP_TIMEZONE ?? 'America/Sao_Paulo',
    seedOnStart: readBoolean(env, 'SEED_ON_START', false),
    seedPassword: env.SEED_PASSWORD ?? '',
  };
}

@Injectable()
export class AppConfig {
  readonly settings: AppSettings = loadSettings();
}

@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
export class ConfigModule {}
