import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

// Neon serverless requires the `ws` package's WebSocket in Node runtimes.
// Node 22+ exposes a native globalThis.WebSocket (Undici), but it lacks the
// options Neon's binary-framing handshake needs — handshake fails in ~1.6s
// before any query runs. Bind unconditionally. No Edge routes import this
// file, so there is no edge runtime to regress.
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle({ client: pool, schema });
export { schema };
