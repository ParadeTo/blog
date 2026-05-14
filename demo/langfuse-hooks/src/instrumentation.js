import { NodeSDK } from '@opentelemetry/sdk-node'
import { LangfuseSpanProcessor } from '@langfuse/otel'

let sdk = null
let started = false

export function isLangfuseConfigured() {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY)
}

export function startLangfuseSdk() {
  if (!isLangfuseConfigured()) return false
  if (started) return true

  sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
        environment: process.env.LANGFUSE_TRACING_ENVIRONMENT || 'local',
        exportMode: 'immediate',
      }),
    ],
  })

  sdk.start()
  started = true
  return true
}

export async function shutdownLangfuseSdk() {
  if (!sdk || !started) return
  await sdk.shutdown()
  started = false
  sdk = null
}
