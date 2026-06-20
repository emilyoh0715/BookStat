const API_KEY_STORAGE = 'book-recorder-gemini-api-key';
const ALADIN_KEY_STORAGE = 'book-recorder-aladin-key';
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || import.meta.env.VITE_GEMINI_API_KEY || '';
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

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

function geminiEndpoint(apiKey: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function extractGeminiText(data: GeminiResponse): string {
  return data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim() ?? '';
}

async function generateGeminiText(
  parts: GeminiPart[],
  options: { maxOutputTokens?: number; temperature?: number; json?: boolean } = {},
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');

  const response = await fetch(geminiEndpoint(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: options.maxOutputTokens,
        temperature: options.temperature,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: options.json ? 'application/json' : undefined,
      },
    }),
  });

  const data = await response.json().catch(() => ({})) as GeminiResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `API 오류 (${response.status})`);
  }

  return extractGeminiText(data);
}

function cleanJsonText(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

export interface ReviewValidationResult {
  valid: boolean;
  reason?: string;
  uncertain?: boolean;
}

export type ReviewAnswer = { question: string; answer: string };

/** 0=답변 없음, 1=일부 또는 짧은 답변, 2=두 질문 모두 충분히 답변(≥30자) */
export function calcAnswerQuality(answers: ReviewAnswer[]): 0 | 1 | 2 {
  const filled = answers.filter(a => a.answer.trim().length > 0);
  const wellAnswered = answers.filter(a => a.answer.trim().length >= 30);
  if (filled.length === 0) return 0;
  if (wellAnswered.length >= 2) return 2;
  return 1;
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

function hasObviousLowSignal(text: string): string | null {
  const compact = text.replace(/\s+/g, '');
  const vaguePhrases = /(재미있었|재밌었|신기했|흥미로웠|좋았|또읽고싶|감동받았|슬펐|어려웠|지루했)/g;
  const vagueCount = text.match(vaguePhrases)?.length ?? 0;
  const suspiciousFragments = [
    '응 없어',
    '응없어',
    '아무거나',
    '대충',
  ];

  if (
    compact.includes('응없어') ||
    (text.length < 80 && suspiciousFragments.some(fragment => compact.includes(fragment.replace(/\s+/g, ''))))
  ) {
    return '질문에 대한 답이 없거나 장난성 문장이 포함되어 있어요.';
  }

  const sentences = text.split(/[.!?。！？\n]+/).map(s => s.trim()).filter(Boolean);
  if (vagueCount > 0 && sentences.length <= 2 && text.length < 45) {
    return '막연한 감상만 있고 책의 구체적인 내용이 부족해요.';
  }

  return null;
}

function hasRepetitivePadding(text: string): boolean {
  const sentences = text.split(/[.!?。！？\n]+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length < 3) return false;
  const normalized = sentences.map(s => s.replace(/\s+/g, ''));
  const unique = new Set(normalized);
  return unique.size <= Math.ceil(normalized.length / 2);
}

function splitReviewSentences(text: string): string[] {
  return text.split(/[.!?。！？\n]+/).map(s => s.trim()).filter(Boolean);
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

function describeValidationError(error: unknown): string {
  const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
  return `AI가 판정 결과를 돌려주지 못해 보류되었어요${detail}. 후기 내용이 부족하다는 뜻은 아니며, 잠시 후 다시 검증해주세요.`;
}

function parseValidationJson(text: string): { valid?: boolean; reason?: string } {
  const cleaned = cleanJsonText(text);
  const objectText = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
  return JSON.parse(objectText) as { valid?: boolean; reason?: string };
}

async function validateReviewOnServer(
  review: string,
  bookTitle?: string,
  answers?: ReviewAnswer[],
): Promise<ReviewValidationResult> {
  const response = await fetch('/api/validate-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review, bookTitle, answers }),
  });
  const data = await response.json().catch(() => ({})) as ReviewValidationResult;
  if (!response.ok) {
    throw new Error(data.reason ?? `서버 검증 API 오류 (${response.status})`);
  }
  return data;
}

function canUseDirectGeminiFallback(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

/**
 * Validate a book review:
 *  - Must be ≥ 30 characters
 *  - If answers provided (guided flow): quality 0 → auto-fail, quality 1 → strict AI check
 *  - If a Gemini API key is set, AI checks for personal content + book-relevance + no spam
 *  - Returns uncertain when AI validation cannot run, so bulk revalidation does not revoke old approvals
 */
export async function validateReview(
  review: string,
  bookTitle?: string,
  answers?: ReviewAnswer[],
): Promise<ReviewValidationResult> {
  const text = review.trim();
  if (text.length < 30) {
    return { valid: false, reason: '후기는 30자 이상 작성해주세요.' };
  }
  const lowSignalReason = hasObviousLowSignal(text);
  if (lowSignalReason) {
    return { valid: false, reason: lowSignalReason };
  }

  // 가이드 흐름(질문 답변)을 통해 작성된 경우 품질 사전 검사
  const quality = answers && answers.length > 0 ? calcAnswerQuality(answers) : null;
  if (quality === 0) {
    return { valid: false, reason: '질문에 직접 답해야 후기로 인정돼요. 나만의 생각을 질문에 담아주세요!' };
  }

  if (looksSubstantiveReview(text, bookTitle, answers)) {
    return { valid: true };
  }

  try {
    return await validateReviewOnServer(text, bookTitle, answers);
  } catch (error) {
    if (!canUseDirectGeminiFallback()) {
      const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
      return {
        valid: false,
        uncertain: true,
        reason: `서버 검증 API 호출에 실패해 보류되었어요${detail}. 후기 내용이 부족하다는 뜻은 아니에요.`,
      };
    }
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return { valid: false, uncertain: true, reason: 'Gemini API 키가 없어 검증을 보류했어요. 후기 내용 문제가 아니라 설정 문제예요.' };
  }

  const bookCtx = bookTitle ? `책 제목: "${bookTitle}"\n` : '';

  // quality 1 = 답변이 부실한 채로 AI가 생성한 독후감 → 더 엄격한 프롬프트
  const strictMode = quality === 1;

  const strictExtra = strictMode ? `
[추가 확인 기준 — 답변이 짧은 독후감입니다]
- 문장이 초등학생답게 단순하거나 서툴러도 책과 연결된 구체 단서가 있으면 통과하세요.
- 책의 특정 장면·인물·사건·정보 또는 독자 본인의 반응이 전혀 없고,
  책 제목만으로 만들 수 있는 일반적인 칭찬/교훈만 있으면 거절하세요.` : '';

  const prompt = `${bookCtx}후기: "${text}"

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

  try {
    const raw = await generateGeminiText([{ text: prompt }], { maxOutputTokens: 128, temperature: 0, json: true });
    const cleaned = cleanJsonText(raw);
    if (!cleaned) {
      if (hasEnoughReviewEvidence(text, bookTitle, answers)) return { valid: true };
      return { valid: false, uncertain: true, reason: 'AI가 빈 판정 결과를 보내 검증을 보류했어요. 후기 내용이 부족하다는 뜻은 아니며, 잠시 후 다시 검증해주세요.' };
    }
    const parsed = parseValidationJson(cleaned);
    if (parsed.valid === true) return { valid: true };
    return {
      valid: false,
      reason: parsed.reason ?? '책의 구체적인 내용과 나의 생각이 충분히 드러나야 해요.',
    };
  } catch (error) {
    if (hasEnoughReviewEvidence(text, bookTitle, answers)) return { valid: true };
    return { valid: false, uncertain: true, reason: describeValidationError(error) };
  }
}

const EMOTION_LABELS: Record<string, string> = {
  fun:       '재미있었어요',
  moving:    '감동받았어요',
  surprised: '놀라웠어요',
  sad:       '슬펐어요',
  hard:      '어려웠어요',
  boring:    '지루했어요',
};

function buildFallbackReview(
  emotionLabel: string,
  answers: { question: string; answer: string }[],
): string {
  const parts: string[] = [`이 책을 읽고 ${emotionLabel}.`];
  for (const a of answers) {
    if (a.answer.trim()) parts.push(a.answer.trim());
  }
  return parts.join(' ');
}

/**
 * 답변(평점·감정·질문 2개)을 바탕으로 Gemini가 독후감 자동 생성
 * - qualityLevel 0: 답변 없음 → 짧은 기본 fallback (AI 미호출)
 * - qualityLevel 1: 답변 1개이거나 짧은 경우 → 간단한 리뷰 (2~3문장)
 * - qualityLevel 2: 둘 다 충분히 답변 (≥30자) → 풍부한 리뷰 (3~5문장)
 */
export async function generateChildReview(
  bookTitle: string,
  rating: number,
  emotionKey: string,
  answers: { question: string; answer: string }[],
  isChild: boolean = true,
): Promise<string> {
  const emotionLabel = EMOTION_LABELS[emotionKey] ?? emotionKey;
  const qualityLevel = calcAnswerQuality(answers);

  const apiKey = getApiKey();
  if (!apiKey || qualityLevel === 0) {
    return buildFallbackReview(emotionLabel, answers);
  }

  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const filled = answers.filter(a => a.answer.trim().length > 0);
  const answersText = filled.map(a => `Q: ${a.question}\nA: ${a.answer.trim()}`).join('\n\n');
  const writer = isChild ? '아이가' : '독자가';
  const writerPoss = isChild ? '아이의' : '독자의';

  const toneGuide = isChild
    ? '초등학생 아이가 직접 쓴 것처럼 솔직하고 자연스러운 말투'
    : '자연스러운 성인 독후감 문체, 담백하고 진솔하게';

  const lengthGuide = qualityLevel === 2
    ? '3~5문장, 책의 구체적인 내용과 느낌을 풍부하게'
    : '2~3문장, 간단하고 솔직하게';

  const contentGuide = qualityLevel === 2
    ? `${writerPoss} 답변 내용을 충실히 반영해 책의 구체적인 내용이 들어가도록 작성`
    : `${writerPoss} 답변을 참고해 책에 대한 느낌을 간단히 표현`;

  const prompt = `${writer} 책을 읽고 답한 내용을 바탕으로 자연스러운 독후감을 작성해주세요.

책 제목: "${bookTitle}"
별점: ${stars} (${rating}/5)
읽은 느낌: ${emotionLabel}

${writerPoss} 답변:
${answersText}

[작성 지침]
- ${toneGuide}
- ${contentGuide}
- ${lengthGuide}
- ${writerPoss} 답변에 없는 책 내용, 인물, 사건, 교훈을 지어내지 말 것
- 답변이 부족하면 부족한 만큼 짧고 솔직하게 쓰되, 책과 무관한 문장은 넣지 말 것
- "재미있었다" 같은 감정만 반복하지 말고 답변에 나온 구체 단서를 반드시 반영
- 과하게 꾸미거나 형식적인 표현 금지
- 독후감 텍스트만 출력 (JSON·특수 기호 불필요)`;

  try {
    const text = await generateGeminiText(
      [{ text: prompt }],
      { maxOutputTokens: qualityLevel === 2 ? 400 : 200, temperature: 0.7 },
    );
    return text || buildFallbackReview(emotionLabel, answers);
  } catch {
    return buildFallbackReview(emotionLabel, answers);
  }
}

export interface BookRecognitionResult {
  title: string;
  author: string;
}

/**
 * 책 표지 이미지를 Gemini Vision으로 분석해 제목과 저자를 추출
 */
export async function recognizeBookFromImage(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
): Promise<BookRecognitionResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');

  const text = await generateGeminiText(
    [
      { inlineData: { mimeType, data: imageBase64 } },
      {
        text: `책 표지 이미지에서 텍스트를 분석하세요.

중요: 제목은 반드시 글자 크기(font size)가 가장 큰 텍스트입니다. 위치(위/아래/왼쪽/오른쪽)는 전혀 관계없습니다.

순서:
1. 표지에 있는 모든 텍스트를 글자 크기 기준으로 큰 것부터 나열하세요.
2. 글자 크기가 가장 큰 텍스트 = 주 제목
3. 한글과 영어가 섞여 있어도, 글자 크기가 더 큰 언어의 텍스트를 제목으로 선택하세요.
4. 선택한 텍스트를 절대 번역하거나 다른 언어로 바꾸지 마세요. 원문 그대로 출력하세요.

다음 JSON 형식으로만 최종 응답하세요 (다른 텍스트 없이):
{"title": "글자 크기가 가장 큰 텍스트 원문", "author": "저자명 원문"}
확인할 수 없는 항목은 ""로 두세요.`,
      },
    ],
    { maxOutputTokens: 256, temperature: 0, json: true },
  );
  const cleaned = cleanJsonText(text);
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

  const text = await generateGeminiText([{ text: prompt }], { maxOutputTokens: 256, temperature: 0.2, json: true });

  try {
    const cleaned = cleanJsonText(text);
    const parsed = JSON.parse(cleaned) as { meaning?: string; example?: string };
    return {
      meaning: parsed.meaning ?? cleaned,
      example: parsed.example,
    };
  } catch {
    return { meaning: text };
  }
}

export async function generateStatsSummary(prompt: string): Promise<string> {
  return generateGeminiText([{ text: prompt }], { maxOutputTokens: 150, temperature: 0.7 });
}
