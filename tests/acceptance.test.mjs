import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SUPPORTED_LANGS,
  registerTranslations,
  t
} from '../lib/i18n.js';
import {
  createInitialState,
  loadState,
  addCollection,
  setPersonPaymentStatus,
  undoLastAction,
  exportBackupJson,
  importBackupJson
} from '../lib/store.js';
import { computeTally } from '../lib/tally.js';
import { inr, rupeesToPaise } from '../lib/format.js';
import { parsePhone } from '../lib/phone.js';
import { link as waLink, buildNudgeMessage, APP_LINK } from '../lib/wa.js';
import { build as buildUpi, renderQrSvg } from '../lib/upi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..');

function createMockStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear()
  };
}

test('acceptance: every t(lang, key) referenced in app.js exists in all 3 language files', () => {
  const tables = {};
  for (const lang of SUPPORTED_LANGS) {
    tables[lang] = JSON.parse(
      fs.readFileSync(path.join(appDir, 'i18n', `${lang}.json`), 'utf8')
    );
    registerTranslations(lang, tables[lang]);
  }

  const appJs = fs.readFileSync(path.join(appDir, 'app.js'), 'utf8');
  const literalKeyMatches = [...appJs.matchAll(/\bt\(\s*\w+\s*,\s*'([a-zA-Z0-9_]+)'/g)];
  assert.ok(literalKeyMatches.length >= 25, 'Expected to find static t() calls in app.js');

  for (const m of literalKeyMatches) {
    const key = m[1];
    for (const lang of SUPPORTED_LANGS) {
      assert.doesNotThrow(
        () => t(lang, key),
        `Key "${key}" used in app.js is missing in ${lang}.json`
      );
    }
  }

  // Also check dynamic type_* and preset_* keys
  for (const tp of ['gift', 'festival', 'trip', 'condolence', 'party', 'other']) {
    for (const lang of SUPPORTED_LANGS) {
      assert.ok(t(lang, `type_${tp}`).length > 0);
      assert.ok(t(lang, `type_${tp}_sub`).length > 0);
      assert.ok(t(lang, `preset_${tp}`).length > 0);
    }
  }
});

test('acceptance: create ₹501 × 12-person Diwali collection, mark 3 paid, undo one, reload -> state is exact', () => {
  const storage = createMockStorage();
  let state = createInitialState();

  const people = Array.from({ length: 12 }, (_, idx) => {
    const { phone, rawPhone } = parsePhone(`+91 98765 432${String(10 + idx).padStart(2, '0')}`);
    return {
      id: `p_${idx + 1}`,
      name: `Member ${idx + 1}`,
      phone,
      rawPhone,
      status: 'pending'
    };
  });

  state = addCollection(
    state,
    {
      id: 'col_diwali_501',
      type: 'festival',
      title: 'Diwali Pooja',
      amountMode: 'perPerson',
      amountPerPersonPaise: rupeesToPaise(501), // 50100 paise
      people
    },
    storage
  );

  // Mark 3 paid with explicit timestamps
  state = setPersonPaymentStatus(
    state,
    {
      collectionId: 'col_diwali_501',
      personId: 'p_1',
      status: 'paid',
      method: 'cash',
      paidAt: '2026-10-22T18:01:00.000Z'
    },
    storage
  );
  state = setPersonPaymentStatus(
    state,
    {
      collectionId: 'col_diwali_501',
      personId: 'p_2',
      status: 'paid',
      method: 'online',
      paidAt: '2026-10-22T18:02:00.000Z'
    },
    storage
  );
  state = setPersonPaymentStatus(
    state,
    {
      collectionId: 'col_diwali_501',
      personId: 'p_3',
      status: 'paid',
      method: 'cash',
      paidAt: '2026-10-22T18:03:00.000Z'
    },
    storage
  );

  // Undo the 3rd mark-paid
  const undoneState = undoLastAction(storage);
  assert.ok(undoneState);

  // Simulate page reload from localStorage
  const reloadedState = loadState(storage);
  assert.deepEqual(reloadedState, undoneState);

  const col = reloadedState.collections[0];
  const tally = computeTally(col);
  assert.equal(tally.totalCount, 12);
  assert.equal(tally.paidCount, 2);
  assert.equal(tally.pendingCount, 10);
  assert.equal(tally.collectedPaise, 100200); // ₹1,002
  assert.equal(tally.totalPaise, 601200); // ₹6,012
  assert.equal(inr(tally.collectedPaise), '₹1,002');
  assert.equal(inr(tally.totalPaise), '₹6,012');
  assert.equal(col.people[0].paidAt, '2026-10-22T18:01:00.000Z');
  assert.equal(col.people[1].paidAt, '2026-10-22T18:02:00.000Z');
  assert.equal(col.people[2].status, 'pending');
  assert.equal(col.people[2].paidAt, undefined);

  // Verify Hindi nudge message & wa.me link for pending person 3
  const hiMsg = buildNudgeMessage({
    collection: col,
    person: col.people[2],
    personIndex: 2,
    lang: 'hi',
    vpa: 'rahul@okaxis'
  });
  const waHref = waLink(col.people[2].phone, hiMsg);
  assert.ok(waHref.startsWith('https://wa.me/919876543212?text='));
  const decoded = decodeURIComponent(waHref.split('?text=')[1]);
  assert.ok(decoded.includes('₹501'));
  assert.ok(decoded.includes('बाकी'));
  assert.ok(decoded.endsWith(`— sent with Chanda · ${APP_LINK}`));

  // Verify UPI QR URI & SVG
  const upiUri = buildUpi({
    vpa: 'rahul@okaxis',
    payeeName: 'Rahul Sharma',
    amountPaise: 50100,
    collectionName: col.title
  });
  assert.equal(
    upiUri,
    'upi://pay?pa=rahul@okaxis&pn=Rahul%20Sharma&am=501&cu=INR&tn=Diwali%20Pooja'
  );
  const qrSvg = renderQrSvg(upiUri);
  assert.ok(qrSvg.startsWith('<svg'));

  // Backup export -> wipe -> import restores everything
  const backup = exportBackupJson(reloadedState);
  storage.clear();
  assert.equal(loadState(storage).collections.length, 0);
  const imported = importBackupJson(backup, storage);
  assert.deepEqual(imported, reloadedState);
});

test('acceptance: PWA manifest and sw.js cache list reference existing relative files (sub-path ready)', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(appDir, 'manifest.webmanifest'), 'utf8')
  );
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith('./'), `Icon src must be relative: ${icon.src}`);
    const iconDiskPath = path.join(appDir, icon.src.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(iconDiskPath), `Missing icon file on disk: ${icon.src}`);
  }

  const swCode = fs.readFileSync(path.join(appDir, 'sw.js'), 'utf8');
  const assetMatches = [...swCode.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]);
  assert.ok(assetMatches.length >= 25, 'Expected sw.js to pre-cache all shell assets');

  for (const relPath of assetMatches) {
    if (relPath === './') continue;
    const diskPath = path.join(appDir, relPath.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(diskPath), `sw.js asset missing on disk: ${relPath}`);
  }
});
