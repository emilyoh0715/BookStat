export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const title = url.searchParams.get('title') ?? '';
  const author = url.searchParams.get('author') ?? '';
  const query = encodeURIComponent(`${title} ${author}`);
  const debug: Record<string, unknown> = {};
  const results: string[] = [];

  const aladinKey = process.env.ALADIN_API_KEY || process.env.VITE_ALADIN_API_KEY;
  debug.hasAladinKey = !!aladinKey;
  debug.aladinKeyPrefix = aladinKey ? aladinKey.slice(0, 8) : null;

  if (aladinKey) {
    try {
      const aladinUrl = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinKey}&Query=${query}&QueryType=Title&MaxResults=10&output=js&Version=20131101&Cover=Big`;
      const r = await fetch(aladinUrl);
      debug.aladinStatus = r.status;
      const text = await r.text();
      debug.aladinRaw = text.slice(0, 300);
      try {
        const data = JSON.parse(text) as { item?: Array<{ cover: string }> };
        const urls = (data.item ?? []).map((d: { cover: string }) => d.cover).filter(Boolean);
        results.push(...urls);
        debug.aladinCount = urls.length;
      } catch (e) {
        debug.aladinParseError = String(e);
      }
    } catch (e) {
      debug.aladinError = String(e);
    }
  }

  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=10`);
    debug.googleStatus = r.status;
    const data = await r.json() as { items?: Array<Record<string, unknown>> };
    debug.googleCount = data.items?.length ?? 0;
    const urls = (data.items ?? [])
      .map((item: Record<string, unknown>) => {
        const info = item.volumeInfo as Record<string, unknown>;
        const links = info?.imageLinks as Record<string, string> | undefined;
        const u = links?.large || links?.medium || links?.thumbnail || links?.smallThumbnail;
        return u ? u.replace('http://', 'https://').replace('zoom=1', 'zoom=2') : null;
      })
      .filter(Boolean) as string[];
    results.push(...urls);
  } catch (e) {
    debug.googleError = String(e);
  }

  return Response.json({ covers: [...new Set(results)], debug });
}
