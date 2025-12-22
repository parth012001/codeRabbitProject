import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.NEON_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'NEON_DATABASE_URL environment variable is required for database migrations. ' +
      'Get your connection string from https://console.neon.tech/'
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
