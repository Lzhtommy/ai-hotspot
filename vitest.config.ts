import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    // voyageai ESM package uses bare directory imports (../api) that Node's ESM resolver
    // doesn't support. Force Vite to bundle voyageai so directory imports resolve correctly.
    // Note: deps.inline is deprecated in vitest 2.x in favour of server.deps.inline, but
    // server.deps.inline uses the Vite dev server resolver which does NOT fix this issue in
    // the test runner. deps.inline (via vite-node) is the only option that resolves it here.
    // TODO: revisit when upgrading to vitest 3.x.
    deps: {
      inline: ['voyageai'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
