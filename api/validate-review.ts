import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_MODEL = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

type ReviewAnswer = { question: string; answer: string };

type GeminiPart = { text: string };

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
    status?: string;
  };
}

interface ReviewValidationResult {
  valid: boolean;
  reason?: string;
  uncertain?: boolean;
  code?: string;
  source?: 'local' | 'gemini';
}

function json(res: VercelResponse, status: number, body: ReviewValidationResult) {
  res.status(status).json(body);
}

function splitReviewSentences(text: string): string[] {
  return text.split(/[.!?。！？\n]+/).map(s => s.trim()).filter(Boolean);
}

function calcAnswerQuality(answers: ReviewAnswer[]): 0 | 1 | 2 {
  const filled = answers.filter(a => a.answer.trim().length > 0);
  const wellAnswered = answers.filter(a => a.answer.trim().length >= 30);
  if (filled.length === 0) return 0;
  if (wellAnswered.length >= 2) return 2;
  return 1;
}

function hasObviousLowSignal(text: string): string | null {
  const compact = text.replace(/\s+/g, '');
  const vaguePhrases = /(재미있었|재밌었|신기했|흥미로웠|좋았|또읽고싶|감동받았|슬펐|어려웠|지루했)/g;
  const vagueCount = text.match(vaguePhrases)?.length ?? 0;
  const suspiciousFragments = ['응 없어', '응없어', '아무거나', '대충'];

  if (
    compact.includes('응없어') ||
    (text.length < 80 && suspiciousFragments.some(fragment => compact.includes(fragment.replace(/\s+/g, ''))))
  ) {
    return '질문에 대한 답이 없거나 장난성 문장이 포함되어 있어요.';
  }

  const sentences = splitReviewSentences(text);
  if (vagueCount > 0 && sentences.length <= 2 && text.length < 45) {
    return '막연한 감상만 있고 책의 구체적인 내용이 부족해요.';
  }

  return null;
}

function hasRepetitivePadding(text: string): boolean {
  const sentences = splitReviewSentences(text);
  if (sentences.length < 3) return false;
  const normalized = sentences.map(s => s.replace(/\s+/g, ''));
  const unique = new Set(normalized);
  return unique.size <= Math.ceil(normalized.length / 2);
}

function getTitleTokens(bookTitle?: string): string[] {
  if (!bookTitle) return [];
  const stopWords = new Set(['의', '편', '권', '책', '시리즈', '대모험']);
  const compoundHints = [
    '조선', '왕조', '기록', '실록', '한국사', '역사', '세계사',
    '인물', '사건', '모험',
  ];

  const tokens = bookTitle
    .split(/[^0-9A-Za-z가-힣]+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2 && !/^\d+$/.test(token));

  const expanded = new Set<string>();
  for (const token of tokens) {
    const variants = [
      token,
      token.replace(/의$/, ''),
      token.replace(/실록$/, ''),
      token.replace(/편$/, ''),
      token.replace(/권$/, ''),
    ];
    for (const variant of variants) {
      if (variant.length >= 2 && !stopWords.has(variant)) expanded.add(variant);
    }
    for (const hint of compoundHints) {
      if (token.includes(hint)) expanded.add(hint);
    }
  }

  return [...expanded];
}

function getReviewEvidence(text: string, bookTitle?: string, answers?: ReviewAnswer[]) {
  const sentences = splitReviewSentences(text);
  const titleTokens = getTitleTokens(bookTitle);
  const hasTitleSignal = titleTokens.some(token => text.includes(token));
  const answerQuality = answers && answers.length > 0 ? calcAnswerQuality(answers) : null;
  const hasGuidedSubstance = answerQuality === 2;
  const concreteMatches = text.match(/장면|인물|사건|내용|이야기|알게|배웠|느꼈|생각|이유|부분|역사|한국사|시대|왕|나라|전쟁|독립|문화|모험|설명|소개|기억|작가|주인공|등장|배경|정보|사실/g) ?? [];
  const reactionMatches = text.match(/재미있|재밌|신기|놀라|인상|좋았|슬펐|감동|어려웠|복잡|흥미|처음 알|기억에 남/g) ?? [];

  return {
    sentences,
    hasTitleSignal,
    hasGuidedSubstance,
    concreteCount: new Set(concreteMatches).size,
    reactionCount: new Set(reactionMatches).size,
  };
}

function hasEnoughReviewEvidence(text: string, bookTitle?: string, answers?: ReviewAnswer[]): boolean {
  if (text.length < 60 || hasRepetitivePadding(text)) return false;
  const evidence = getReviewEvidence(text, bookTitle, answers);
  if (evidence.hasGuidedSubstance) return true;
  if (evidence.sentences.length >= 2 && evidence.hasTitleSignal && evidence.concreteCount >= 1) return true;
  if (text.length >= 90 && evidence.concreteCount >= 2 && evidence.reactionCount >= 1) return true;
  return false;
}

function looksSubstantiveReview(text: string, bookTitle?: string, answers?: ReviewAnswer[]): boolean {
  if (text.length < 90 || hasRepetitivePadding(text)) return false;
  const evidence = getReviewEvidence(text, bookTitle, answers);
  if (evidence.sentences.length < 2) return false;
  return evidence.hasGuidedSubstance || (
    evidence.concreteCount >= 1 &&
    (evidence.hasTitleSignal || text.length >= 120 || evidence.concreteCount >= 2)
  );
}

function geminiEndpoint(apiKey: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function extractGeminiText(data: GeminiResponse): string {
  return data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim() ?? '';
}

function cleanJsonText(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function parseValidationJson(text: string): { valid?: boolean; reason?: string } {
  const cleaned = cleanJsonText(text);
  const objectText = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
  return JSON.parse(objectText) as { valid?: boolean; reason?: string };
}

function classifyGeminiStatus(status: number): { code: string; reason: string } {
  if (status === 401 || status === 403) {
    return { code: 'auth', reason: 'Gemini API 키 권한 또는 제한 설정 문제로 검증을 보류했어요.' };
  }
  if (status === 429) {
    return { code: 'rate_limit', reason: 'Gemini 사용량 또는 속도 제한에 걸려 검증을 보류했어요. 잠시 후 다시 시도해주세요.' };
  }
  if (status >= 500) {
    return { code: 'server', reason: 'Gemini 서버 응답이 불안정해 검증을 보류했어요. 잠시 후 다시 시도해주세요.' };
  }
  return { code: 'api_error', reason: `Gemini API 오류(${status})로 검증을 보류했어요.` };
}

async function generateGeminiText(parts: GeminiPart[], prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('Gemini API 키가 서버에 설정되어 있지 않아요.');
    error.name = 'missing_key';
    throw error;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(geminiEndpoint(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            maxOutputTokens: 128,
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
          },
        }),
      });

      const data = await response.json().catch(() => ({})) as GeminiResponse;
      if (!response.ok) {
        const classified = classifyGeminiStatus(response.status);
        const error = new Error(data.error?.message ?? classified.reason);
        error.name = classified.code;
        throw error;
      }

      const text = extractGeminiText(data);
      if (text) return text;
      const error = new Error(`Gemini가 빈 응답을 반환했어요. finishReason=${data.candidates?.[0]?.finishReason ?? 'unknown'}`);
      error.name = 'empty_response';
      throw error;
    } catch (error) {
      lastError = error;
      const name = error instanceof Error ? error.name : '';
      if (!['rate_limit', 'server', 'empty_response'].includes(name)) break;
      await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error(`Gemini 검증에 실패했어요. prompt=${prompt.slice(0, 20)}`);
}

function buildPrompt(text: string, bookTitle?: string, answers?: ReviewAnswer[]): string {
  const bookCtx = bookTitle ? `책 제목: "${bookTitle}"\n` : '';
  const quality = answers && answers.length > 0 ? calcAnswerQuality(answers) : null;
  const strictExtra = quality === 1 ? `
[추가 확인 기준 — 답변이 짧은 독후감입니다]
- 문장이 초등학생답게 단순하거나 서툴러도 책과 연결된 구체 단서가 있으면 통과하세요.
- 책의 특정 장면·인물·사건·정보 또는 독자 본인의 반응이 전혀 없고,
  책 제목만으로 만들 수 있는 일반적인 칭찬/교훈만 있으면 거절하세요.` : '';

  return `${bookCtx}후기: "${text}"

이 후기가 독서 활동으로 인정할 수 있는지 균형 있게 판단해주세요.
중요: AI의 도움을 받아 문장이 매끄럽거나 정리된 글이라는 이유만으로 거절하지 마세요.
판단 기준은 "누가 썼는가"가 아니라 최종 후기 안에 책과 연결된 내용 또는 생각이 실제로 있는지입니다.

[핵심 요건 — 반드시 있어야 valid: true]
후기에 다음 중 최소 하나가 명시적으로 포함되어 있어야 합니다:
- 책에 나오는 구체적인 내용, 장면, 사건, 등장인물, 배경
- 책을 통해 새롭게 알게 된 사실이나 정보
- 책의 특정 부분이 왜 좋았는지 또는 왜 인상적이었는지에 대한 설명
- 책이 자신의 생각이나 행동에 어떤 영향을 줬는지

단, 위 요건은 반드시 책 제목/질문 답변/후기 안의 단서와 연결되어야 합니다.
책과 연결되지 않는 일반 상식, 갑작스러운 무관한 문장, 앞뒤가 맞지 않는 문장은 요건으로 인정하지 마세요.
긴 글이고 여러 문장에 걸쳐 책의 내용, 역사 정보, 인물, 사건, 느낀 점이 연결되어 있으면 통과시키세요.
${strictExtra}
[반드시 거절 (valid: false)]
- "재미있었다", "신기했다", "흥미로웠다", "또 읽고 싶다" 등 막연한 감정/평가만 나열한 경우
  → 설령 이런 문장이 여러 개여도 책의 구체적 내용이 없으면 거절
- "응 없어", "몰라", "없어요"처럼 질문 답변을 회피하는 문장이 포함된 경우
- 책과 무관한 일반 상식이나 뜬금없는 문장으로 30자를 채운 경우
- 해시태그(#), 이모지, 광고성 문구가 포함된 경우
- 책 제목이나 저자 이름만 언급하고 실제 내용이 없는 경우
- 의미 없는 글자 반복이나 장난성 내용
- 30자를 채우려고 같은 말을 반복한 경우

다음 JSON 형식으로만 응답 (다른 텍스트 없이):
통과: {"valid": true}
거절: {"valid": false, "reason": "거절 이유 (한 문장, 한국어)"}`;
}

function describeValidationError(error: unknown): ReviewValidationResult {
  if (error instanceof Error) {
    if (error.name === 'missing_key') {
      return { valid: false, uncertain: true, code: 'missing_key', reason: '서버에 Gemini API 키가 설정되어 있지 않아 검증을 보류했어요.' };
    }
    if (error.name === 'auth' || error.name === 'rate_limit' || error.name === 'server' || error.name === 'api_error' || error.name === 'empty_response') {
      return { valid: false, uncertain: true, code: error.name, reason: `${error.message} 후기 내용이 부족하다는 뜻은 아니에요.` };
    }
    if (error.name === 'SyntaxError') {
      return { valid: false, uncertain: true, code: 'json_parse', reason: 'Gemini가 판정 형식을 깨뜨려 검증을 보류했어요. 후기 내용이 부족하다는 뜻은 아니에요.' };
    }
  }
  return { valid: false, uncertain: true, code: 'unknown', reason: 'AI 검증 중 알 수 없는 오류가 발생해 보류했어요. 후기 내용이 부족하다는 뜻은 아니에요.' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { valid: false, reason: 'POST 요청만 사용할 수 있어요.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) as Record<string, unknown> : req.body as Record<string, unknown>;
  const text = String(body.review ?? '').trim();
  const bookTitle = typeof body.bookTitle === 'string' ? body.bookTitle : undefined;
  const answers = Array.isArray(body.answers) ? body.answers as ReviewAnswer[] : undefined;

  if (text.length < 30) return json(res, 200, { valid: false, reason: '후기는 30자 이상 작성해주세요.', source: 'local' });

  const lowSignalReason = hasObviousLowSignal(text);
  if (lowSignalReason) return json(res, 200, { valid: false, reason: lowSignalReason, source: 'local' });

  const quality = answers && answers.length > 0 ? calcAnswerQuality(answers) : null;
  if (quality === 0) {
    return json(res, 200, { valid: false, reason: '질문에 직접 답해야 후기로 인정돼요. 나만의 생각을 질문에 담아주세요!', source: 'local' });
  }

  if (looksSubstantiveReview(text, bookTitle, answers)) return json(res, 200, { valid: true, source: 'local' });

  const prompt = buildPrompt(text, bookTitle, answers);
  try {
    const raw = await generateGeminiText([{ text: prompt }], prompt);
    const parsed = parseValidationJson(raw);
    if (parsed.valid === true) return json(res, 200, { valid: true, source: 'gemini' });
    return json(res, 200, {
      valid: false,
      reason: parsed.reason ?? '책의 구체적인 내용과 나의 생각이 충분히 드러나야 해요.',
      source: 'gemini',
    });
  } catch (error) {
    if (hasEnoughReviewEvidence(text, bookTitle, answers)) return json(res, 200, { valid: true, source: 'local' });
    return json(res, 200, describeValidationError(error));
  }
}
