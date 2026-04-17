import { task } from '@trigger.dev/sdk';

/**
 * Minimal task that proves the Trigger.dev worker is reachable and executing.
 *
 * Satisfies ROADMAP Phase 1 Success Criterion #3:
 * "A Trigger.dev task can be triggered manually and succeeds without timeout errors."
 *
 * Consumed by:
 *   - /api/health (Plan 04) — type-only import to prove the task registry compiles
 *   - Trigger.dev dashboard manual-run button (Plan 03 Task 2 checkpoint)
 *
 * Phase 2 replaces / augments this with the real hourly-ingestion scheduled task.
 */
export const healthProbe = task({
  id: 'health-probe',
  run: async () => {
    return { ok: true, timestamp: new Date().toISOString() };
  },
});
