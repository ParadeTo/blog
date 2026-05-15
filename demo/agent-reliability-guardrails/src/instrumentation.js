import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk = null;
let started = false;

export function isLangfuseConfigured(env = process.env) {
  return Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
}

export async function startLangfuseSdk(env = process.env) {
  if (!isLangfuseConfigured(env)) {
    throw new Error('Langfuse requires LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY');
  }

  if (started) {
    return sdk;
  }

  const spanProcessor = new LangfuseSpanProcessor({
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    baseUrl: env.LANGFUSE_BASE_URL ?? env.LANGFUSE_BASEURL,
    environment: env.LANGFUSE_ENVIRONMENT ?? env.LANGFUSE_ENV,
    exportMode: env.LANGFUSE_EXPORT_MODE ?? 'immediate',
  });

  sdk = new NodeSDK({
    spanProcessors: [spanProcessor],
  });

  await sdk.start();
  started = true;

  return sdk;
}

export async function shutdownLangfuseSdk() {
  if (!sdk) {
    started = false;
    return;
  }

  try {
    await sdk.shutdown();
  } finally {
    sdk = null;
    started = false;
  }
}
