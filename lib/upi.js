// Pure ES module for UPI payment URI building, VPA validation, and SVG QR code generation (no DOM)

import { qrcode } from '../vendor/qrcode.js';

const VPA_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;

/**
 * Loosely validate a UPI Virtual Payment Address (`something@handle`).
 * @param {string} vpa
 * @returns {boolean}
 */
export function isValidVpa(vpa) {
  if (typeof vpa !== 'string') return false;
  const trimmed = vpa.trim();
  if (!trimmed || trimmed.length < 3) return false;
  return VPA_REGEX.test(trimmed);
}

/**
 * Build a standard NPCI UPI deep-link URI:
 * `upi://pay?pa=<vpa>&pn=<payee name>&am=<amount>&cu=INR&tn=<collection name>`
 * All parameters are URL-encoded; throws if VPA is missing or invalid.
 * @param {{
 *   vpa?: string,
 *   pa?: string,
 *   payeeName?: string,
 *   pn?: string,
 *   amountPaise?: number,
 *   am?: number|string,
 *   collectionName?: string,
 *   tn?: string
 * }} params
 * @returns {string}
 */
export function build(params = {}) {
  const rawVpa = String(params.vpa ?? params.pa ?? '').trim();
  if (!isValidVpa(rawVpa)) {
    throw new Error('Missing or invalid UPI VPA (expected format: name@handle)');
  }

  const rawPayee = String(params.payeeName ?? params.pn ?? '').trim();
  const rawNote = String(params.collectionName ?? params.tn ?? '').trim();

  let amountRupeesStr = '';
  if (typeof params.amountPaise === 'number' && Number.isFinite(params.amountPaise)) {
    const rupees = Math.max(0, Math.round(params.amountPaise)) / 100;
    amountRupeesStr = Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
  } else if (params.am !== undefined && params.am !== null && String(params.am).trim() !== '') {
    const num = Number(params.am);
    if (!Number.isFinite(num) || num < 0) {
      throw new Error('Invalid UPI amount');
    }
    amountRupeesStr = String(params.am).trim();
  } else {
    amountRupeesStr = '0';
  }

  const paEnc = encodeURIComponent(rawVpa).replace(/%40/g, '@');
  const pnEnc = encodeURIComponent(rawPayee);
  const amEnc = encodeURIComponent(amountRupeesStr);
  const tnEnc = encodeURIComponent(rawNote);

  return `upi://pay?pa=${paEnc}&pn=${pnEnc}&am=${amEnc}&cu=INR&tn=${tnEnc}`;
}

/**
 * Generate an inline SVG string for a UPI URI using the vendored MIT qrcode-generator.
 * @param {string} upiUri
 * @param {number} [cellSize=3]
 * @returns {string}
 */
export function renderQrSvg(upiUri, cellSize = 3) {
  if (!upiUri || typeof upiUri !== 'string') {
    throw new Error('UPI URI string is required to generate QR SVG');
  }
  const qr = qrcode(0, 'M');
  qr.addData(upiUri);
  qr.make();
  return qr.createSvgTag({ cellSize, margin: 1, scalable: true });
}
