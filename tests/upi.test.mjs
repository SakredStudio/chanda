import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidVpa, build, renderQrSvg } from '../lib/upi.js';

test('upi.isValidVpa: validates something@handle loosely', () => {
  assert.equal(isValidVpa('rahul@okaxis'), true);
  assert.equal(isValidVpa('priya.sharma_99@ybl'), true);
  assert.equal(isValidVpa('9876543210@paytm'), true);
  assert.equal(isValidVpa(''), false);
  assert.equal(isValidVpa('rahul'), false);
  assert.equal(isValidVpa('@okaxis'), false);
  assert.equal(isValidVpa('rahul@'), false);
  assert.equal(isValidVpa('rahul @okaxis'), false);
});

test('upi.build: builds URL-encoded upi://pay string and throws on missing/invalid VPA', () => {
  const uri = build({
    vpa: 'rahul@okaxis',
    payeeName: 'Rahul & Friends',
    amountPaise: 50100,
    collectionName: 'Diwali Pooja 2026'
  });

  assert.equal(
    uri,
    'upi://pay?pa=rahul@okaxis&pn=Rahul%20%26%20Friends&am=501&cu=INR&tn=Diwali%20Pooja%202026'
  );

  // Fractional paise
  const uriDec = build({
    vpa: 'temple@sbi',
    payeeName: 'मंदिर समिति',
    amountPaise: 10050,
    collectionName: 'प्रसाद & चंदा'
  });
  assert.ok(uriDec.includes('pa=temple@sbi'));
  assert.ok(uriDec.includes('am=100.50'));
  assert.ok(uriDec.includes('cu=INR'));
  assert.ok(uriDec.includes(encodeURIComponent('मंदिर समिति')));
  assert.ok(uriDec.includes(encodeURIComponent('प्रसाद & चंदा')));

  // Missing or invalid VPA throws
  assert.throws(() => build({ vpa: '', payeeName: 'Rahul', amountPaise: 50000 }), /UPI VPA/);
  assert.throws(() => build({ vpa: 'invalid-vpa', payeeName: 'Rahul', amountPaise: 50000 }), /UPI VPA/);
});

test('upi.renderQrSvg: renders a valid SVG QR code from UPI URI', () => {
  const uri = build({
    vpa: 'rahul@okaxis',
    payeeName: 'Rahul',
    amountPaise: 50100,
    collectionName: 'Diwali'
  });
  const svg = renderQrSvg(uri);
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('</svg>'));
});
