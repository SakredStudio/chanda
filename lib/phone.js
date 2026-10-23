// Pure ES module for normalizing Indian and international phone numbers for WhatsApp (no DOM)

/**
 * Normalize a phone number string:
 * - Indian numbers (10 digits, leading 0, +91, 0091, spaces, dashes, parens, dots) -> '91XXXXXXXXXX'
 * - Non-Indian numbers -> digits with country code as typed
 * @param {string} rawInput
 * @returns {string}
 */
export function normalize(rawInput) {
  const str = String(rawInput ?? '').trim();
  if (!str) return '';

  // Remove common visual separators while preserving leading '+'
  const compact = str.replace(/[\s\-().\u00A0]/g, '');

  // Explicit international prefix (+ or 00)
  if (compact.startsWith('+') || compact.startsWith('00')) {
    const withoutPlus = compact.startsWith('+') ? compact.slice(1) : compact.slice(2);
    const digitsOnly = withoutPlus.replace(/\D/g, '');

    if (digitsOnly.startsWith('91')) {
      let rest = digitsOnly.slice(2);
      if (rest.length === 11 && rest.startsWith('0')) {
        rest = rest.slice(1);
      }
      if (rest.length === 10) {
        return `91${rest}`;
      }
    }
    return digitsOnly;
  }

  const digits = compact.replace(/\D/g, '');
  if (!digits) return '';

  // 10-digit Indian number
  if (digits.length === 10) {
    return `91${digits}`;
  }
  // 11-digit Indian number with leading trunk '0'
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  // 12-digit Indian number already prefixed with '91'
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  // 13-digit '910XXXXXXXXXX'
  if (digits.length === 13 && digits.startsWith('910')) {
    return `91${digits.slice(3)}`;
  }

  // Non-Indian number with country code as typed
  return digits;
}

/**
 * Normalize a phone number and keep the original raw string alongside it.
 * @param {string} rawInput
 * @returns {{ phone: string, rawPhone: string }}
 */
export function parsePhone(rawInput) {
  const rawPhone = String(rawInput ?? '').trim();
  return {
    phone: normalize(rawPhone),
    rawPhone
  };
}
