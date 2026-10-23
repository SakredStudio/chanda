// Pure ES module for INR currency formatting, paise conversion, avatars, and type icons (no DOM)

export const AVATAR_PALETTE = [
  '#E8A33D',
  '#5B7FD6',
  '#C0567E',
  '#3DA39A',
  '#7A6FD0',
  '#1FA85B',
  '#D98441'
];

export const TYPE_EMOJIS = {
  gift: '🎁',
  festival: '🪔',
  trip: '✈️',
  condolence: '🕯️',
  party: '🎉',
  other: '➕'
};

const inrWholeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const inrDecimalFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Format an integer amount in paise as Indian Rupees (₹1,00,000 or ₹1,00,000.00).
 * @param {number} paise - integer amount in paise (e.g. 10000000 = ₹1,00,000.00)
 * @param {{ decimals?: boolean }} [options]
 * @returns {string}
 */
export function inr(paise, options = {}) {
  if (typeof paise !== 'number' || !Number.isFinite(paise)) {
    throw new TypeError('Amount in paise must be a finite number');
  }
  const intPaise = Math.round(paise);
  const rupees = intPaise / 100;
  const hasFractionalPaise = Math.abs(intPaise % 100) !== 0;
  const showDecimals = options.decimals === true || (options.decimals !== false && hasFractionalPaise);

  if (showDecimals) {
    return inrDecimalFormatter.format(rupees);
  }
  return inrWholeFormatter.format(rupees);
}

/**
 * Convert rupees (number or numeric string) to integer paise.
 * @param {number|string} rupees
 * @returns {number}
 */
export function rupeesToPaise(rupees) {
  const num = typeof rupees === 'string' ? Number(rupees.replace(/,/g, '').trim()) : Number(rupees);
  if (!Number.isFinite(num) || num < 0) {
    throw new RangeError('Rupees must be a non-negative finite number');
  }
  return Math.round(num * 100);
}

/**
 * Convert integer paise to rupees.
 * @param {number} paise
 * @returns {number}
 */
export function paiseToRupees(paise) {
  if (typeof paise !== 'number' || !Number.isFinite(paise)) {
    throw new TypeError('Paise must be a finite number');
  }
  return Math.round(paise) / 100;
}

/**
 * Deterministically pick an avatar background color from the README palette by hashing the name.
 * @param {string} name
 * @returns {string}
 */
export function avatarColor(name) {
  const str = String(name || '').trim();
  if (!str) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/**
 * Extract single uppercase initial for avatar circle.
 * @param {string} name
 * @returns {string}
 */
export function avatarInitial(name) {
  const str = String(name || '').trim();
  if (!str) return '?';
  const chars = Array.from(str);
  return chars[0].toUpperCase();
}

/**
 * Return emoji for collection type.
 * @param {string} type
 * @returns {string}
 */
export function typeEmoji(type) {
  return TYPE_EMOJIS[type] || TYPE_EMOJIS.other;
}
