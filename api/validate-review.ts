import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readBody, requireUser } from '../server/aiRequest.ts';
import { validateReviewContent, type ReviewAnswer, type ReviewValidationResult } from '../server/reviewValidation.ts';

function json(res: VercelResponse, status: number, body: ReviewValidationResult) {
  res.status(status).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { valid: false, reason: 'POST 요청만 사용할 수 있어요.' });

  let body: Record<string, unknown>;
  try {
    body = readBody(req);
    if (typeof body.review !== 'string' || body.review.length > 20_000
      || (body.bookTitle !== undefined && (typeof body.bookTitle !== 'string' || body.bookTitle.length > 500))
      || (body.answers !== undefined && (!Array.isArray(body.answers) || body.answers.length > 5 || body.answers.some(a =>
        !a || typeof a.question !== 'string' || typeof a.answer !== 'string' || a.question.length > 1000 || a.answer.length > 5000)))) {
      return json(res, 400, { valid: false, uncertain: true, reason: '요청 내용을 확인해주세요.' });
    }
    await requireUser(req);
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 503;
    return json(res, status, { valid: false, uncertain: true, reason: error instanceof Error ? error.message : '로그인 상태를 확인하지 못했어요.' });
  }
  const text = (body.review as string).trim();
  const bookTitle = body.bookTitle as string | undefined;
  const answers = body.answers as ReviewAnswer[] | undefined;

  return json(res, 200, await validateReviewContent(text, bookTitle, answers));
}
