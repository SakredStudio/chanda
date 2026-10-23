// Pure ES module for WhatsApp deep links (wa.me), localized nudge messages, and group summary text (no DOM)

import { normalize } from './phone.js';
import { inr, typeEmoji } from './format.js';
import { computeTally, getPersonSharePaise } from './tally.js';

export const APP_LINK = 'https://sakredstudio.ca/chanda';
export const SHARE_LINE = `— sent with Chanda · ${APP_LINK}`;

/**
 * Ensure any outbound WhatsApp message ends with the mandatory Chanda share line.
 * @param {string} msg
 * @returns {string}
 */
export function ensureShareLine(msg) {
  const body = String(msg ?? '').trim();
  if (body.endsWith(SHARE_LINE)) {
    return body;
  }
  return body ? `${body}\n${SHARE_LINE}` : SHARE_LINE;
}

/**
 * Build a `https://wa.me/<digits>?text=<encoded>` link.
 * Properly URL-encodes Hindi Devanagari, emojis, ampersands, and newlines,
 * and appends the growth-loop share line (`— sent with Chanda · ${APP_LINK}`).
 * @param {string} phoneInput
 * @param {string} messageText
 * @returns {string}
 */
export function link(phoneInput, messageText) {
  const digits = normalize(phoneInput);
  const fullText = ensureShareLine(messageText);
  const encoded = encodeURIComponent(fullText);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/**
 * Compose a localized WhatsApp nudge message for a pending person or collection.
 */
export function buildNudgeMessage({
  collection,
  person = null,
  personIndex = 0,
  lang = 'hinglish',
  vpa = '',
  customTemplate = ''
}) {
  const tally = computeTally(collection);
  const emoji = typeEmoji(collection?.type);
  const title = collection?.title || 'Chanda';
  const sharePaise = person
    ? getPersonSharePaise(collection, person, personIndex)
    : tally.perPersonDisplayPaise;
  const amountStr = inr(sharePaise);
  const collectedStr = inr(tally.collectedPaise);
  const totalStr = inr(tally.totalPaise);
  const personName = person?.name ? String(person.name).trim() : '';

  if (customTemplate && customTemplate.trim()) {
    const filled = customTemplate
      .replace(/\{name\}/g, personName)
      .replace(/\{title\}/g, title)
      .replace(/\{amount\}/g, amountStr)
      .replace(/\{collected\}/g, collectedStr)
      .replace(/\{total\}/g, totalStr)
      .replace(/\{vpa\}/g, vpa || '');
    return ensureShareLine(filled);
  }

  const lines = [];
  if (lang === 'hi') {
    lines.push(`${emoji} *${title}*`);
    lines.push(
      personName
        ? `नमस्ते ${personName}, आपके ${amountStr} *बाकी* हैं।`
        : `आपके ${amountStr} *बाकी* हैं।`
    );
    lines.push(`अब तक: *${collectedStr} / ${totalStr}* (${tally.paidCount}/${tally.totalCount} ✓)`);
  } else if (lang === 'en') {
    lines.push(`${emoji} *${title}*`);
    lines.push(
      personName
        ? `Hi ${personName}, your ${amountStr} contribution is *pending*.`
        : `Your ${amountStr} contribution is *pending*.`
    );
    lines.push(
      `Collected so far: *${collectedStr} / ${totalStr}* (${tally.paidCount}/${tally.totalCount} ✓)`
    );
  } else {
    // hinglish default
    lines.push(`${emoji} *${title}*`);
    lines.push(
      personName
        ? `Namaste ${personName}, aapke ${amountStr} *baaki* hain.`
        : `Aapke ${amountStr} *baaki* hain.`
    );
    lines.push(`Abhi tak: *${collectedStr} / ${totalStr}* (${tally.paidCount}/${tally.totalCount} ✓)`);
  }

  if (vpa && String(vpa).trim()) {
    lines.push(`UPI: *${String(vpa).trim()}*`);
  }

  return ensureShareLine(lines.join('\n'));
}

/**
 * Compose a shareable group summary showing total collected, who paid (✓) and who is pending (○).
 */
export function buildSummaryText({ collection, lang = 'hinglish', vpa = '' }) {
  const tally = computeTally(collection);
  const emoji = typeEmoji(collection?.type);
  const title = collection?.title || 'Chanda';
  const collectedStr = inr(tally.collectedPaise);
  const totalStr = inr(tally.totalPaise);

  const lines = [`${emoji} *${title}*`, `${collectedStr} / ${totalStr} (${tally.paidCount}/${tally.totalCount} ✓)`];

  if (tally.paidPeople.length > 0) {
    const label = lang === 'hi' ? 'मिल गए' : lang === 'en' ? 'Paid' : 'Mil gaye';
    lines.push(`\n✓ *${label} (${tally.paidPeople.length}):*`);
    for (const p of tally.paidPeople) {
      lines.push(`• ${p.name}`);
    }
  }

  if (tally.pendingPeople.length > 0) {
    const label = lang === 'hi' ? 'बाकी' : lang === 'en' ? 'Pending' : 'Baaki';
    lines.push(`\n○ *${label} (${tally.pendingPeople.length}):*`);
    for (const p of tally.pendingPeople) {
      lines.push(`• ${p.name}`);
    }
  }

  if (vpa && String(vpa).trim()) {
    lines.push(`\nUPI: *${String(vpa).trim()}*`);
  }

  return ensureShareLine(lines.join('\n'));
}
