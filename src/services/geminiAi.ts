import { supabase } from '../lib/supabase';

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

async function callAi(path: string, body: unknown): Promise<Record<string, unknown>> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error('로그인 후 다시 시도해주세요.');
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new Error('AI 연결이 끊겼거나 응답 시간이 길어졌어요. 입력한 내용은 그대로 있으니 다시 시도해주세요.');
  }
  const data = await response.json().catch(() => null);
  if (!data || !response.ok) throw new Error(data?.error ?? data?.reason ?? 'AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.');
  return data;
}

async function generateGeminiText(parts: GeminiPart[], options: { maxOutputTokens?: number; temperature?: number; json?: boolean } = {}): Promise<string> {
  const data = await callAi('/api/generate-text', { parts, options });
  if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('AI가 빈 응답을 보냈어요. 다시 시도해주세요.');
  return data.text.trim();
}

function cleanJsonText(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

export interface ReviewValidationResult {
  valid: boolean;
  reason?: string;
  uncertain?: boolean;
  source?: 'local' | 'gemini';
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

export async function validateReview(review: string, bookTitle?: string, answers?: ReviewAnswer[]): Promise<ReviewValidationResult> {
  if (review.trim().length < 30) return { valid: false, reason: '후기는 30자 이상 작성해주세요.' };
  try {
    const result = await callAi('/api/validate-review', { review, bookTitle, answers });
    if (typeof result.valid !== 'boolean') throw new Error('AI 판정 형식을 확인하지 못했어요.');
    if (result.valid && (result.uncertain === true || result.source !== 'gemini')) throw new Error('감상문 승인 근거를 확인하지 못했어요. 다시 검증해주세요.');
    return result as unknown as ReviewValidationResult;
  } catch (error) {
    return { valid: false, uncertain: true, reason: error instanceof Error ? error.message : 'AI 검증을 보류했어요. 잠시 후 다시 시도해주세요.' };
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

export function buildFallbackReview(
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

  if (qualityLevel === 0) {
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

  return generateGeminiText(
    [{ text: prompt }],
    { maxOutputTokens: 1000, temperature: 0.5 },
  );
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
