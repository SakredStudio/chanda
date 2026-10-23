// Pure ES module for localStorage persistence ('chanda.v1'), schema migration,
// 3-collection free tier limit, undo history, and JSON backup/restore (no DOM).

import { avatarColor } from './format.js';
import { DEFAULT_LANG, normalizeLang } from './i18n.js';

export const STORAGE_KEY = 'chanda.v1';
export const CURRENT_SCHEMA_VERSION = 1;
export const FREE_COLLECTION_LIMIT = 3;

let lastUndoSnapshot = null;

export function createInitialState() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    collections: [],
    people: [],
    payments: [],
    settings: {
      lang: DEFAULT_LANG,
      hasPickedLang: false,
      vpa: '',
      payeeName: '',
      isPro: false,
      customNudgeTemplate: ''
    }
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Migrate any older or partial state structure to schemaVersion: 1.
 * Identity on valid v1 objects, fills missing arrays/settings safely.
 */
export function migrate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid state data: must be an object');
  }
  const base = createInitialState();
  const settingsIn = data.settings && typeof data.settings === 'object' ? data.settings : {};

  const collections = Array.isArray(data.collections)
    ? data.collections.map((c) => normalizeCollection(c))
    : [];

  // Reconstruct normalized people & payments mirrors if not present or out of sync
  const { people, payments } = syncMirrorsFromCollections(
    collections,
    Array.isArray(data.people) ? data.people : [],
    Array.isArray(data.payments) ? data.payments : []
  );

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    collections,
    people,
    payments,
    settings: {
      ...base.settings,
      ...settingsIn,
      lang: normalizeLang(settingsIn.lang || base.settings.lang),
      hasPickedLang: Boolean(settingsIn.hasPickedLang),
      vpa: typeof settingsIn.vpa === 'string' ? settingsIn.vpa.trim() : '',
      payeeName: typeof settingsIn.payeeName === 'string' ? settingsIn.payeeName.trim() : '',
      isPro: Boolean(settingsIn.isPro),
      customNudgeTemplate:
        typeof settingsIn.customNudgeTemplate === 'string' ? settingsIn.customNudgeTemplate : ''
    }
  };
}

function normalizeCollection(c) {
  if (!c || typeof c !== 'object') {
    throw new Error('Invalid collection entry');
  }
  const people = Array.isArray(c.people)
    ? c.people.map((p) => {
        const personObj = {
          id: String(p.id || ''),
          name: String(p.name || '').trim(),
          phone: String(p.phone || ''),
          rawPhone: String(p.rawPhone ?? p.phone ?? ''),
          avatarColor: p.avatarColor || avatarColor(p.name || ''),
          status: p.status === 'paid' ? 'paid' : 'pending'
        };
        if (personObj.status === 'paid') {
          personObj.method = p.method || 'cash';
          personObj.paidAt = p.paidAt || null;
        }
        if (typeof p.amountPaise === 'number') {
          personObj.amountPaise = Math.round(p.amountPaise);
        }
        return personObj;
      })
    : [];

  const amountMode = c.amountMode === 'total' ? 'total' : 'perPerson';
  const amountPerPersonPaise =
    typeof c.amountPerPersonPaise === 'number'
      ? Math.round(c.amountPerPersonPaise)
      : typeof c.amountPerPerson === 'number'
        ? Math.round(c.amountPerPerson)
        : 0;
  const totalTargetPaise =
    typeof c.totalTargetPaise === 'number'
      ? Math.round(c.totalTargetPaise)
      : amountPerPersonPaise * people.length;

  return {
    id: String(c.id || ''),
    type: String(c.type || 'gift'),
    title: String(c.title || '').trim(),
    amountMode,
    amountPerPersonPaise,
    totalTargetPaise,
    deadline: c.deadline ? String(c.deadline) : '',
    status: c.status === 'archived' ? 'archived' : 'active',
    createdAt: c.createdAt || new Date().toISOString(),
    people
  };
}

function syncMirrorsFromCollections(collections, existingPeople = [], existingPayments = []) {
  const people = [];
  const paymentsByPersonId = new Map();
  for (const pay of existingPayments) {
    if (pay && pay.personId) {
      paymentsByPersonId.set(`${pay.collectionId}:${pay.personId}`, pay);
    }
  }
  const payments = [];

  for (const col of collections) {
    for (const p of col.people) {
      const mirrorPerson = {
        id: p.id,
        collectionId: col.id,
        name: p.name,
        phone: p.phone,
        rawPhone: p.rawPhone,
        avatarColor: p.avatarColor,
        status: p.status,
        amountPaise: p.amountPaise ?? col.amountPerPersonPaise
      };
      if (p.status === 'paid') {
        mirrorPerson.method = p.method || 'cash';
        mirrorPerson.paidAt = p.paidAt || null;
      }
      people.push(mirrorPerson);
      if (p.status === 'paid') {
        const key = `${col.id}:${p.id}`;
        const prev = paymentsByPersonId.get(key);
        payments.push({
          id: prev?.id || `pay_${col.id}_${p.id}`,
          collectionId: col.id,
          personId: p.id,
          amountPaise: p.amountPaise ?? col.amountPerPersonPaise,
          method: p.method || 'cash',
          paidAt: p.paidAt || prev?.paidAt || null
        });
      }
    }
  }
  return { people, payments };
}

export function loadState(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== 'function') {
    return createInitialState();
  }
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return createInitialState();
  }
  try {
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch {
    return createInitialState();
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  const migrated = migrate(state);
  if (storage && typeof storage.setItem === 'function') {
    storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  }
  return migrated;
}

export function updateSettings(state, partialSettings, storage = globalThis.localStorage) {
  const next = migrate({
    ...state,
    settings: {
      ...state.settings,
      ...partialSettings
    }
  });
  return saveState(next, storage);
}

export function getActiveCollectionsCount(state) {
  return (state.collections || []).filter((c) => c.status !== 'archived').length;
}

export function canCreateCollection(state) {
  if (state?.settings?.isPro) return true;
  return getActiveCollectionsCount(state) < FREE_COLLECTION_LIMIT;
}

export function addCollection(state, collectionInput, storage = globalThis.localStorage) {
  if (!canCreateCollection(state)) {
    const err = new Error('Free tier limit of 3 active collections reached');
    err.code = 'PRO_LIMIT_REACHED';
    throw err;
  }
  const id = collectionInput.id || `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = collectionInput.createdAt || new Date().toISOString();
  const people = (collectionInput.people || []).map((p, idx) => ({
    id: p.id || `p_${id}_${idx + 1}`,
    name: String(p.name || '').trim(),
    phone: String(p.phone || ''),
    rawPhone: String(p.rawPhone ?? p.phone ?? ''),
    avatarColor: p.avatarColor || avatarColor(p.name || ''),
    status: p.status === 'paid' ? 'paid' : 'pending',
    method: p.status === 'paid' ? p.method || 'cash' : undefined,
    paidAt: p.status === 'paid' ? p.paidAt || createdAt : undefined,
    amountPaise: typeof p.amountPaise === 'number' ? Math.round(p.amountPaise) : undefined
  }));

  const newCol = normalizeCollection({
    ...collectionInput,
    id,
    createdAt,
    people
  });

  const next = migrate({
    ...state,
    collections: [newCol, ...(state.collections || [])]
  });
  return saveState(next, storage);
}

export function deleteCollection(state, collectionId, storage = globalThis.localStorage) {
  const next = migrate({
    ...state,
    collections: (state.collections || []).filter((c) => c.id !== collectionId)
  });
  return saveState(next, storage);
}

/**
 * Mark a person as paid or pending, recording an exact snapshot for undo.
 */
export function setPersonPaymentStatus(
  state,
  { collectionId, personId, status, method = 'cash', paidAt = new Date().toISOString() },
  storage = globalThis.localStorage
) {
  const currentMigrated = migrate(state);
  const col = currentMigrated.collections.find((c) => c.id === collectionId);
  if (!col) {
    throw new Error(`Collection not found: ${collectionId}`);
  }
  const person = col.people.find((p) => p.id === personId);
  if (!person) {
    throw new Error(`Person not found: ${personId}`);
  }

  // Record exact deep snapshot before mutation so undo restores exact previous state & timestamps
  lastUndoSnapshot = {
    previousState: deepClone(currentMigrated),
    meta: {
      collectionId,
      personId,
      personName: person.name,
      newStatus: status,
      method: status === 'paid' ? method : undefined,
      paidAt: status === 'paid' ? paidAt : undefined
    }
  };

  const nextCollections = currentMigrated.collections.map((c) => {
    if (c.id !== collectionId) return c;
    return {
      ...c,
      people: c.people.map((p) => {
        if (p.id !== personId) return p;
        if (status === 'paid') {
          return {
            ...p,
            status: 'paid',
            method: method || 'cash',
            paidAt
          };
        } else {
          const copy = { ...p, status: 'pending' };
          delete copy.method;
          delete copy.paidAt;
          return copy;
        }
      })
    };
  });

  const next = migrate({
    ...currentMigrated,
    collections: nextCollections
  });
  return saveState(next, storage);
}

export function getUndoMeta() {
  return lastUndoSnapshot ? deepClone(lastUndoSnapshot.meta) : null;
}

export function clearUndo() {
  lastUndoSnapshot = null;
}

/**
 * Restore the exact previous state (including original timestamps and payment records) from before the last payment toggle.
 */
export function undoLastAction(storage = globalThis.localStorage) {
  if (!lastUndoSnapshot || !lastUndoSnapshot.previousState) {
    return null;
  }
  const restored = deepClone(lastUndoSnapshot.previousState);
  lastUndoSnapshot = null;
  if (storage && typeof storage.setItem === 'function') {
    storage.setItem(STORAGE_KEY, JSON.stringify(restored));
  }
  return restored;
}

export function exportBackupJson(state) {
  const clean = migrate(state);
  return JSON.stringify(clean, null, 2);
}

export function importBackupJson(jsonString, storage = globalThis.localStorage) {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    throw new Error('Backup content must be a non-empty JSON string');
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON in backup file');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Backup root must be a JSON object');
  }
  if (typeof parsed.schemaVersion !== 'number' || !Array.isArray(parsed.collections)) {
    throw new Error('Backup missing required Chanda fields (schemaVersion, collections)');
  }
  const migrated = migrate(parsed);
  return saveState(migrated, storage);
}
