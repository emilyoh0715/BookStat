export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const title = url.searchParams.get('title') ?? '';
  const author = url.searchParams.get('author') ?? '';
  const results: string[] = [];

  const aladinKey = process.env.ALADIN_API_KEY || process.env.VITE_ALADIN_API_KEY;

  if (aladinKey) {
    try {
      // 제목만으로 검색 (저자 포함 시 매칭 안 되는 경우 있음)
      const titleQuery = encodeURIComponent(title);
      const r = await fetch(
        `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinKey}&Query=${titleQuery}&QueryType=Title&MaxResults=10&output=js&Version=20131101&Cover=Big`
      );
      if (r.ok) {
        const text = await r.text();
        const data = JSON.parse(text) as { item?: Array<{ cover: string; author: string }> };
        // 저자 이름이 포함된 결과만 우선 정렬
        const items = data.item ?? [];
        const sorted = [
          ...items.filter(d => author && d.author?.includes(author)),
          ...items.filter(d => !author || !d.author?.includes(author)),
        ];
        const urls = sorted.map(d => d.cover).filter(Boolean);
        results.push(...urls);
      }
    } catch { /* ignore */ }
  }

  // Google Books - 제목만으로 검색
  try {
    const googleQuery = encodeURIComponent(`intitle:${title}`);
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${googleQuery}&maxResults=10&langRestrict=ko`);
    if (r.ok) {
      const data = await r.json() as { items?: Array<Record<string, unknown>> };
      const urls = (data.items ?? [])
        .map((item: Record<string, unknown>) => {
          const info = item.volumeInfo as Record<string, unknown>;
          const links = info?.imageLinks as Record<string, string> | undefined;
          const u = links?.large || links?.medium || links?.thumbnail || links?.smallThumbnail;
          return u ? u.replace('http://', 'https://').replace('zoom=1', 'zoom=2') : null;
        })
        .filter(Boolean) as string[];
      results.push(...urls);
    }
  } catch { /* ignore */ }

  return Response.json({ covers: [...new Set(results)] });
}
