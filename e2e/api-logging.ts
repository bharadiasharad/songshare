import { APIRequestContext, APIResponse, test } from '@playwright/test';

/**
 * Request/response logging for the Playwright API suite.
 *
 * `withReportLogging` wraps an APIRequestContext so every HTTP call it makes is
 * attached to the current test in the HTML report (`npm run test:api:report`) — the
 * method, URL, headers and body of the request, and the status, headers and body of
 * the response. Sensitive headers (cookie/set-cookie/authorization) are masked so the
 * report is safe to share, and binary/oversized bodies are summarised, not dumped.
 *
 * The wrapper returns the original APIResponse untouched, so existing assertions
 * (`.status()`, `.json()`, `.ok()`, …) keep working — only the context creation changes.
 */

const SENSITIVE_HEADERS = new Set(['cookie', 'set-cookie', 'authorization']);
const LOGGED_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head']);
const MAX_BODY_CHARS = 4000;

/** The subset of Playwright request options we read for logging. */
interface CallOptions {
  headers?: Record<string, string>;
  data?: unknown;
  form?: Record<string, unknown>;
  multipart?: Record<string, unknown>;
  params?: Record<string, string | number | boolean>;
}

function maskHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      SENSITIVE_HEADERS.has(key.toLowerCase()) ? '«redacted»' : value,
    ]),
  );
}

function truncate(text: string): string {
  return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}… «truncated»` : text;
}

function describeRequestBody(options?: CallOptions): string {
  if (!options) return '(none)';
  if (options.data !== undefined) return truncate(JSON.stringify(options.data, null, 2));
  if (options.form) return truncate(`form ${JSON.stringify(options.form, null, 2)}`);
  if (options.multipart) {
    // Summarise file parts (name/mime/size) instead of dumping raw bytes.
    const parts: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(options.multipart)) {
      const file = value as { name?: string; mimeType?: string; buffer?: { length: number } };
      parts[field] =
        file && typeof file === 'object' && file.buffer
          ? `«file ${file.name ?? ''} (${file.mimeType ?? 'application/octet-stream'}, ${file.buffer.length} bytes)»`
          : value;
    }
    return `multipart ${JSON.stringify(parts, null, 2)}`;
  }
  return '(none)';
}

async function describeResponseBody(response: APIResponse): Promise<string> {
  try {
    const contentType = response.headers()['content-type'] ?? '';
    if (!/json|text|xml|urlencoded/i.test(contentType)) {
      const buffer = await response.body();
      return `«binary ${buffer.length} bytes${contentType ? `, ${contentType}` : ''}»`;
    }
    return truncate(await response.text());
  } catch {
    return '«body unavailable»';
  }
}

function shortPath(url: string): string {
  return url.split('?')[0];
}

/** Attach one request/response exchange to the current test (best-effort). */
async function attachExchange(
  contextHeaders: Record<string, string>,
  method: string,
  url: string,
  options: CallOptions | undefined,
  response: APIResponse,
): Promise<void> {
  let info: ReturnType<typeof test.info>;
  try {
    info = test.info();
  } catch {
    return; // called outside a running test (e.g. global setup) — nothing to attach to
  }

  const requestHeaders = maskHeaders({ ...contextHeaders, ...(options?.headers ?? {}) });
  const report = [
    `▶ REQUEST   ${method} ${response.url()}`,
    `  headers:  ${JSON.stringify(requestHeaders)}`,
    `            (session cookie auto-attached by the context — redacted)`,
    `  body:     ${describeRequestBody(options)}`,
    ``,
    `◀ RESPONSE  ${response.status()} ${response.statusText()}`,
    `  headers:  ${JSON.stringify(maskHeaders(response.headers()))}`,
    `  body:     ${await describeResponseBody(response)}`,
    ``,
  ].join('\n');

  await info.attach(`${method} ${shortPath(url)} → ${response.status()}`, {
    body: report,
    contentType: 'text/plain',
  });
}

/**
 * Wrap an APIRequestContext so each HTTP call is logged to the report. `contextHeaders`
 * are the headers the context was created with (Accept/Origin), included for an accurate
 * picture of the outgoing request.
 */
export function withReportLogging(
  ctx: APIRequestContext,
  contextHeaders: Record<string, string>,
): APIRequestContext {
  return new Proxy(ctx, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof prop === 'string' && LOGGED_METHODS.has(prop) && typeof value === 'function') {
        const call = value as (url: string, options?: CallOptions) => Promise<APIResponse>;
        return async (url: string, options?: CallOptions): Promise<APIResponse> => {
          const response = await call.call(target, url, options);
          await attachExchange(contextHeaders, prop.toUpperCase(), url, options, response);
          return response;
        };
      }
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}
