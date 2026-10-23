import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTotalAmount, computeTally, getPersonSharePaise } from '../lib/tally.js';

test('tally: per-person collection computes paid, pending, collectedPaise, totalPaise, and percent', () => {
  const col = {
    id: 'col_farewell',
    type: 'gift',
    title: 'Office Farewell',
    amountMode: 'perPerson',
    amountPerPersonPaise: 100000, // ₹1,000
    people: Array.from({ length: 20 }, (_, i) => ({
      id: `p_${i + 1}`,
      name: `Person ${i + 1}`,
      status: i < 14 ? 'paid' : 'pending'
    }))
  };

  const t = computeTally(col);
  assert.equal(t.totalCount, 20);
  assert.equal(t.paidCount, 14);
  assert.equal(t.pendingCount, 6);
  assert.equal(t.collectedPaise, 1400000); // ₹14,000
  assert.equal(t.totalPaise, 2000000); // ₹20,000
  assert.equal(t.pendingPaise, 600000); // ₹6,000
  assert.equal(t.percent, 70);
});

test('tally: splitTotalAmount distributes remainder paise accurately so shares sum to exact total', () => {
  // ₹100.00 (10000 paise) split among 3 people -> 3334 + 3333 + 3333 = 10000 paise
  const split = splitTotalAmount(10000, 3);
  assert.equal(split.baseAmountPaise, 3333);
  assert.equal(split.remainderPaise, 1);
  assert.deepEqual(split.shares, [3334, 3333, 3333]);
  assert.equal(split.shares.reduce((a, b) => a + b, 0), 10000);

  // ₹1,000.00 (100000 paise) split among 7 people -> 100000 = 14285 * 7 + 5
  const split7 = splitTotalAmount(100000, 7);
  assert.equal(split7.remainderPaise, 5);
  assert.equal(split7.shares.length, 7);
  assert.equal(split7.shares.reduce((a, b) => a + b, 0), 100000);
});

test('tally: total-mode collection splits total across people with remainder paise and sums to exact total when all paid', () => {
  const col = {
    id: 'col_trip',
    type: 'trip',
    title: 'Cab Split',
    amountMode: 'total',
    totalTargetPaise: 10000, // ₹100.00 across 3 people
    people: [
      { id: 'p1', name: 'A', status: 'paid' },
      { id: 'p2', name: 'B', status: 'pending' },
      { id: 'p3', name: 'C', status: 'paid' }
    ]
  };

  assert.equal(getPersonSharePaise(col, col.people[0], 0), 3334);
  assert.equal(getPersonSharePaise(col, col.people[1], 1), 3333);
  assert.equal(getPersonSharePaise(col, col.people[2], 2), 3333);

  const partial = computeTally(col);
  assert.equal(partial.collectedPaise, 3334 + 3333);
  assert.equal(partial.totalPaise, 10000);
  assert.equal(partial.pendingPaise, 3333);

  // Mark 2nd person paid -> collected equals exact 10000 paise
  col.people[1].status = 'paid';
  const full = computeTally(col);
  assert.equal(full.collectedPaise, 10000);
  assert.equal(full.pendingPaise, 0);
  assert.equal(full.percent, 100);
});
