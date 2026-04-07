import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { title, author } = req.query;
  if (!title) return res.status(400).json({ error: 'title required' });

  const query = encodeURIComponent(`${title} ${author ?? ''}`);
  const results: string[] = [];

  // 알라딘 API
  const aladinKey = process.env.ALADIN_API_KEY || process.env.VITE_ALADIN_API_KEY;
  if (aladinKey) {
    try {
      const r = await fetch(
        `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinKey}&Query=${query}&QueryType=Title&MaxResults=10&output=js&Version=20131101&Cover=Big`
      );
      const data = await r.json() as { item?: Array<{ cover: string }> };
      const urls = (data.item ?? []).map(d => d.cover).filter(Boolean);
      results.push(...urls);
    } catch { /* ignore */ }
  }

  // Google Books 폴백
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=10`);
    const data = await r.json() as { items?: Array<Record<string, unknown>> };
    const urls = (data.items ?? [])
      .map(item => {
        const links = (item.volumeInfo as Record<string, unknown>)?.imageLinks as Record<string, string> | undefined;
        const url = links?.large || links?.medium || links?.thumbnail || links?.smallThumbnail;
        return url ? url.replace('http://', 'https://').replace('zoom=1', 'zoom=2') : null;
      })
      .filter(Boolean) as string[];
    results.push(...urls);
  } catch { /* ignore */ }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ covers: [...new Set(results)] });
}
