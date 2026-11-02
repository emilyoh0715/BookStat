import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let rows, failWrite, failRead, resolveInsert, delayInsert, authCallback;
const baseBook = { id: 'book-1', user_id: 'user-1', title: '첫 책', author: '작가', language: 'korean', status: 'reading', created_at: '2026-09-12', notes: [], vocab: [] };
const clone = value => structuredClone(value);
function query() {
  let operation = 'select', value, id;
  const result = {
    select() { return result; }, order() { return result; }, single() { return result; },
    insert(next) { operation = 'insert'; value = next; return result; },
    update(next) { operation = 'update'; value = next; return result; },
    delete() { operation = 'delete'; return result; },
    eq(_column, next) { id = next; return result; },
    async then(resolve, reject) {
      try {
        if (operation === 'insert' && delayInsert) await new Promise(r => { resolveInsert = r; });
        if ((operation !== 'select' && failWrite) || (operation === 'select' && failRead)) return resolve({ data: null, error: { message: 'network failed' } });
        let data;
        if (operation === 'select') data = id ? rows.find(b => b.id === id) : rows;
        if (operation === 'insert') { rows.unshift(clone(value)); data = value; }
        if (operation === 'update') {
          const book = rows.find(b => b.id === id);
          if (!book) return resolve({ data: null, error: { message: 'not found' } });
          Object.assign(book, clone(value)); data = book;
        }
        if (operation === 'delete') { data = rows.find(b => b.id === id); rows = rows.filter(b => b.id !== id); }
        return resolve({ data: clone(data), error: null });
      } catch (error) { return reject(error); }
    },
  };
  return result;
}
globalThis.__bookstatTestSupabase = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
    onAuthStateChange(callback) { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  },
  from: query,
  channel() { const channel = { on() { return channel; }, subscribe() { return channel; } }; return channel; },
  removeChannel() {},
};
const { useBooks } = await import('../node_modules/.tmp/test-useBooks.mjs');
let root, current;
async function mount() {
  rows = [clone(baseBook)]; failWrite = false; failRead = false; delayInsert = false;
  function Probe() { current = useBooks(); return null; }
  await act(async () => { root = create(React.createElement(Probe)); });
}
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test('failed book insertion rejects and does not display a phantom book', async () => {
  await mount(); failWrite = true;
  await act(async () => { await assert.rejects(current.addBook({ title: '새 책', author: '', language: 'korean', status: 'reading' }, 'user-1')); });
  assert.equal(current.books.length, 1);
  assert.ok(current.error);
});

test('failed updates and notes keep the previously saved record', async () => {
  await mount(); failWrite = true;
  await act(async () => {
    assert.equal(await current.updateBook('book-1', { title: '수정' }), false);
    assert.equal(await current.addNote('book-1', { content: '내 생각' }), false);
  });
  assert.equal(current.books[0].title, '첫 책');
  assert.equal(current.books[0].notes.length, 0);
});

test('concurrent local note additions do not overwrite each other', async () => {
  await mount();
  await act(async () => {
    assert.deepEqual(await Promise.all([
      current.addNote('book-1', { content: '첫 번째' }),
      current.addNote('book-1', { content: '두 번째' }),
    ]), [true, true]);
  });
  assert.deepEqual(current.books[0].notes.map(n => n.content), ['첫 번째', '두 번째']);
});

test('successful insertion is shown only after the database acknowledges it', async () => {
  await mount(); delayInsert = true;
  let saving;
  await act(async () => { saving = current.addBook({ title: '새 책', author: '', language: 'korean', status: 'reading' }, 'user-1'); });
  assert.equal(current.books.length, 1);
  await act(async () => { resolveInsert(); await saving; });
  assert.equal(current.books.length, 2);
});

test('failed refresh keeps the existing library and exposes retry feedback', async () => {
  await mount(); failRead = true;
  await act(async () => { await current.refetchBooks(); });
  assert.equal(current.books.length, 1);
  assert.ok(current.error);
  assert.equal(current.loading, false);
});

test('logout clears the displayed library', async () => {
  await mount();
  await act(async () => { authCallback('SIGNED_OUT', null); });
  assert.equal(current.books.length, 0);
});

test('a late save after logout cannot restore the previous account library', async () => {
  await mount(); delayInsert = true;
  let saving;
  await act(async () => { saving = current.addBook({ title: '늦은 저장', author: '', language: 'korean', status: 'reading' }, 'user-1'); });
  await act(async () => { authCallback('SIGNED_OUT', null); });
  await act(async () => { resolveInsert(); await assert.rejects(saving); });
  assert.equal(current.books.length, 0);
});
