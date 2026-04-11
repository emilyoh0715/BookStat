import type { VercelRequest, VercelResponse } from '@vercel/node';

interface BookResult {
  cover: string;
  title: string;
  author: string;
  publisher: string;
  pages?: number;
  categoryName?: string;
}

type AladinItem = {
  title: string;
  author: string;
  publisher: string;
  cover: string;
  isbn?: string | number;
  isbn13?: string | number;
  categoryName?: string;
};

async function lookupPages(aladinKey: string, isbn: string): Promise<number | undefined> {
  try {
    const url = `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${aladinKey}&itemIdType=ISBN13&ItemId=${isbn}&output=js&Version=20131101&OptResult=subInfo`;
    const r = await fetch(url);
    if (!r.ok) return undefined;
    const text = await r.text();
    const data = JSON.parse(text) as { item?: Array<{ subInfo?: { itemPage?: number } }> };
    const pages = data.item?.[0]?.subInfo?.itemPage;
    return pages && pages > 0 ? pages : undefined;
  } catch {
    return undefined;
  }
}

async function searchAladin(
  aladinKey: string,
  titleQuery: string,
  searchTarget: 'Book' | 'Foreign',
): Promise<AladinItem[]> {
  try {
    const url = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinKey}&Query=${titleQuery}&QueryType=Title&MaxResults=10&output=js&Version=20131101&Cover=Big&SearchTarget=${searchTarget}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const text = await r.text();
    const data = JSON.parse(text) as { item?: AladinItem[] };
    return data.item ?? [];
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');

  const title = String(req.query.title ?? '');
  const author = String(req.query.author ?? '').trim();
  const publisher = String(req.query.publisher ?? '').trim();
  const language = String(req.query.language ?? 'korean');
  const results: BookResult[] = [];

  const aladinKey = process.env.ALADIN_API_KEY || process.env.VITE_ALADIN_API_KEY;

  if (aladinKey && title) {
    const titleQuery = encodeURIComponent(title);
    const isForeign = language === 'english' || language === 'other';

    // 영어/기타: 외국도서 우선, 결과 없으면 국내도서도 시도
    // 한국어: 국내도서만
    let items: AladinItem[] = await searchAladin(aladinKey, titleQuery, isForeign ? 'Foreign' : 'Book');

    if (isForeign && items.length === 0) {
      items = await searchAladin(aladinKey, titleQuery, 'Book');
    }

    // 저자·출판사 일치 점수순 정렬 (2: 둘 다, 1: 하나, 0: 없음)
    const score = (d: AladinItem) => {
      const authorMatch = author && d.author?.includes(author) ? 1 : 0;
      const publisherMatch = publisher && d.publisher?.includes(publisher) ? 1 : 0;
      return authorMatch + publisherMatch;
    };
    const sorted = (author || publisher)
      ? [...items].sort((a, b) => score(b) - score(a))
      : items;

    // 커버 있는 첫 번째 결과 ISBN으로 페이지 수 조회
    const firstWithCover = sorted.find(d => d.cover);
    let firstPages: number | undefined;
    if (firstWithCover) {
      const isbn = String(firstWithCover.isbn13 || firstWithCover.isbn || '').replace(/-/g, '');
      if (isbn.length >= 10) {
        firstPages = await lookupPages(aladinKey, isbn);
      }
    }

    let isFirst = true;
    sorted.forEach(d => {
      if (d.cover) {
        results.push({
          cover: d.cover,
          title: d.title ?? '',
          author: d.author ?? '',
          publisher: d.publisher ?? '',
          pages: isFirst ? firstPages : undefined,
          categoryName: d.categoryName,
        });
        isFirst = false;
      }
    });
  }

  // 중복 cover 제거
  const seen = new Set<string>();
  const unique = results.filter(b => {
    if (seen.has(b.cover)) return false;
    seen.add(b.cover);
    return true;
  });

  return res.json({
    books: unique,
    covers: unique.map(b => b.cover),
  });
}
