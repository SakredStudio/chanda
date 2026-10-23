import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUPPORTED_LANGS,
  DEFAULT_LANG,
  registerTranslations,
  t,
  validateTranslationTables,
  normalizeLang
} from '../lib/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, '..', 'i18n');

const tables = {
  en: JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8')),
  hi: JSON.parse(fs.readFileSync(path.join(i18nDir, 'hi.json'), 'utf8')),
  hinglish: JSON.parse(fs.readFileSync(path.join(i18nDir, 'hinglish.json'), 'utf8'))
};

test('i18n: all three language JSON files have identical keys and non-empty values', () => {
  const res = validateTranslationTables(tables);
  assert.equal(res.valid, true);
  assert.ok(res.keyCount >= 40, `Expected at least 40 translation keys, got ${res.keyCount}`);
});

test('i18n: hinglish table contains Roman script only (no Devanagari characters)', () => {
  const devanagariRegex = /[\u0900-\u097F]/;
  for (const [key, val] of Object.entries(tables.hinglish)) {
    assert.equal(
      devanagariRegex.test(val),
      false,
      `Hinglish key "${key}" unexpectedly contains Devanagari: "${val}"`
    );
  }
});

test('i18n: registerTranslations and t() lookup with interpolation', () => {
  for (const lang of SUPPORTED_LANGS) {
    registerTranslations(lang, tables[lang]);
  }
  assert.equal(t('en', 'homeTitle'), 'My Collections');
  assert.equal(t('hi', 'homeTitle'), 'मेरे चंदे');
  assert.equal(t('hinglish', 'homeTitle'), 'Mere Chande');

  assert.equal(t('en', 'ofAmount', { amount: '₹20,000' }), 'of ₹20,000');
  assert.equal(t('hi', 'ofAmount', { amount: '₹20,000' }), '₹20,000 में से');
  assert.equal(t('hinglish', 'ofAmount', { amount: '₹20,000' }), '₹20,000 mein se');
});

test('i18n: throws on missing key and normalizes unknown language to default', () => {
  assert.equal(normalizeLang('fr'), DEFAULT_LANG);
  assert.throws(() => t('en', 'nonExistentKey_12345'), /Missing translation key/);
});
