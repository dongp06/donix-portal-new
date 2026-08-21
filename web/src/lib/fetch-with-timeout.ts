import {
  decryptTransportResponse,
  renewAccessToken,
  resetTransportNegotiation,
  secureRequest,
} from './security-client';

function retryableAfterRenewal(
  input: RequestInfo | URL,
  init: RequestInit,
): boolean {
  const url = new URL(
    input instanceof Request ? input.url : String(input),
    window.location.href,
  );
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
    return false;
  }
  if (
    new Set([
      '/api/auth/access',
      '/api/auth/renew',
      '/api/auth/renew/challenge',
      '/api/auth/logout',
      '/api/bootstrap',
      '/api/auth/onboarding',
      '/api/auth/become-seller',
      '/api/transport/config',
    ]).has(url.pathname)
  ) {
    return false;
  }
  if (input instanceof Request && init.body === undefined) return false;
  const body = init.body;
  return (
    body === undefined ||
    body === null ||
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob
  );
}

function retryableAfterDatabaseFailure(
  input: RequestInfo | URL,
  init: RequestInit,
): boolean {
  const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) return false;
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  return url.origin === window.location.origin && url.pathname.startsWith('/api/');
}

/**
 * Abort browser requests that can otherwise leave an upload/action spinner
 * running forever when the proxy or API stops responding.
 *
 * Same-origin API mutations are prepared by the TSP client before they are
 * sent. The security client prepares every same-origin /api method, including
 * GET responses and auth/control-plane calls. FormData uploads keep their
 * multipart body for Fastify multipart parsing while still carrying transport metadata,
 * request integrity, and an encrypted response.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 60_000,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let renewalAttempted = false;
  let transportRecoveryAttempts = 0;
  let negotiationRecoveryAttempts = 0;
  let databaseRecoveryAttempted = false;
  try {
    while (true) {
      try {
        const prepared = await secureRequest(input, init);
        const response = await fetch(prepared.input, {
          ...prepared.init,
          signal: controller.signal,
        });
        const preparedHeaders = new Headers(prepared.init.headers);
        const sequenceValue = preparedHeaders.get('X-TB-Transport-Sequence');
        const sequence = sequenceValue && /^\d+$/.test(sequenceValue)
          ? Number(sequenceValue)
          : undefined;
        const decoded = await decryptTransportResponse(response, {
          requestId: preparedHeaders.get('X-TB-Transport-Request') ?? undefined,
          sequence,
        });
        if (transportRecoveryAttempts < 2 && (decoded.status === 400 || decoded.status === 409 || decoded.status === 426)) {
          const errorBody = await decoded.clone().json().catch(() => null) as { code?: unknown } | null;
          if (
            errorBody?.code === 'TRANSPORT_REQUIRED' ||
            errorBody?.code === 'TRANSPORT_NEGOTIATION_REQUIRED' ||
            errorBody?.code === 'TRANSPORT_KEY_ROTATED' ||
            errorBody?.code === 'TRANSPORT_SEQUENCE_REPLAYED' ||
            errorBody?.code === 'TRANSPORT_REPLAYED'
          ) {
            transportRecoveryAttempts += 1;
            await resetTransportNegotiation();
            await new Promise<void>((resolve) => window.setTimeout(resolve, 100 * transportRecoveryAttempts));
            continue;
          }
        }
        if (
          !databaseRecoveryAttempted &&
          [502, 503, 504].includes(decoded.status) &&
          retryableAfterDatabaseFailure(input, init)
        ) {
          databaseRecoveryAttempted = true;
          await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
          continue;
        }
        if (
          !renewalAttempted &&
          decoded.status === 401 &&
          retryableAfterRenewal(input, init)
        ) {
          renewalAttempted = true;
          if (await renewAccessToken()) continue;
        }
        return decoded;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const negotiationFailure = /transport (?:key )?negotiation|encrypted api transport/i.test(message);
        if (negotiationRecoveryAttempts < 2 && negotiationFailure) {
          negotiationRecoveryAttempts += 1;
          await resetTransportNegotiation();
          await new Promise<void>((resolve) => window.setTimeout(resolve, 100 * negotiationRecoveryAttempts));
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    if (timedOut) throw new Error('Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại.');
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}
