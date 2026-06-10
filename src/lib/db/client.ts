import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// Supabase Postgres via node-postgres. DATABASE_URL should point at the
// Supabase connection pooler (Supavisor) URL — typically the Transaction
// pooler on port 6543 for serverless, or the Session pooler on 5432. The
// pooler enforces TLS, so the connection string must carry `sslmode=require`
// (Supabase's copy-paste URLs already include it).
//
// node-postgres returns query results as `{ rows, rowCount, ... }`, matching
// the shape the rest of the codebase reads off `db.execute(...)`. No Edge
// routes import this file, so the TCP pool is always created in a Node runtime.
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle({ client: pool, schema });
export { schema };
