import type { VercelRequest, VercelResponse } from '@vercel/node';

interface BookResult {
  cover: string;
  title: string;
  author: string;
  publisher: string;
  pages?: number;
  categoryName?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');

  const title = String(req.query.title ?? '');
  const author = String(req.query.author ?? '');
  const results: BookResult[] = [];

  const aladinKey = process.env.ALADIN_API_KEY || process.env.VITE_ALADIN_API_KEY;

  if (aladinKey && title) {
    try {
      // 1) ItemSearch — 표지·기본 정보 목록
      const titleQuery = encodeURIComponent(title);
      const searchUrl = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinKey}&Query=${titleQuery}&QueryType=Title&MaxResults=10&output=js&Version=20131101&Cover=Big`;
      const r = await fetch(searchUrl);

      if (r.ok) {
        const text = await r.text();
        const data = JSON.parse(text) as {
          item?: Array<{
            title: string;
            author: string;
            publisher: string;
            cover: string;
            isbn13?: string;
            categoryName?: string;
          }>;
        };
        const items = data.item ?? [];
        const sorted = author ? [
          ...items.filter(d => d.author?.includes(author)),
          ...items.filter(d => !d.author?.includes(author)),
        ] : items;

        // 2) 첫 번째 결과의 ISBN13으로 ItemLookup → 페이지 수 취득
        let firstPages: number | undefined;
        const firstIsbn = sorted[0]?.isbn13;
        if (firstIsbn) {
          try {
            const lookupUrl = `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${aladinKey}&itemIdType=ISBN13&ItemId=${firstIsbn}&output=js&Version=20131101&OptResult=subInfo`;
            const lr = await fetch(lookupUrl);
            if (lr.ok) {
              const ltext = await lr.text();
              const ldata = JSON.parse(ltext) as {
                item?: Array<{
                  publisher?: string;
                  subInfo?: { itemPage?: number };
                }>;
              };
              const litem = ldata.item?.[0];
              firstPages = litem?.subInfo?.itemPage || undefined;
            }
          } catch { /* ignore */ }
        }

        sorted.forEach((d, idx) => {
          if (d.cover) {
            results.push({
              cover: d.cover,
              title: d.title ?? '',
              author: d.author ?? '',
              publisher: d.publisher ?? '',
              pages: idx === 0 ? firstPages : undefined,
              categoryName: d.categoryName,
            });
          }
        });
      }
    } catch { /* ignore */ }
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
