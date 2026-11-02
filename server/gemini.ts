export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export class AiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 503) {
    super(message);
    this.name = code;
    this.code = code;
    this.status = status;
  }
}

export async function generateText(
  parts: GeminiPart[],
  options: { maxOutputTokens?: number; temperature?: number; json?: boolean } = {},
): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
  if (!key) throw new AiError('missing_key', 'AI 연결 설정이 필요해요. 관리자에게 알려주세요.');

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            maxOutputTokens: options.maxOutputTokens ?? 800,
            temperature: options.temperature ?? 0.3,
            ...(model.startsWith('gemini-2.5-flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            ...(options.json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      });
      if (!response.ok) {
        if (response.status === 429) throw new AiError('rate_limit', 'AI 사용량이 많아요. 잠시 후 다시 시도해주세요.', 429);
        if (response.status >= 500) throw new AiError('server', 'AI 연결이 잠시 불안정해요. 다시 시도해주세요.');
        throw new AiError('configuration', 'AI 연결 설정을 확인해야 해요. 관리자에게 알려주세요.');
      }
      const data = await response.json() as { promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string; content?: { parts?: { thought?: boolean; text?: string }[] } }[] };
      const candidate = data.candidates?.[0];
      if (data.promptFeedback?.blockReason || ['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT'].includes(candidate?.finishReason ?? '')) {
        throw new AiError('blocked', 'AI가 이 내용으로 글을 만들지 못했어요. 직접 작성하거나 답변을 바꿔주세요.', 422);
      }
      if (candidate?.finishReason === 'MAX_TOKENS') throw new AiError('truncated', 'AI가 글을 끝까지 작성하지 못했어요. 다시 시도해주세요.');
      const text = candidate?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought)
        .map((p: { text?: string }) => p.text ?? '').join('').trim();
      if (!text) throw new AiError('empty_response', 'AI 응답이 비어 있어요. 다시 시도해주세요.');
      return text;
    } catch (error) {
      const failure = error instanceof AiError ? error
        : new AiError('network', 'AI 응답을 기다리다 연결이 끊겼어요. 다시 시도해주세요.');
      if (attempt === 1 || !['rate_limit', 'server', 'network', 'empty_response', 'truncated'].includes(failure.code)) throw failure;
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }
  throw new AiError('server', 'AI 연결에 실패했어요.');
}
