import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, addCollection, addPeopleToCollection, deleteCollection, wipeAllData, migrate, updateSettings, STORAGE_KEY } from '../lib/store.js';

function mem() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m }; }

test('store: addPeopleToCollection appends pending people with ids and keeps existing ones', () => {
  const st = mem();
  let state = addCollection(createInitialState(), { id: 'c1', type: 'gift', title: 'Gift', amountMode: 'perPerson', amountPerPersonPaise: 50000, people: [{ id: 'p1', name: 'A', phone: '919876543210' }] }, st);
  state = addPeopleToCollection(state, 'c1', [{ name: 'B', phone: '919876543211', rawPhone: '98765 43211' }, { name: '   ' }], st);
  const col = state.collections[0];
  assert.equal(col.people.length, 2);
  assert.equal(col.people[1].name, 'B');
  assert.equal(col.people[1].status, 'pending');
  assert.ok(col.people[1].id);
  assert.equal(state.people.length, 2);
  assert.throws(() => addPeopleToCollection(state, 'nope', [{ name: 'X' }], st));
});

test('store: deleteCollection removes it and its people mirror; wipeAllData clears storage but keeps lang + theme', () => {
  const st = mem();
  let state = addCollection(createInitialState(), { id: 'c1', type: 'gift', title: 'Gift', amountMode: 'perPerson', amountPerPersonPaise: 100, people: [{ id: 'p1', name: 'A' }] }, st);
  state = addCollection(state, { id: 'c2', type: 'trip', title: 'Trip', amountMode: 'perPerson', amountPerPersonPaise: 100, people: [{ id: 'p2', name: 'B' }] }, st);
  state = deleteCollection(state, 'c1', st);
  assert.deepEqual(state.collections.map((c) => c.id), ['c2']);
  assert.deepEqual(state.people.map((p) => p.id), ['p2']);
  state = updateSettings(state, { lang: 'hi', theme: 'dark', vpa: 'x@okaxis', isPro: true }, st);
  state = wipeAllData(state, st);
  assert.equal(state.collections.length, 0);
  assert.equal(state.settings.vpa, '');
  assert.equal(state.settings.isPro, false);
  assert.equal(state.settings.lang, 'hi');
  assert.equal(state.settings.theme, 'dark');
  assert.ok(st.map.get(STORAGE_KEY).includes('"theme":"dark"'));
});

test('store: theme setting migrates safely', () => {
  assert.equal(migrate({ schemaVersion: 1, collections: [] }).settings.theme, 'system');
  assert.equal(migrate({ schemaVersion: 1, collections: [], settings: { theme: 'dark' } }).settings.theme, 'dark');
  assert.equal(migrate({ schemaVersion: 1, collections: [], settings: { theme: 'neon' } }).settings.theme, 'system');
});
