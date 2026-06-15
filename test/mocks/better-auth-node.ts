/** Test stub for `better-auth/node`. */
import type { IncomingHttpHeaders } from 'node:http';

export function toNodeHandler() {
  return (_req: unknown, res: { statusCode: number; end: () => void }) => {
    res.statusCode = 404;
    res.end();
  };
}

export function fromNodeHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  return headers;
}
