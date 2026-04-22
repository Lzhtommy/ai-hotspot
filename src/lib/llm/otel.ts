/**
 * Langfuse OTel bootstrap — Phase 3 LLM-13.
 *
 * Wires Anthropic SDK → OpenInference instrumentation → Langfuse span
 * processor → OTel NodeSDK. Captures request/response/usage (including
 * cache_read/cache_write tokens) on every Anthropic call automatically.
 *
 * Pitfall 6 (RESEARCH.md): Trigger.dev recycles workers aggressively;
 * OTel spans sit in batch queue until flushed. `flushOtel()` MUST be
 * called in the task's finally{} block before worker recycle.
 *
 * startOtel() is idempotent (guarded by a module-level `started` flag) —
 * safe to call at module load in every trigger task file.
 *
 * Threat T-03-04: AnthropicInstrumentation captures request/response content
 * only — API keys live in SDK client headers, not in span content. Langfuse
 * project is auth-gated. No `sk-ant-` prefix appears in span payloads.
 *
 * Ordering requirement: manuallyInstrument(Anthropic) is called at module load
 * time below, BEFORE any Anthropic client instantiation in the same process.
 * Trigger.dev workers import this file via `startOtel()` at the top of
 * process-item.ts — which runs before `@/lib/llm/client.ts` is evaluated.
 * Do NOT hoist the client.ts import above the otel.ts import in trigger files.
 *
 * Consumed by:
 *   - src/trigger/process-item.ts (Plan 04) — startOtel at module load, flushOtel in finally
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { AnthropicInstrumentation } from '@arizeai/openinference-instrumentation-anthropic';
import Anthropic from '@anthropic-ai/sdk';

// Patch the Anthropic module before any client is instantiated.
// AnthropicInstrumentation.manuallyInstrument wraps the Messages prototype
// so all subsequent `new Anthropic()` instances emit OTel spans automatically.
const instrumentation = new AnthropicInstrumentation();
instrumentation.manuallyInstrument(Anthropic);

const otel = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
  instrumentations: [instrumentation],
});

/** @internal — exported ONLY for tests so they can reset the idempotence flag between cases. */
export function __resetStartedForTest(): void {
  started = false;
}

export interface OtelSdkLike {
  start(): void;
  shutdown(): Promise<void>;
}

let started = false;

/**
 * Start the OTel SDK. Idempotent — safe to call multiple times; only the
 * first call has any effect. Call at module load time in every Trigger.dev
 * task file that invokes the Anthropic API.
 */
export function startOtel(sdk: OtelSdkLike = otel): void {
  if (started) return;
  sdk.start();
  started = true;
}

/**
 * Flush pending OTel spans to Langfuse and shut down the SDK. Must be
 * awaited in the `finally {}` block of every Trigger.dev task run function
 * (Pitfall 6 — worker process may be recycled before batch-exported spans
 * reach Langfuse if this is not called).
 *
 * Resets `started` after shutdown so that warm Trigger.dev workers that
 * reuse the same process across multiple task invocations can re-start the
 * SDK on the next run. Without this reset, `startOtel()` would silently
 * no-op on the second invocation (started=true) while the SDK is shut down,
 * causing all subsequent Anthropic calls to emit no spans to Langfuse.
 */
export async function flushOtel(sdk: OtelSdkLike = otel): Promise<void> {
  await sdk.shutdown();
  started = false; // allow next warm-worker invocation to re-start the SDK
}
