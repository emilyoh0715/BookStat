export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const title = url.searchParams.get('title') ?? '';
  const author = url.searchParams.get('author') ?? '';
  const query = encodeURIComponent(`${title} ${author}`);
  const results: string[] = [];

  // 알라딘 API
  const aladinKey = process.env.ALADIN_API_KEY || process.env.VITE_ALADIN_API_KEY;
  if (aladinKey) {
    try {
      const r = await fetch(
        `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinKey}&Query=${query}&QueryType=Title&MaxResults=10&output=js&Version=20131101&Cover=Big`
      );
      if (r.ok) {
        const data = await r.json() as { item?: Array<{ cover: string }> };
        const urls = (data.item ?? []).map((d: { cover: string }) => d.cover).filter(Boolean);
        results.push(...urls);
      }
    } catch { /* ignore */ }
  }

  // Google Books 폴백
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=10`);
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
