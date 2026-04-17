import { defineConfig } from '@trigger.dev/sdk';

/**
 * Trigger.dev v4 project config.
 *
 * - project ref sourced from TRIGGER_PROJECT_REF at build/deploy time (D-13).
 * - `dirs` tells the CLI where to find task files — locks the src/trigger/ convention
 *   from CONTEXT.md D-13 so new tasks are auto-discovered.
 * - `runtime: 'node'` matches the minimum Node 20.9 floor from D-14.
 *
 * Import path: `@trigger.dev/sdk` (NOT `@trigger.dev/sdk/v3` — deprecated in v4).
 * RESEARCH.md suggested `@trigger.dev/sdk/build`, but that subpath does not exist
 * in @trigger.dev/sdk@4.4.4 (verified via node_modules/@trigger.dev/sdk/package.json
 * exports map). `defineConfig` is re-exported from the root SDK entry per
 * dist/commonjs/v3/index.d.ts → `export * from "./config.js"`. Rule 1 fix: path corrected.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF!,
  dirs: ['./src/trigger'],
  runtime: 'node',
  logLevel: 'log',
  // Required in @trigger.dev/sdk@4.4.4 TriggerConfig type. 3600s (1h) is the upper
  // bound for Phase 2 hourly ingestion runs; individual tasks can override via
  // `maxDuration` on their `task({...})` definition.
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
