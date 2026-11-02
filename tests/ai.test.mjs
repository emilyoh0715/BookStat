import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateText } from '../server/gemini.ts';
import generateHandler from '../api/generate-text.ts';
import validateHandler from '../api/validate-review.ts';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-secret';
  process.env.GEMINI_MODEL = 'gemini-2.5-flash';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-public-key';
});
afterEach(() => { globalThis.fetch = originalFetch; process.env = { ...originalEnv }; });

function response(text, finishReason = 'STOP') {
  return Response.json({ candidates: [{ content: { parts: [{ text }] }, finishReason }] });
}
async function invoke(handler, body, headers = { authorization: 'Bearer test-session' }, method = 'POST') {
  const res = {
    statusCode: 200, body: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
  await handler({ body, method, headers }, res);
  return res;
}

test('generation validates session, uses a server key and returns complete text', async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.ok(init.signal);
    if (url.endsWith('/auth/v1/user')) {
      assert.equal(init.headers.Authorization, 'Bearer test-session');
      return Response.json({ id: 'test-user' });
    }
    assert.equal(init.headers['x-goog-api-key'], 'test-secret');
    assert.ok(!url.includes('test-secret'));
    const payload = JSON.parse(init.body);
    assert.equal(payload.generationConfig.maxOutputTokens, 1000);
    return response('주인공이 강아지를 도운 장면이 기억에 남았다.');
  };
  const result = await invoke(generateHandler, { parts: [{ text: '감상문 작성' }], options: { maxOutputTokens: 1000 } });
  assert.equal(result.statusCode, 200);
  assert.match(result.body.text, /강아지/);
  assert.equal(calls, 2);
  assert.ok(!JSON.stringify(result.body).includes('test-secret'));
});

test('anonymous requests do not call Gemini', async () => {
  globalThis.fetch = () => { throw new Error('must not be called'); };
  const result = await invoke(generateHandler, { parts: [{ text: 'test' }] }, {});
  assert.equal(result.statusCode, 401);
});

test('invalid sessions do not call Gemini', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('', { status: 401 }); };
  const result = await invoke(generateHandler, { parts: [{ text: 'test' }] });
  assert.equal(result.statusCode, 401);
  assert.equal(calls, 1);
});

test('malformed JSON and invalid answers return a client error, not a crash', async () => {
  globalThis.fetch = () => { throw new Error('must not be called'); };
  for (const body of ['{', null, { review: 'test', answers: [{ answer: 42 }] }]) {
    const result = await invoke(validateHandler, body);
    assert.equal(result.statusCode, 400);
    assert.equal(result.body.uncertain, true);
  }
});

test('oversized text is rejected before calling a provider', async () => {
  globalThis.fetch = () => { throw new Error('must not be called'); };
  const result = await invoke(generateHandler, { parts: [{ text: 'x'.repeat(20001) }] });
  assert.equal(result.statusCode, 400);
});

test('transient provider errors retry once', async () => {
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? new Response('', { status: 503 }) : response('복구된 응답');
  assert.equal(await generateText([{ text: 'test' }]), '복구된 응답');
  assert.equal(calls, 2);
});

test('configuration errors are not retried or exposed verbatim', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: { message: 'test-secret' } }, { status: 403 }); };
  await assert.rejects(generateText([{ text: 'test' }]), error => error.code === 'configuration' && !error.message.includes('test-secret'));
  assert.equal(calls, 1);
});

test('empty or truncated responses cannot become successful reviews', async () => {
  for (const [text, reason, code] of [['', 'STOP', 'empty_response'], ['잘린 문장', 'MAX_TOKENS', 'truncated']]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return response(text, reason); };
    await assert.rejects(generateText([{ text: 'test' }]), error => error.code === code);
    assert.equal(calls, 2);
  }
});

test('network timeouts produce a recoverable error after a bounded retry', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new DOMException('timeout', 'TimeoutError'); };
  await assert.rejects(generateText([{ text: 'test' }]), error => error.code === 'network');
  assert.equal(calls, 2);
});

test('validation transport failure stays uncertain instead of rejecting the review', async () => {
  globalThis.fetch = async url => url.endsWith('/auth/v1/user') ? Response.json({ id: 'user' }) : new Response('', { status: 403 });
  const result = await invoke(validateHandler, { review: '토끼가 늑대를 피해 굴속으로 들어가는 모습을 보고 가슴이 두근거렸다.' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.valid, false);
  assert.equal(result.body.uncertain, true);
});

test('malformed model verdict remains uncertain', async () => {
  globalThis.fetch = async url => url.endsWith('/auth/v1/user') ? Response.json({ id: 'user' }) : response('{}');
  const result = await invoke(validateHandler, { review: '토끼가 늑대를 피해 굴속으로 들어가는 모습을 보고 가슴이 두근거렸다.' });
  assert.equal(result.body.uncertain, true);
});

const longGenericReview = '이 책의 이야기는 정말 재미있었고 많은 생각이 들었다. 등장인물과 장면에서 큰 감동을 받았으며 좋은 교훈을 배웠다. 다음에도 이런 책을 읽으면서 여러 가지를 배우고 더 나은 사람이 되고 싶다. 책의 내용과 사건은 매우 인상적이었고 오랫동안 기억에 남을 것 같다.';

test('long generic text must reach Gemini and respect its rejection', async () => {
  let called = false;
  globalThis.fetch = async url => {
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user' });
    called = true;
    return response(JSON.stringify({ valid: false, reason: '구체적인 장면이나 정보를 적어주세요.' }));
  };
  const result = await invoke(validateHandler, { review: longGenericReview });
  assert.equal(called, true);
  assert.equal(result.body.valid, false);
});

test('long text or long answers cannot turn a provider failure into approval', async () => {
  globalThis.fetch = async url => url.endsWith('/auth/v1/user') ? Response.json({ id: 'user' }) : new Response('', { status: 403 });
  const result = await invoke(validateHandler, { review: longGenericReview, answers: [
    { question: '장면?', answer: '생각이 들었고 매우 재미있었고 좋은 교훈을 배워서 다시 읽고 싶은 책이다.' },
    { question: '느낌?', answer: '인상적이었고 감동적이었고 앞으로 더 많은 책을 읽으며 배움을 얻고 싶다.' },
  ] });
  assert.equal(result.body.valid, false);
  assert.equal(result.body.uncertain, true);
});

test('approval without a verbatim supporting passage is held', async () => {
  for (const verdict of [{ valid: true }, { valid: true, evidence: '최종 감상문에 없는 내용을 지어낸 구절입니다.' }]) {
    globalThis.fetch = async url => url.endsWith('/auth/v1/user') ? Response.json({ id: 'user' }) : response(JSON.stringify(verdict));
    const result = await invoke(validateHandler, { review: longGenericReview });
    assert.equal(result.body.valid, false);
    assert.equal(result.body.uncertain, true);
  }
});

test('Gemini receives original answers and must cite actual review text to approve', async () => {
  const review = '토끼가 친구를 구하려고 위험을 무릅쓰는 장면이 기억에 남았다. 나도 친구가 어려울 때 도와주고 싶다.';
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user' });
    const prompt = JSON.parse(init.body).contents[0].parts[0].text;
    assert.ok(prompt.includes('실제 답변 확인용'));
    return response(JSON.stringify({ valid: true, evidence: review }));
  };
  const result = await invoke(validateHandler, { review, answers: [{ question: '장면?', answer: '실제 답변 확인용: 토끼가 친구를 구했다.' }] });
  assert.equal(result.body.valid, true);
  assert.equal(result.body.source, 'gemini');
});
