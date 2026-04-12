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

// localStorage helpers for persisting rejection reasons across page loads
const rejectionKey = (bookId: string) => `review-rejection-${bookId}`;
export function saveRejectionReason(bookId: string, reason: string) {
  localStorage.setItem(rejectionKey(bookId), reason);
}
export function clearRejectionReason(bookId: string) {
  localStorage.removeItem(rejectionKey(bookId));
}
export function getRejectionReason(bookId: string): string | null {
  return localStorage.getItem(rejectionKey(bookId));
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

이 후기가 아래 기준을 모두 충족하는지 매우 엄격하게 판단해주세요.

[핵심 요건 — 반드시 있어야 valid: true]
후기에 다음 중 최소 하나가 명시적으로 포함되어 있어야 합니다:
- 책에 나오는 구체적인 내용, 장면, 사건, 등장인물, 배경
- 책을 통해 새롭게 알게 된 사실이나 정보
- 책의 특정 부분이 왜 좋았는지 또는 왜 인상적이었는지에 대한 설명
- 책이 자신의 생각이나 행동에 어떤 영향을 줬는지

[반드시 거절 (valid: false)]
- "재미있었다", "신기했다", "흥미로웠다", "또 읽고 싶다" 등 막연한 감정/평가만 나열한 경우
  → 설령 이런 문장이 여러 개여도 책의 구체적 내용이 없으면 거절
- 해시태그(#), 이모지, 광고성 문구가 포함된 경우
- 책 제목이나 저자 이름만 언급하고 실제 내용이 없는 경우
- 의미 없는 글자 반복이나 장난성 내용
- 30자를 채우려고 같은 말을 반복한 경우

다음 JSON 형식으로만 응답 (다른 텍스트 없이):
{"valid": false, "reason": "판단 이유 (한 문장, 한국어)"}`;

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

export interface BookRecognitionResult {
  title: string;
  author: string;
}

/**
 * 책 표지 이미지를 Claude Vision으로 분석해 제목과 저자를 추출
 */
export async function recognizeBookFromImage(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
): Promise<BookRecognitionResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');

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
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 },
          },
          {
            type: 'text',
            text: '이 이미지는 책의 표지입니다. 표지에 적힌 책 제목과 저자 이름을 표지에 쓰인 언어 그대로 읽어주세요. 절대 번역하지 마세요. 한국어로 쓰여 있으면 한국어로, 영어로 쓰여 있으면 영어로 그대로 입력하세요.\n다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):\n{"title": "표지에 쓰인 제목 원문", "author": "표지에 쓰인 저자명 원문"}\n확인할 수 없는 항목은 빈 문자열("")로 두세요.',
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `API 오류 (${response.status})`);
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content.find(b => b.type === 'text')?.text ?? '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(cleaned) as { title?: string; author?: string };
  return { title: parsed.title ?? '', author: parsed.author ?? '' };
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
