import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(fileName: string) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

function getRequired(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? '3000'),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200',
  usersApiUrl: getRequired('USERS_API_URL'),
  groupsApiUrl: getRequired('GROUPS_API_URL'),
  ticketsApiUrl: getRequired('TICKETS_API_URL'),
  supabaseUrl: getRequired('SUPABASE_URL'),
  supabaseAnonKey: getRequired('SUPABASE_ANON_KEY'),
  supabaseSecretKey: getRequired('SUPABASE_SECRET_KEY'),
};
