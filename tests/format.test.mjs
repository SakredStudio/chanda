import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inr,
  rupeesToPaise,
  paiseToRupees,
  avatarColor,
  avatarInitial,
  typeEmoji,
  AVATAR_PALETTE
} from '../lib/format.js';

test('format.inr: formats Indian currency with lakhi/crore grouping (₹1,00,000 and ₹1,00,000.00)', () => {
  // 1,00,000 rupees = 10,000,000 paise
  assert.equal(inr(10000000), '₹1,00,000');
  assert.equal(inr(10000000, { decimals: true }), '₹1,00,000.00');
  assert.equal(inr(10000050), '₹1,00,000.50');
  assert.equal(inr(50000), '₹500');
  assert.equal(inr(50100), '₹501');
  assert.equal(inr(1400000), '₹14,000');
  assert.equal(inr(0), '₹0');
  assert.equal(inr(0, { decimals: true }), '₹0.00');
});

test('format: rupeesToPaise and paiseToRupees round-trip accurately', () => {
  assert.equal(rupeesToPaise(501), 50100);
  assert.equal(rupeesToPaise('1,00,000'), 10000000);
  assert.equal(rupeesToPaise('500.50'), 50050);
  assert.equal(paiseToRupees(1400000), 14000);
});

test('format: avatarColor and avatarInitial', () => {
  const color = avatarColor('Priya Sharma');
  assert.ok(AVATAR_PALETTE.includes(color));
  assert.equal(avatarColor('Priya Sharma'), color); // deterministic
  assert.equal(avatarInitial('priya Sharma'), 'P');
  assert.equal(avatarInitial('अमित कुमार'), 'अ');
  assert.equal(typeEmoji('festival'), '🪔');
  assert.equal(typeEmoji('gift'), '🎁');
});
