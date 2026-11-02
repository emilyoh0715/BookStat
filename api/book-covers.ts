import type { VercelRequest, VercelResponse } from '@vercel/node';

// 책 검색: 카카오 책 검색 API(한국 책) + Google Books API(외국 책, 페이지 수·장르 보완)
// 환경변수: KAKAO_REST_API_KEY (필수), GOOGLE_BOOKS_API_KEY (선택)

interface BookResult {
  cover: string;
  title: string;
  author: string;
  publisher: string;
  pages?: number;
  categoryName?: string;
  isbn?: string;
}

const TIMEOUT = 6000;

// "변우철 지음", "한강 저" 같은 표기에서 이름만 남김
function cleanAuthor(raw: string): string {
  return raw.replace(/\(?(지음|저|글|그림|옮김|역|엮음|편저|감수|著)\)?/g, ' ').replace(/\s+/g, ' ').trim();
}

function authorMatches(bookAuthor: string, author: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  const a = norm(bookAuthor);
  // 공동 저자는 쉼표로 나뉘어 있으므로 한 명이라도 맞으면 OK
  return author.split(/[,·]/).map(norm).filter(Boolean).some(n => a.includes(n));
}

// 외부 API 실패 기록 (Vercel 로그 + ?debug=1 응답용, 키 값은 남기지 않음)
type ApiError = { api: string; status: number | string; reason?: string };
let apiErrors: ApiError[] = [];

async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  const api = new URL(url).hostname;
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      const reason = body.match(/"(?:reason|message|errorType)"\s*:\s*"([^"]{0,160})/)?.[1];
      apiErrors.push({ api, status: r.status, reason });
      console.warn(`[book-covers] ${api} ${r.status} ${reason ?? ''}`);
      return null;
    }
    return await r.json() as T;
  } catch (e) {
    apiErrors.push({ api, status: 'network', reason: e instanceof Error ? e.message : String(e) });
    console.warn(`[book-covers] ${api} network error`, e);
    return null;
  }
}

// ── 카카오 ────────────────────────────────────────────

type KakaoDoc = {
  title: string;
  authors: string[];
  publisher: string;
  thumbnail: string;
  isbn: string; // "ISBN10 ISBN13" (공백 구분, 한쪽이 빈 문자열일 수 있음)
};

// 카카오 썸네일(120x174)에서 원본 이미지 주소를 꺼냄
function kakaoCover(thumbnail: string): string {
  if (!thumbnail) return '';
  try {
    const fname = new URL(thumbnail).searchParams.get('fname');
    if (fname) return fname.replace(/^http:\/\//, 'https://');
  } catch { /* 그대로 사용 */ }
  return thumbnail;
}

async function searchKakao(key: string, query: string, target: 'title' | 'person' = 'title'): Promise<BookResult[]> {
  const url = `https://dapi.kakao.com/v3/search/book?target=${target}&size=10&query=${encodeURIComponent(query)}`;
  const data = await getJson<{ documents?: KakaoDoc[] }>(url, { Authorization: `KakaoAK ${key}` });
  return (data?.documents ?? []).map(d => ({
    cover: kakaoCover(d.thumbnail),
    title: d.title ?? '',
    author: (d.authors ?? []).join(', '),
    publisher: d.publisher ?? '',
    isbn: d.isbn?.split(' ').filter(Boolean).pop(), // ISBN13 우선
  }));
}

// 사진 인식 제목이 실제와 조금 다를 수 있어 단계적으로 다시 검색
// 예) 표지의 영어 "PALANTIR"만 제목으로 인식 → 저자 이름으로 다시 찾기
async function searchKakaoSmart(key: string, title: string, author: string): Promise<BookResult[]> {
  let items = await searchKakao(key, title);

  // 1) 영어+한글이 섞여 결과가 없으면 한글만으로
  if (items.length === 0) {
    const korean = title.replace(/[A-Za-z]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (korean && korean !== title) items = await searchKakao(key, korean);
  }
  // 2) 그래도 없으면 앞의 두 단어만으로
  if (items.length === 0) {
    const words = title.split(/\s+/).filter(Boolean);
    if (words.length > 2) items = await searchKakao(key, words.slice(0, 2).join(' '));
  }
  // 3) 저자를 알면서 결과에 그 저자 책이 없으면 저자 이름으로도 검색해 합침
  if (author && !items.some(d => authorMatches(d.author, author))) {
    items = [...items, ...await searchKakao(key, author, 'person')];
  }
  return items;
}

// ── Google Books ─────────────────────────────────────

type GoogleVolume = {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    pageCount?: number;
    categories?: string[];
    language?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
};

// Google 영문 카테고리 → 앱의 장르 매핑(mapCategory)이 알아듣는 한글 키워드
const GOOGLE_CATEGORY: [RegExp, string][] = [
  [/juvenile/i, '어린이'],
  [/young adult/i, '청소년'],
  [/comics|graphic novel/i, '만화'],
  [/poetry/i, '시'],
  [/fiction/i, '소설'],
  [/business|economics/i, '경제/경영'],
  [/self-help/i, '자기계발'],
  [/philosophy|psychology/i, '인문'],
  [/political|social science/i, '사회/정치'],
  [/history/i, '역사'],
  [/computers/i, '컴퓨터'],
  [/technology|engineering/i, '기술/공학'],
  [/science|nature|mathematics/i, '과학'],
  [/language/i, '외국어'],
  [/travel/i, '여행'],
  [/cooking/i, '요리'],
  [/health|medical/i, '건강'],
  [/family|parenting/i, '가정/육아'],
  [/art|music|performing|photography/i, '예술'],
  [/religion/i, '종교'],
  [/sports|crafts|hobbies|games/i, '취미/실용/스포츠'],
  [/study aids/i, '수험'],
];

function mapGoogleCategory(categories?: string[]): string | undefined {
  const cat = categories?.join(' ');
  if (!cat) return undefined;
  return GOOGLE_CATEGORY.find(([re]) => re.test(cat))?.[1];
}

function googleCover(v: NonNullable<GoogleVolume['volumeInfo']>): string {
  const link = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '';
  return link.replace(/^http:\/\//, 'https://').replace('&edge=curl', '');
}

function googleUrl(query: string, key: string | undefined, extra = '') {
  return `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}${extra}${key ? `&key=${key}` : ''}`;
}

async function searchGoogle(key: string | undefined, title: string, langRestrict?: string): Promise<BookResult[]> {
  const extra = `&maxResults=10&printType=books${langRestrict ? `&langRestrict=${langRestrict}` : ''}`;
  const data = await getJson<{ items?: GoogleVolume[] }>(googleUrl(`intitle:${title}`, key, extra));
  let items = data?.items ?? [];
  // langRestrict가 다른 언어판을 섞어 주는 경우가 있어 요청 언어 책을 앞으로
  if (langRestrict) {
    const match = (v: GoogleVolume) => (v.volumeInfo?.language === langRestrict ? 0 : 1);
    items = [...items].sort((a, b) => match(a) - match(b));
  }
  return items.flatMap(item => {
    const v = item.volumeInfo;
    if (!v) return [];
    const isbn = v.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier
      ?? v.industryIdentifiers?.find(i => i.type === 'ISBN_10')?.identifier;
    return [{
      cover: googleCover(v),
      title: v.subtitle ? `${v.title}: ${v.subtitle}` : (v.title ?? ''),
      author: (v.authors ?? []).join(', '),
      publisher: v.publisher ?? '',
      pages: v.pageCount && v.pageCount > 0 ? v.pageCount : undefined,
      categoryName: mapGoogleCategory(v.categories),
      isbn,
    }];
  });
}

// ISBN으로 Google Books에서 페이지 수·장르 보완
async function lookupGoogleByIsbn(key: string | undefined, isbn: string) {
  const data = await getJson<{ items?: GoogleVolume[] }>(googleUrl(`isbn:${isbn}`, key));
  const v = data?.items?.[0]?.volumeInfo;
  if (!v) return {};
  return {
    pages: v.pageCount && v.pageCount > 0 ? v.pageCount : undefined,
    categoryName: mapGoogleCategory(v.categories),
  };
}

// ── 핸들러 ───────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');
  apiErrors = [];
  const debug = req.query.debug === '1';

  const title = String(req.query.title ?? '').trim();
  const author = cleanAuthor(String(req.query.author ?? ''));
  const publisher = String(req.query.publisher ?? '').trim();
  const language = String(req.query.language ?? 'korean');

  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  const googleKey = process.env.GOOGLE_BOOKS_API_KEY;

  let items: BookResult[] = [];

  if (title) {
    const isForeign = language === 'english' || language === 'other';
    const kakao = () => kakaoKey ? searchKakaoSmart(kakaoKey, title, author) : Promise.resolve([]);
    const google = () => searchGoogle(googleKey, title, language === 'english' ? 'en' : undefined);

    // 한국어: 카카오 우선 / 영어·기타: Google 우선. 결과 없으면 다른 쪽으로 재시도
    items = isForeign ? await google() : await kakao();
    if (items.length === 0) items = isForeign ? await kakao() : await google();
  }

  // 저자·출판사 일치 점수순 정렬
  const score = (d: BookResult) =>
    (author && authorMatches(d.author, author) ? 2 : 0) + (publisher && d.publisher.includes(publisher) ? 1 : 0);
  const sorted = (author || publisher) ? [...items].sort((a, b) => score(b) - score(a)) : items;

  // 표지 있는 것만, 중복 표지 제거
  const seen = new Set<string>();
  const unique = sorted.filter(b => {
    if (!b.cover || seen.has(b.cover)) return false;
    seen.add(b.cover);
    return true;
  });

  // 첫 번째 결과의 페이지 수·장르가 비어 있으면 ISBN으로 보완
  const first = unique[0];
  if (first?.isbn && (!first.pages || !first.categoryName)) {
    const extra = await lookupGoogleByIsbn(googleKey, first.isbn);
    first.pages ??= extra.pages;
    first.categoryName ??= extra.categoryName;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const books = unique.map(({ isbn: _isbn, ...b }) => b);

  if (debug) res.setHeader('Cache-Control', 'no-store');
  return res.json({
    books,
    covers: books.map(b => b.cover),
    ...(debug ? {
      debug: { hasKakaoKey: !!kakaoKey, hasGoogleKey: !!googleKey, errors: apiErrors },
    } : {}),
  });
}
