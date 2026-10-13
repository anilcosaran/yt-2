/**
 * The Spark context meter switch. `SPARK_CONTEXT_METER_ENABLED=true` on the UI pod puts the context ring next to the Spark
 * side chat's send button (the share of the context window the conversation's newest assistant call used; a click opens
 * the details card) in place of the spend chip above the composer; the card also carries the job's spend. Off (the code
 * default; any value but exactly `true`) the side chat keeps the spend chip exactly as before.
 *
 * Read on the server in the force-dynamic editor page and passed down as a prop, so flipping it needs only a pod restart.
 * The numbers are the gateway's (`GET /api/v1/assistant-context/...`), recorded while its `ASSISTANT_CONTEXT_BUDGET_ENABLED`
 * runs. Nothing here reads or writes product data.
 */
export const SPARK_CONTEXT_METER_SWITCH = 'SPARK_CONTEXT_METER_ENABLED'

export function sparkContextMeterEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[SPARK_CONTEXT_METER_SWITCH] === 'true'
}
