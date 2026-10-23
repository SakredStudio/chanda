import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  CURRENT_SCHEMA_VERSION,
  createInitialState,
  migrate,
  loadState,
  saveState,
  updateSettings,
  addCollection,
  setPersonPaymentStatus,
  undoLastAction,
  exportBackupJson,
  importBackupJson,
  canCreateCollection
} from '../lib/store.js';

function createMockStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear()
  };
}

test('store.migrate: normalizes legacy/partial objects into schemaVersion 1', () => {
  const raw = {
    collections: [
      {
        id: 'c1',
        type: 'festival',
        title: 'Diwali Pooja',
        amountPerPerson: 50100,
        people: [
          { id: 'p1', name: 'Priya Sharma', status: 'paid', method: 'cash', paidAt: '2026-10-22T10:00:00.000Z' },
          { id: 'p2', name: 'Sunita Rao', status: 'pending' }
        ]
      }
    ],
    settings: { lang: 'hi' }
  };

  const migrated = migrate(raw);
  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.settings.lang, 'hi');
  assert.equal(migrated.settings.isPro, false);
  assert.equal(migrated.collections.length, 1);
  assert.equal(migrated.collections[0].amountPerPersonPaise, 50100);
  assert.equal(migrated.people.length, 2);
  assert.equal(migrated.payments.length, 1);
  assert.equal(migrated.payments[0].personId, 'p1');
  assert.equal(migrated.payments[0].paidAt, '2026-10-22T10:00:00.000Z');
});

test('store: undoLastAction restores exact previous state including timestamps', () => {
  const storage = createMockStorage();
  let state = createInitialState();
  state = addCollection(
    state,
    {
      id: 'col_1',
      type: 'gift',
      title: 'Office Farewell',
      amountPerPersonPaise: 100000,
      createdAt: '2026-10-20T08:00:00.000Z',
      people: [
        {
          id: 'p_1',
          name: 'Priya Sharma',
          phone: '919876543210',
          status: 'paid',
          method: 'cash',
          paidAt: '2026-10-21T09:15:30.123Z'
        },
        {
          id: 'p_2',
          name: 'Sunita Rao',
          phone: '919876543211',
          status: 'pending'
        }
      ]
    },
    storage
  );

  const snapshotBefore = JSON.parse(storage.getItem(STORAGE_KEY));

  // Mark Sunita paid
  const afterMark = setPersonPaymentStatus(
    state,
    {
      collectionId: 'col_1',
      personId: 'p_2',
      status: 'paid',
      method: 'online',
      paidAt: '2026-10-22T14:22:11.999Z'
    },
    storage
  );
  assert.equal(afterMark.collections[0].people[1].status, 'paid');
  assert.equal(afterMark.collections[0].people[1].paidAt, '2026-10-22T14:22:11.999Z');
  assert.equal(afterMark.payments.length, 2);

  // Undo and verify exact match including Priya's original timestamp and Sunita's pending state
  const restored = undoLastAction(storage);
  assert.deepEqual(restored, snapshotBefore);
  assert.deepEqual(loadState(storage), snapshotBefore);
});

test('store: enforces 3 active collection limit on free tier and allows unlimited when isPro = true', () => {
  const storage = createMockStorage();
  let state = createInitialState();

  state = addCollection(state, { id: 'c1', title: 'One', amountPerPersonPaise: 10000, people: [] }, storage);
  state = addCollection(state, { id: 'c2', title: 'Two', amountPerPersonPaise: 10000, people: [] }, storage);
  state = addCollection(state, { id: 'c3', title: 'Three', amountPerPersonPaise: 10000, people: [] }, storage);

  assert.equal(canCreateCollection(state), false);
  assert.throws(
    () => addCollection(state, { id: 'c4', title: 'Four', amountPerPersonPaise: 10000, people: [] }, storage),
    (err) => err.code === 'PRO_LIMIT_REACHED'
  );

  // Enabling isPro allows 4th collection
  state = updateSettings(state, { isPro: true }, storage);
  assert.equal(canCreateCollection(state), true);
  state = addCollection(state, { id: 'c4', title: 'Four', amountPerPersonPaise: 10000, people: [] }, storage);
  assert.equal(state.collections.length, 4);
});

test('store: exportBackupJson -> wipe -> importBackupJson restores everything identically', () => {
  const storage = createMockStorage();
  let state = createInitialState();
  state = updateSettings(state, { lang: 'hi', vpa: 'rahul@okaxis', hasPickedLang: true }, storage);
  state = addCollection(
    state,
    {
      id: 'c_diwali',
      type: 'festival',
      title: 'Diwali Pooja',
      amountPerPersonPaise: 50100,
      people: [{ id: 'p1', name: 'Amit Kumar', status: 'paid', method: 'online', paidAt: '2026-10-22T12:00:00.000Z' }]
    },
    storage
  );

  const json = exportBackupJson(state);
  storage.clear();
  assert.equal(loadState(storage).collections.length, 0);

  const restored = importBackupJson(json, storage);
  assert.deepEqual(restored, state);
});
