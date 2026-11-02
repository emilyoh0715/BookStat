import type { Plugin } from 'vite';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import generate from '../api/generate-text.ts';
import validate from '../api/validate-review.ts';
import bookCovers from '../api/book-covers.ts';

// Serve the same handlers locally; no browser API keys or production proxy.
export function devApi(): Plugin {
  return {
    name: 'bookstat-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        const handler = path === '/api/generate-text' ? generate
          : path === '/api/validate-review' ? validate
          : path === '/api/book-covers' ? bookCovers : null;
        if (!handler) return next();
        const chunks: Buffer[] = [];
        let size = 0;
        try {
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 3_100_000) { res.statusCode = 413; res.end(); return; }
            chunks.push(Buffer.from(chunk));
          }
          const query = Object.fromEntries(new URL(req.url ?? '/', 'http://localhost').searchParams);
          const request = Object.assign(req, { body: Buffer.concat(chunks).toString('utf8'), query }) as VercelRequest;
          const response = Object.assign(res, {
            status(code: number) { res.statusCode = code; return response; },
            json(body: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return response; },
          }) as VercelResponse;
          await handler(request, response);
        } catch {
          if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); }
          res.end(JSON.stringify({ error: '요청을 처리하지 못했어요.' }));
        }
      });
    },
  };
}
