import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, parsePhone } from '../lib/phone.js';

test('phone.normalize: normalizes 10 Indian formats to 91XXXXXXXXXX', () => {
  const expected = '919876543210';
  const indianFormats = [
    '9876543210',               // 1. plain 10 digits
    '98765 43210',              // 2. space in middle
    '98765-43210',              // 3. dash in middle
    '09876543210',              // 4. leading trunk 0
    '098765 43210',             // 5. leading 0 + space
    '+919876543210',            // 6. +91 no space
    '+91 98765 43210',          // 7. +91 with spaces
    '+91-98765-43210',          // 8. +91 with dashes
    '919876543210',             // 9. 91 prefix 12 digits
    '0091 9876543210',          // 10. 0091 international prefix
    '(+91) 098765-43210',       // 11. parens + trunk 0
    '98765.43210'               // 12. dot separator
  ];

  for (const input of indianFormats) {
    assert.equal(normalize(input), expected, `Failed for Indian format: "${input}"`);
  }
});

test('phone.normalize: preserves non-Indian foreign numbers with country code as typed', () => {
  // Foreign format 1: US/Canada (+1)
  assert.equal(normalize('+1 (416) 555-0199'), '14165550199');
  // Foreign format 2: UK (+44)
  assert.equal(normalize('+44 7700 900077'), '447700900077');
  // Foreign format 3: UAE (00971)
  assert.equal(normalize('00971-50-123-4567'), '971501234567');
});

test('phone.parsePhone: keeps rawPhone alongside normalized phone', () => {
  const res = parsePhone('+91 98765 43210');
  assert.equal(res.phone, '919876543210');
  assert.equal(res.rawPhone, '+91 98765 43210');
});
