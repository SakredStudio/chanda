import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlayBillingAvailable, getProPrice, hasProPurchase, buyPro, PRO_SKU, PRO_PRICE_FALLBACK } from '../lib/billing.js';

function fakeWindow({ purchases = [], showResult = 'ok' } = {}) {
  const completed = [];
  const svc = {
    getDetails: async (ids) => ids.map((itemId) => ({ itemId, price: { currency: 'INR', value: '149.00' } })),
    listPurchases: async () => purchases
  };
  class PaymentRequest {
    constructor(methods) { this.sku = methods[0].data.sku; }
    async show() {
      if (showResult === 'abort') { const e = new Error('user closed'); e.name = 'AbortError'; throw e; }
      return { details: { purchaseToken: 'tok_' + this.sku }, complete: async (r) => { completed.push(r); } };
    }
  }
  return { win: { getDigitalGoodsService: async () => svc, PaymentRequest }, completed };
}

test('billing: unavailable outside the Play TWA (no window / no bridge)', async () => {
  assert.equal(await isPlayBillingAvailable(null), false);
  assert.equal(await isPlayBillingAvailable({}), false);
  assert.equal(await getProPrice({}), PRO_PRICE_FALLBACK);
  assert.equal(await hasProPurchase({}), false);
  await assert.rejects(buyPro({}), (e) => e.code === 'unavailable');
});

test('billing: price from Play, restore from listPurchases, buy acknowledges with complete(success)', async () => {
  const { win, completed } = fakeWindow({ purchases: [{ itemId: PRO_SKU, purchaseToken: 'x' }] });
  assert.equal(await isPlayBillingAvailable(win), true);
  assert.equal(await getProPrice(win), '₹149');
  assert.equal(await hasProPurchase(win), true);
  assert.equal(await buyPro(win), true);
  assert.deepEqual(completed, ['success']);
});

test('billing: user cancel surfaces as code "cancelled"', async () => {
  const { win } = fakeWindow({ showResult: 'abort' });
  await assert.rejects(buyPro(win), (e) => e.code === 'cancelled');
});
