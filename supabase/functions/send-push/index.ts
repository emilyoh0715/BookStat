import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── VAPID JWT signing (Web Crypto API, no external lib) ────────────────────
function b64ToBytes(b64url: string): Uint8Array {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesToB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function jsonToB64(obj: unknown): string {
  return bytesToB64(new TextEncoder().encode(JSON.stringify(obj)));
}

async function buildVapidHeaders(
  endpoint: string,
  pubKeyB64: string,
  privKeyB64: string,
): Promise<Record<string, string>> {
  const { origin } = new URL(endpoint);

  // Import private key as JWK (d value + public key coordinates extracted from pubKey)
  const pubBytes = b64ToBytes(pubKeyB64);               // 65 bytes: 0x04 || x || y
  const x = bytesToB64(pubBytes.slice(1, 33));
  const y = bytesToB64(pubBytes.slice(33, 65));

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: privKeyB64, x, y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const header  = jsonToB64({ typ: 'JWT', alg: 'ES256' });
  const claims  = jsonToB64({
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: 'mailto:admin@bookstat.app',
  });
  const sigInput = `${header}.${claims}`;
  const sigBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(sigInput),
  );

  const jwt = `${sigInput}.${bytesToB64(new Uint8Array(sigBytes))}`;

  return {
    Authorization: `vapid t=${jwt},k=${pubKeyB64}`,
    TTL: '86400',
  };
}

// ─── AES-128-GCM encrypted push payload (RFC 8291) ──────────────────────────
async function buildEncryptedBody(
  message: string,
  authSecret: Uint8Array,
  receiverPublicKey: Uint8Array,
): Promise<{ body: Uint8Array; headers: Record<string, string> }> {
  // 1. Generate sender ECDH keypair
  const senderKey = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const senderPubRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', senderKey.publicKey)
  );

  // 2. Import receiver public key
  const receiverKey = await crypto.subtle.importKey(
    'raw', receiverPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, true, []
  );

  // 3. ECDH shared secret
  const sharedBits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: receiverKey }, senderKey.privateKey, 256
    )
  );

  // 4. HKDF-SHA-256 key derivation
  async function hkdf(
    salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number
  ): Promise<Uint8Array> {
    const prk = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info }, prk, len * 8
    ));
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyInfo = enc.encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = enc.encode('Content-Encoding: nonce\0');

  // Build context
  const context = new Uint8Array([
    ...enc.encode('P-256\0'),
    0, 65, ...receiverPublicKey,
    0, 65, ...senderPubRaw,
  ]);
  const prkKey = await hkdf(authSecret, sharedBits, new Uint8Array([...enc.encode('WebPush: info\0'), ...context]), 32);

  const contentKey = await hkdf(salt, prkKey, keyInfo, 16);
  const nonce      = await hkdf(salt, prkKey, nonceInfo, 12);

  // 5. Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const plaintext = new Uint8Array([...enc.encode(message), 0x02]); // padding delimiter
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext)
  );

  // 6. Build body: salt (16) + rs (4) + keylen (1) + senderPub (65) + ciphertext
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  const body = new Uint8Array([
    ...salt, ...rs, senderPubRaw.length, ...senderPubRaw, ...ciphertext
  ]);

  return {
    body,
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
    },
  };
}

// ─── Send to one subscription ────────────────────────────────────────────────
async function sendOne(
  sub: { endpoint: string; keys: { auth: string; p256dh: string } },
  payload: string,
  vapidPub: string,
  vapidPriv: string,
): Promise<void> {
  const authSecret = b64ToBytes(sub.keys.auth);
  const receiverPub = b64ToBytes(sub.keys.p256dh);

  const { body, headers: encHeaders } = await buildEncryptedBody(payload, authSecret, receiverPub);
  const vapidHeaders = await buildVapidHeaders(sub.endpoint, vapidPub, vapidPriv);

  await fetch(sub.endpoint, {
    method: 'POST',
    headers: { ...vapidHeaders, ...encHeaders, 'Content-Length': String(body.length) },
    body,
  });
}

// ─── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { groupId, senderId, title, body } = await req.json() as {
      groupId: string; senderId: string; title: string; body: string;
    };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const vapidPub  = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPriv = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('group_id', groupId)
      .neq('user_id', senderId);

    const payload = JSON.stringify({ title, body });

    await Promise.allSettled(
      (subs ?? []).map(({ subscription }) =>
        sendOne(
          subscription as { endpoint: string; keys: { auth: string; p256dh: string } },
          payload,
          vapidPub,
          vapidPriv,
        )
      )
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
