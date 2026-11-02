import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AiError, generateText, type GeminiPart } from '../server/gemini.ts';
import { readBody, requireUser } from '../server/aiRequest.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 사용할 수 있어요.' });
  try {
    const body = readBody(req);
    if (!Array.isArray(body.parts) || body.parts.length < 1 || body.parts.length > 4) throw new AiError('invalid_request', '요청 내용을 확인해주세요.', 400);
    let size = 0;
    for (const part of body.parts) {
      if (!part || typeof part !== 'object') throw new AiError('invalid_request', '입력 형식을 확인해주세요.', 400);
      if (typeof part.text === 'string' && part.text.length <= 20_000) size += part.text.length;
      else if (part.inlineData && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(part.inlineData.mimeType)
        && typeof part.inlineData.data === 'string' && /^[A-Za-z0-9+/=]+$/.test(part.inlineData.data)) size += part.inlineData.data.length;
      else throw new AiError('invalid_request', '입력 형식을 확인해주세요.', 400);
    }
    if (size > 3_000_000) throw new AiError('too_large', '사진이나 글의 크기를 줄여주세요.', 413);
    await requireUser(req);
    const options = body.options as Record<string, unknown> | undefined;
    const text = await generateText(body.parts as GeminiPart[], {
      maxOutputTokens: typeof options?.maxOutputTokens === 'number' && Number.isFinite(options.maxOutputTokens)
        ? Math.max(128, Math.min(1200, Math.round(options.maxOutputTokens))) : 800,
      temperature: typeof options?.temperature === 'number' && Number.isFinite(options.temperature)
        ? Math.max(0, Math.min(1, options.temperature)) : 0.3,
      json: options?.json === true,
    });
    return res.status(200).json({ text });
  } catch (error) {
    const failure = error instanceof AiError ? error : new AiError('server', 'AI 요청을 처리하지 못했어요. 다시 시도해주세요.');
    return res.status(failure.status).json({ error: failure.message, code: failure.code });
  }
}
