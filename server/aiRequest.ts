import type { VercelRequest } from '@vercel/node';
import { AiError } from './gemini.ts';

export function readBody(req: VercelRequest): Record<string, unknown> {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new AiError('invalid_request', '요청 내용을 확인해주세요.', 400);
  }
}

export async function requireUser(req: VercelRequest): Promise<void> {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) throw new AiError('unauthorized', '로그인 후 다시 시도해주세요.', 401);
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY;
  if (!url || !key) throw new AiError('configuration', '로그인 연결 설정을 확인해주세요.');
  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: authorization },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new AiError('auth_unavailable', '로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  if (response.status === 401 || response.status === 403) throw new AiError('unauthorized', '로그인이 만료되었어요. 다시 로그인해주세요.', 401);
  if (!response.ok) throw new AiError('auth_unavailable', '로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요.');
}
