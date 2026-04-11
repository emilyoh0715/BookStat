const API_KEY_STORAGE = 'book-recorder-api-key';
const ALADIN_KEY_STORAGE = 'book-recorder-aladin-key';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || import.meta.env.VITE_ANTHROPIC_API_KEY || '';
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function getAladinKey(): string {
  return localStorage.getItem(ALADIN_KEY_STORAGE) ?? import.meta.env.VITE_ALADIN_API_KEY ?? '';
}

export function setAladinKey(key: string) {
  localStorage.setItem(ALADIN_KEY_STORAGE, key);
}

export interface ReviewValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a book review:
 *  - Must be ≥ 30 characters
 *  - If a Claude API key is set, AI checks for complete sentence + book-relevance + no spam
 *  - Falls back to length-only check when no API key
 */
export async function validateReview(review: string, bookTitle?: string): Promise<ReviewValidationResult> {
  const text = review.trim();
  if (text.length < 30) {
    return { valid: false, reason: '후기는 30자 이상 작성해주세요.' };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    // No API key — length check passes
    return { valid: true };
  }

  const bookCtx = bookTitle ? `책 제목: "${bookTitle}"\n` : '';
  const prompt = `${bookCtx}후기: "${text}"

위 후기가 다음 기준을 모두 만족하는지 판단해주세요:
1. 완전한 문장으로 이루어져 있는가
2. 책과 관련된 내용인가 (감상, 느낀 점, 추천 여부, 내용 언급 등)
3. 의미 없는 반복이나 스팸이 아닌가

다음 JSON 형식으로만 응답 (다른 텍스트 없이):
{"valid": true, "reason": "판단 이유 (한 문장, 한국어)"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 128,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return { valid: true }; // fail open on API error

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find(b => b.type === 'text')?.text ?? '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned) as { valid?: boolean; reason?: string };
    return { valid: parsed.valid ?? true, reason: parsed.reason };
  } catch {
    return { valid: true }; // fail open on parse/network error
  }
}

export interface VocabLookupResult {
  meaning: string;
  example?: string;
}

export async function lookupVocab(
  word: string,
  language: 'korean' | 'english' | 'other',
  bookTitle?: string,
  sentence?: string
): Promise<VocabLookupResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');

  const langHint =
    language === 'korean'
      ? '한국어 단어입니다. 뜻풀이는 한국어로 작성해주세요.'
      : language === 'english'
      ? '영어 단어/표현입니다. 뜻풀이는 한국어로 작성해주세요.'
      : '뜻풀이는 한국어로 작성해주세요.';

  const bookCtx = bookTitle ? `\n책: "${bookTitle}"` : '';
  const sentenceCtx = sentence ? `\n이 단어가 사용된 문장: "${sentence}"` : '';

  const prompt = `단어/표현: "${word}"${bookCtx}${sentenceCtx}
${langHint}${sentence ? ' 위 문장의 문맥을 참고해서 이 단어의 정확한 뜻을 찾아주세요.' : ''}

다음 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
{"meaning": "간결한 뜻풀이 (1~2문장)", "example": "짧은 예문 (선택사항)"}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `API 오류 (${response.status})`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content.find(b => b.type === 'text')?.text ?? '';

  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned) as { meaning?: string; example?: string };
    return {
      meaning: parsed.meaning ?? cleaned,
      example: parsed.example,
    };
  } catch {
    return { meaning: text };
  }
}
