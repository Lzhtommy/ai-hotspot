import 'dotenv/config';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local explicitly (dotenv/config only loads .env)
config({ path: '.env.local' });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
