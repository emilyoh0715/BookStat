import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeReview } from '../src/services/completeReview.ts';

const book = { id: 'book-1', userId: 'user-1', title: '토끼 이야기', status: 'reading' };
const submission = {
  rating: 4, childEmotion: 'moving',
  childAnswers: [{ question: '기억에 남는 장면은?', answer: '토끼가 친구를 구했다.' }],
  review: '토끼가 친구를 구하려고 위험을 무릅쓰는 장면이 기억에 남았다. 나도 친구가 어려울 때 도와주고 싶다.',
};
function setup(verdict = { valid: true, source: 'gemini' }, saved = true) {
  const events = [];
  const deps = {
    now: new Date(2026, 8, 12, 10), finishedPoints: 5, reviewPoints: 15,
    validate: async () => { events.push('validate'); return verdict; },
    save: async (_id, updates) => { events.push(['save', updates]); return saved; },
    award: async (_id, reason) => { events.push(reason); return true; },
  };
  return { deps, events };
}

test('rejected review neither saves nor finishes the book nor awards any points', async () => {
  const { deps, events } = setup({ valid: false, source: 'gemini', reason: '구체적인 내용을 적어주세요.' });
  await assert.rejects(completeReview(book, submission, deps), /구체적인/);
  assert.deepEqual(events, ['validate']);
});

test('uncertain, local-only, and contradictory approvals cannot complete a review', async () => {
  for (const verdict of [
    { valid: false, uncertain: true },
    { valid: true, source: 'local' },
    { valid: true, source: 'gemini', uncertain: true },
    { valid: true },
  ]) {
    const { deps, events } = setup(verdict);
    await assert.rejects(completeReview(book, submission, deps));
    assert.deepEqual(events, ['validate']);
  }
});

test('validation timeout leaves the book and points untouched', async () => {
  const { deps, events } = setup();
  deps.validate = async () => { events.push('validate'); throw new Error('timeout'); };
  await assert.rejects(completeReview(book, submission, deps), /timeout/);
  assert.deepEqual(events, ['validate']);
});

test('save failure after approval does not award either kind of points', async () => {
  const { deps, events } = setup(undefined, false);
  await assert.rejects(completeReview(book, submission, deps), /저장/);
  assert.equal(events.length, 2);
  assert.equal(events[0], 'validate');
  assert.equal(events[1][0], 'save');
});

test('successful completion validates, saves the exact approved text, then awards points', async () => {
  const { deps, events } = setup();
  const result = await completeReview(book, submission, deps);
  assert.equal(events[0], 'validate');
  assert.equal(events[1][0], 'save');
  assert.equal(events[1][1].review, submission.review);
  assert.equal(events[1][1].status, 'finished');
  assert.equal(events[1][1].finishDate, '2026-09-12');
  assert.deepEqual(events.slice(2), ['book_finished', 'review_approved']);
  assert.deepEqual(result, { newlyFinished: true, pointsAwarded: 20, pointsPending: false });
});

test('points failure is reported as pending, not as a successful award', async () => {
  const { deps } = setup(); deps.award = async () => false;
  assert.deepEqual(await completeReview(book, submission, deps), { newlyFinished: true, pointsAwarded: 0, pointsPending: true });
});

test('already finished books do not receive a new completion award', async () => {
  const { deps, events } = setup();
  const result = await completeReview({ ...book, status: 'finished', finishDate: '2026-09-01' }, submission, deps);
  assert.equal(events.includes('book_finished'), false);
  assert.equal(result.newlyFinished, false);
  assert.equal(result.pointsAwarded, 15);
});
