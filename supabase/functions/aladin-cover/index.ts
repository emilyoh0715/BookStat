import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url  = new URL(req.url);
  const title  = url.searchParams.get('title')  ?? '';
  const ttbKey = Deno.env.get('ALADIN_TTB_KEY') ?? '';

  if (!ttbKey || !title) {
    return new Response(JSON.stringify({ cover: null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const apiUrl =
    `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx` +
    `?TTBKey=${ttbKey}` +
    `&Query=${encodeURIComponent(title)}` +
    `&QueryType=Title&MaxResults=1&start=1&SearchTarget=Book` +
    `&output=js&Version=20131101`;

  try {
    const res  = await fetch(apiUrl);
    const json = await res.json();
    const raw  = (json.item?.[0]?.cover ?? '') as string;
    const cover = raw ? raw.replace('http://', 'https://').replace('/cover/cover/', '/cover200/') : null;
    return new Response(JSON.stringify({ cover }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ cover: null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
