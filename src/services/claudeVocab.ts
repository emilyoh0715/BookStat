const API_KEY_STORAGE = 'book-recorder-api-key';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
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
