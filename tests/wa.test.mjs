import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_LINK, SHARE_LINE, link, buildNudgeMessage, buildSummaryText } from '../lib/wa.js';

test('wa.link: encodes Hindi Devanagari text, emojis, ampersands, and appends APP_LINK share line', () => {
  const msg = '🪔 दिवाली पूजा & प्रसाद — ₹501 बाकी हैं!';
  const url = link('+91 98765 43210', msg);

  assert.ok(url.startsWith('https://wa.me/919876543210?text='));
  const encodedPart = url.split('?text=')[1];
  // Ampersand and Devanagari must be percent-encoded in URL query
  assert.ok(encodedPart.includes('%26'), 'Expected & to be encoded as %26');
  assert.ok(!encodedPart.includes(' '), 'Expected spaces to be encoded');

  const decoded = decodeURIComponent(encodedPart);
  assert.ok(decoded.includes('🪔 दिवाली पूजा & प्रसाद — ₹501 बाकी हैं!'));
  assert.ok(decoded.endsWith(`— sent with Chanda · ${APP_LINK}`));
});

test('wa.buildNudgeMessage: builds localized Hindi, English, and Hinglish messages with growth loop footer', () => {
  const collection = {
    id: 'c1',
    type: 'festival',
    title: 'दिवाली पूजा',
    amountMode: 'perPerson',
    amountPerPersonPaise: 50100,
    people: [
      { id: 'p1', name: 'प्रिया शर्मा', status: 'paid' },
      { id: 'p2', name: 'सुनीता राव', status: 'pending' }
    ]
  };

  const hiMsg = buildNudgeMessage({
    collection,
    person: collection.people[1],
    lang: 'hi',
    vpa: 'rahul@okaxis'
  });

  assert.ok(hiMsg.includes('🪔 *दिवाली पूजा*'));
  assert.ok(hiMsg.includes('सुनीता राव'));
  assert.ok(hiMsg.includes('₹501'));
  assert.ok(hiMsg.includes('बाकी'));
  assert.ok(hiMsg.includes('rahul@okaxis'));
  assert.ok(hiMsg.endsWith(SHARE_LINE));

  const summary = buildSummaryText({ collection, lang: 'hinglish', vpa: 'rahul@okaxis' });
  assert.ok(summary.includes('✓ *Mil gaye (1):*'));
  assert.ok(summary.includes('○ *Baaki (1):*'));
  assert.ok(summary.endsWith(SHARE_LINE));
});
