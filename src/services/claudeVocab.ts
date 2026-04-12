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

이 후기가 아래 기준을 모두 충족하는지 엄격하게 판단해주세요.

[통과 기준 — 모두 충족해야 valid: true]
1. 완전한 문장 구조를 갖추고 있다
2. 책의 내용, 등장인물, 사건, 주제, 교훈, 또는 읽으면서 느낀 구체적인 감정이나 생각을 언급하고 있다
3. 단순히 "재미있었다", "좋았다", "별로였다" 같은 짧은 평가만 반복하거나 나열하지 않는다
4. 의미 없는 단어 반복, 키보드 난타, 낙서성 내용이 아니다
5. 읽은 사람이 실제로 책을 읽고 생각한 흔적이 느껴진다

[반드시 거절 (valid: false)]
- 감탄사, 칭찬 단어, 단순 형용사만 나열한 경우 (예: "너무너무 재미있고 좋았어요 최고예요")
- 책과 무관한 일상 이야기나 다른 주제
- 의미 없는 글자 반복이나 장난성 내용
- 30자를 채우려고 같은 말을 반복한 경우

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
