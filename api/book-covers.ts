import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  const title = String(req.query.title ?? '');
  const author = String(req.query.author ?? '');
  const results: string[] = [];

  const aladinKey = process.env.ALADIN_API_KEY || process.env.VITE_ALADIN_API_KEY;

  if (aladinKey && title) {
    try {
      const titleQuery = encodeURIComponent(title);
      const aladinUrl = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinKey}&Query=${titleQuery}&QueryType=Title&MaxResults=10&output=js&Version=20131101&Cover=Big`;
      const r = await fetch(aladinUrl);
      if (r.ok) {
        const text = await r.text();
        const data = JSON.parse(text) as { item?: Array<{ cover: string; author: string }> };
        const items = data.item ?? [];
        const sorted = author ? [
          ...items.filter(d => d.author?.includes(author)),
          ...items.filter(d => !d.author?.includes(author)),
        ] : items;
        sorted.forEach(d => { if (d.cover) results.push(d.cover); });
      }
    } catch { /* ignore */ }
  }

  return res.json({ covers: [...new Set(results)] });
}
