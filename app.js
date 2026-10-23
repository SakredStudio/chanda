// Chanda Collector — P5: PWA Service Worker, Install Prompt, Settings (Language, UPI ID, Backup/Restore, About, Privacy Note)
import {
  SUPPORTED_LANGS,
  registerTranslations,
  t,
  normalizeLang
} from './lib/i18n.js';
import {
  loadState,
  updateSettings,
  addCollection,
  deleteCollection,
  canCreateCollection,
  setPersonPaymentStatus,
  undoLastAction,
  clearUndo,
  exportBackupJson,
  importBackupJson
} from './lib/store.js';
import {
  inr,
  rupeesToPaise,
  avatarColor,
  avatarInitial,
  typeEmoji
} from './lib/format.js';
import { computeTally, getPersonSharePaise } from './lib/tally.js';
import { parsePhone } from './lib/phone.js';
import {
  link as waLink,
  buildNudgeMessage,
  buildSummaryText,
  APP_LINK
} from './lib/wa.js';
import { isValidVpa, build as buildUpiUri, renderQrSvg } from './lib/upi.js';

const WHATSAPP_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.148-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/></svg>`;

const QUICK_SAMPLE_CONTACTS = [
  { name: 'Priya Sharma', phone: '9876543210' },
  { name: 'Amit Kumar', phone: '9876543211' },
  { name: 'Sunita Rao', phone: '9876543212' },
  { name: 'Vikram Singh', phone: '9876543213' },
  { name: 'Neha Gupta', phone: '9876543214' },
  { name: 'Rajesh Verma', phone: '9876543215' },
  { name: 'Kavita Joshi', phone: '9876543216' },
  { name: 'Suresh Nair', phone: '9876543217' },
  { name: 'Pooja Patel', phone: '9876543218' },
  { name: 'Deepak Mehta', phone: '9876543219' },
  { name: 'Anjali Desai', phone: '9876543220' },
  { name: 'Rohan Malhotra', phone: '9876543221' }
];

export function createDefaultDraft() {
  return {
    step: 0,
    type: 'gift',
    title: '',
    titleCustomized: false,
    amountMode: 'perPerson',
    amountStr: '500',
    people: [],
    deadline: '',
    manualMode: true,
    draftName: '',
    draftPhone: '',
    contactMessage: ''
  };
}

export const appContext = {
  state: loadState(),
  route: { name: 'home', params: {} },
  proSheetOpen: false,
  wizard: createDefaultDraft(),
  activeSheetPersonId: null,
  justPaidPersonId: null,
  undoToast: null,
  shareQueueIndex: 0,
  nudgedPersonIds: new Set(),
  copiedTarget: '',
  settingsNotice: '',
  deferredInstallPrompt: null,
  ready: false
};

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function initI18n() {
  await Promise.all(
    SUPPORTED_LANGS.map(async (lang) => {
      const res = await fetch(`./i18n/${lang}.json`);
      if (!res.ok) throw new Error(`Failed to load ./i18n/${lang}.json`);
      const dict = await res.json();
      registerTranslations(lang, dict);
    })
  );
}

export function getLang() {
  return normalizeLang(appContext.state?.settings?.lang);
}

export function setLang(lang, markPicked = true) {
  const norm = normalizeLang(lang);
  appContext.state = updateSettings(appContext.state, {
    lang: norm,
    hasPickedLang: markPicked ? true : appContext.state.settings.hasPickedLang
  });
  if (!appContext.wizard.titleCustomized) {
    appContext.wizard.title = t(norm, `preset_${appContext.wizard.type}`);
  }
  document.documentElement.lang = norm === 'hi' ? 'hi' : 'en';
  renderApp();
}

export function parseHash(hash = window.location.hash) {
  const clean = (hash || '').replace(/^#\/?/, '').trim();
  if (!clean) {
    return {
      name: appContext.state?.settings?.hasPickedLang ? 'home' : 'lang',
      params: {}
    };
  }
  const [name, id] = clean.split('/');
  return { name: name || 'home', params: { id: id || '' } };
}

export function navigate(hash) {
  if (window.location.hash === hash) {
    appContext.route = parseHash(hash);
    renderApp();
  } else {
    window.location.hash = hash;
  }
}

export function renderLanguageToggle() {
  const current = getLang();
  const segments = [
    { code: 'en', label: 'A', title: 'English' },
    { code: 'hi', label: 'अ', title: 'हिंदी' },
    { code: 'hinglish', label: 'Aa', title: 'Hinglish' }
  ];
  return `
    <div class="lang-toggle" role="group" aria-label="Language">
      ${segments
        .map(
          (s) => `
        <button
          type="button"
          class="lang-seg ${current === s.code ? 'active' : ''}"
          data-action="set-lang"
          data-lang="${s.code}"
          title="${s.title}"
          aria-pressed="${current === s.code ? 'true' : 'false'}"
        >${s.label}</button>
      `
        )
        .join('')}
    </div>
  `;
}

export function seedSampleCollections() {
  const lang = getLang();
  const samples = [
    {
      id: 'col_sample_farewell',
      type: 'gift',
      title: t(lang, 'preset_gift'),
      amountMode: 'perPerson',
      amountPerPersonPaise: 100000,
      deadline: '25 October',
      people: [
        { id: 'p1', name: 'Priya Sharma', phone: '919876543210', status: 'paid', method: 'cash' },
        { id: 'p2', name: 'Amit Kumar', phone: '919876543211', status: 'paid', method: 'online' },
        { id: 'p3', name: 'Sunita Rao', phone: '919876543212', status: 'pending' },
        { id: 'p4', name: 'Vikram Singh', phone: '919876543213', status: 'paid', method: 'cash' },
        { id: 'p5', name: 'Neha Gupta', phone: '919876543214', status: 'pending' },
        ...Array.from({ length: 11 }, (_, i) => ({
          id: `p_paid_${i + 6}`,
          name: `Member ${i + 6}`,
          phone: `9198765432${String(15 + i).padStart(2, '0')}`,
          status: 'paid',
          method: i % 2 === 0 ? 'online' : 'cash'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `p_pend_${i + 17}`,
          name: `Member ${i + 17}`,
          phone: `9198765432${String(26 + i).padStart(2, '0')}`,
          status: 'pending'
        }))
      ]
    },
    {
      id: 'col_sample_diwali',
      type: 'festival',
      title: t(lang, 'preset_festival'),
      amountMode: 'perPerson',
      amountPerPersonPaise: 50000,
      people: Array.from({ length: 24 }, (_, i) => ({
        id: `d_${i + 1}`,
        name: `Resident ${i + 1}`,
        phone: `9198111122${String(10 + i).padStart(2, '0')}`,
        status: i < 17 ? 'paid' : 'pending',
        method: 'online'
      }))
    },
    {
      id: 'col_sample_goa',
      type: 'trip',
      title: t(lang, 'preset_trip'),
      amountMode: 'perPerson',
      amountPerPersonPaise: 200000,
      people: Array.from({ length: 15 }, (_, i) => ({
        id: `g_${i + 1}`,
        name: `Friend ${i + 1}`,
        phone: `9198222233${String(10 + i).padStart(2, '0')}`,
        status: i < 11 ? 'paid' : 'pending',
        method: 'online'
      }))
    }
  ];

  for (const s of samples) {
    if (canCreateCollection(appContext.state)) {
      appContext.state = addCollection(appContext.state, s);
    }
  }
  renderApp();
}

function renderLangPickScreen() {
  const current = getLang();
  const options = [
    { code: 'en', tile: 'A', name: 'English', sub: 'Angrezi' },
    { code: 'hi', tile: 'अ', name: 'हिंदी', sub: 'Hindi' },
    { code: 'hinglish', tile: 'Aa', name: 'Hinglish', sub: 'Roman Hindi · easiest' }
  ];

  return `
    <main class="screen" data-screen="lang">
      <div class="lang-hero">
        <div class="logo-tile">💰</div>
        <div style="font-size:25px; font-weight:800; line-height:1.25;">Choose language</div>
        <div style="font-size:21px; font-weight:700; color:#4A4138;">भाषा चुनें</div>
        <div style="font-size:18px; font-weight:600; color:var(--ink-muted);">Bhasha chunein</div>
      </div>

      <div class="lang-card-list" role="radiogroup" aria-label="Choose language">
        ${options
          .map((opt) => {
            const selected = current === opt.code;
            return `
            <button
              type="button"
              class="lang-pick-card ${selected ? 'selected' : ''}"
              data-action="pick-lang-card"
              data-lang="${opt.code}"
              role="radio"
              aria-checked="${selected ? 'true' : 'false'}"
            >
              <div class="lang-pick-tile">${opt.tile}</div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:25px; font-weight:800; line-height:1.15;">${opt.name}</div>
                <div style="font-size:15px; color:var(--ink-muted); font-weight:500;">${opt.sub}</div>
              </div>
              <div class="lang-pick-radio">${selected ? '✓' : ''}</div>
            </button>
          `;
          })
          .join('')}
      </div>

      <div class="bottom-bar">
        <button type="button" class="btn-primary" data-action="lang-continue">
          <span>Next · आगे · Aage</span>
          <span style="font-size:24px;">→</span>
        </button>
      </div>
    </main>
  `;
}

function renderCollectionCard(col, lang) {
  const tally = computeTally(col);
  const emoji = typeEmoji(col.type);
  const collectedStr = inr(tally.collectedPaise);
  const totalStr = inr(tally.totalPaise);

  return `
    <button
      type="button"
      class="collection-card"
      data-action="open-collection"
      data-id="${escapeHtml(col.id)}"
    >
      <div class="collection-card-top">
        <div class="collection-type-icon">${emoji}</div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:20px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(col.title)}</div>
          <div style="font-size:14px; color:var(--ink-muted); font-weight:600;">${t(lang, 'peopleCount', { count: tally.totalCount })}</div>
        </div>
        <div class="collection-pct-chip">${tally.percent}%</div>
      </div>

      <div class="progress-track">
        <div class="progress-fill" style="width:${tally.percent}%;"></div>
      </div>

      <div class="collection-card-bottom">
        <div style="font-size:23px; font-weight:800; color:var(--ink);">
          ${collectedStr} <span style="font-size:15px; color:#9A9085; font-weight:600;">/ ${totalStr}</span>
        </div>
        <div style="font-size:15px; font-weight:700; color:var(--green);">
          ${tally.paidCount}/${tally.totalCount} ✓
        </div>
      </div>
    </button>
  `;
}

function renderProModal(lang) {
  if (!appContext.proSheetOpen) return '';
  return `
    <div class="scrim" data-action="close-pro-sheet">
      <div class="bottom-sheet" onclick="event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <div style="width:50px; height:50px; border-radius:15px; background:var(--saffron-tint); display:grid; place-items:center; font-size:26px;">⭐</div>
          <div style="font-size:21px; font-weight:800;">${t(lang, 'proComingSoonTitle')}</div>
        </div>
        <p style="font-size:16px; color:var(--ink-soft); margin:0 0 20px; line-height:1.45;">
          ${t(lang, 'proLimitMsg')}
        </p>
        <button type="button" class="btn-primary" data-action="close-pro-sheet">
          OK
        </button>
      </div>
    </div>
  `;
}

function renderHomeScreen() {
  const lang = getLang();
  const collections = (appContext.state.collections || []).filter((c) => c.status !== 'archived');

  return `
    <main class="screen" data-screen="home">
      <header class="header-row">
        <div class="header-left">
          <h1 class="screen-title">${t(lang, 'homeTitle')}</h1>
        </div>
        <div class="header-right">
          ${renderLanguageToggle()}
          <button type="button" class="icon-btn" data-action="open-settings" title="${t(lang, 'settings')}" aria-label="${t(lang, 'settings')}">⚙️</button>
        </div>
      </header>

      ${
        collections.length === 0
          ? `
        <div class="empty-card">
          <div style="width:64px; height:64px; border-radius:18px; background:var(--saffron-tint); display:grid; place-items:center; font-size:34px;">💰</div>
          <div style="font-size:20px; font-weight:800;">${t(lang, 'emptyTitle')}</div>
          <div style="font-size:15px; color:var(--ink-muted); max-width:260px;">${t(lang, 'emptySub')}</div>
          <button type="button" class="btn-secondary" style="margin-top:8px;" data-action="seed-samples">
            <span>📋</span>
            <span>${t(lang, 'loadSampleData')}</span>
          </button>
        </div>
      `
          : `
        <div class="collection-list">
          ${collections.map((col) => renderCollectionCard(col, lang)).join('')}
        </div>
      `
      }

      <div class="bottom-bar">
        <button type="button" class="btn-primary" data-action="start-new-collection">
          <span style="font-size:28px; line-height:1;">＋</span>
          <span>${t(lang, 'newCollection')}</span>
        </button>
      </div>
      ${renderProModal(lang)}
    </main>
  `;
}

function renderWizardDots(step) {
  return `
    <div class="wizard-dots" aria-label="Step ${step + 1} of 3">
      <div class="wizard-dot ${step === 0 ? 'active' : ''}"></div>
      <div class="wizard-dot ${step === 1 ? 'active' : ''}"></div>
      <div class="wizard-dot ${step === 2 ? 'active' : ''}"></div>
    </div>
  `;
}

function renderCreateScreen() {
  const lang = getLang();
  const w = appContext.wizard;
  if (!w.title) {
    w.title = t(lang, `preset_${w.type}`);
  }

  const stepTitles = [t(lang, 'whatFor'), t(lang, 'amountEach'), t(lang, 'addPeople')];
  const stepTitle = stepTitles[w.step] || t(lang, 'newCollection');

  let bodyHtml = '';

  if (w.step === 0) {
    const types = ['gift', 'festival', 'trip', 'condolence', 'party', 'other'];
    bodyHtml = `
      <div class="type-grid" role="radiogroup" aria-label="${t(lang, 'whatFor')}">
        ${types
          .map((tp) => {
            const selected = w.type === tp;
            return `
            <button
              type="button"
              class="type-tile ${selected ? 'selected' : ''}"
              data-action="select-type"
              data-type="${tp}"
              role="radio"
              aria-checked="${selected ? 'true' : 'false'}"
            >
              <div style="font-size:44px; line-height:1;">${typeEmoji(tp)}</div>
              <div style="font-size:19px; font-weight:800;">${t(lang, `type_${tp}`)}</div>
              <div style="font-size:13px; color:var(--ink-muted); font-weight:600;">${t(lang, `type_${tp}_sub`)}</div>
            </button>
          `;
          })
          .join('')}
      </div>

      <div style="display:flex; flex-direction:column; gap:6px; margin-top:2px;">
        <label for="collection-title-input" style="font-size:14px; font-weight:800; color:var(--ink-soft);">
          ${t(lang, 'collectionTitleLabel')}
        </label>
        <input
          id="collection-title-input"
          type="text"
          class="text-input"
          value="${escapeHtml(w.title)}"
          placeholder="${escapeHtml(t(lang, `preset_${w.type}`))}"
        />
      </div>

      <div class="bottom-bar">
        <button type="button" class="btn-primary" data-action="wizard-next-step1">
          <span>${t(lang, 'next')}</span>
          <span style="font-size:24px;">→</span>
        </button>
      </div>
    `;
  } else if (w.step === 1) {
    const numericRupees = Number(w.amountStr || '0');
    const formattedAmount = inr(Math.round(numericRupees * 100));
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'];

    bodyHtml = `
      <div class="amount-display-card">
        <div class="mode-pill-group" role="group" aria-label="Amount mode">
          <button
            type="button"
            class="mode-pill ${w.amountMode === 'perPerson' ? 'active' : ''}"
            data-action="set-amount-mode"
            data-mode="perPerson"
          >${t(lang, 'perPerson')}</button>
          <button
            type="button"
            class="mode-pill ${w.amountMode === 'total' ? 'active' : ''}"
            data-action="set-amount-mode"
            data-mode="total"
          >${t(lang, 'totalAmount')}</button>
        </div>

        <div style="font-size:15px; color:var(--ink-muted); font-weight:600;">
          ${w.amountMode === 'perPerson' ? t(lang, 'perPerson') : t(lang, 'totalAmount')}
        </div>

        <div class="amount-big" data-testid="amount-display">
          <span>${formattedAmount}</span>
          <span class="amount-caret"></span>
        </div>
      </div>

      <div class="numpad-grid" role="group" aria-label="Number pad">
        ${keys
          .map(
            (k) => `
          <button
            type="button"
            class="numpad-key ${k === '⌫' ? 'backspace' : ''}"
            data-action="numpad-press"
            data-key="${k}"
          >${k}</button>
        `
          )
          .join('')}
      </div>

      <div class="bottom-bar">
        <button
          type="button"
          class="btn-primary"
          data-action="wizard-next-step2"
          ${numericRupees <= 0 ? 'disabled' : ''}
        >
          <span>${t(lang, 'next')}</span>
          <span style="font-size:24px;">→</span>
        </button>
      </div>
    `;
  } else {
    bodyHtml = `
      <div class="people-source-row">
        <button type="button" class="source-btn active" data-action="pick-contacts">
          <div style="font-size:30px; line-height:1;">📇</div>
          <div style="font-size:15px; font-weight:800;">${t(lang, 'fromContacts')}</div>
        </button>
        <button type="button" class="source-btn" data-action="focus-manual-person">
          <div style="font-size:30px; line-height:1;">⌨️</div>
          <div style="font-size:15px; font-weight:800;">${t(lang, 'typeName')}</div>
        </button>
      </div>

      ${
        w.contactMessage
          ? `<div style="font-size:13px; color:var(--pending-text); background:var(--saffron-tint); padding:8px 12px; border-radius:12px; font-weight:600;">${escapeHtml(w.contactMessage)}</div>`
          : ''
      }

      <form id="manual-person-form" style="background:var(--card-white); border:1px solid var(--card-border); border-radius:16px; padding:12px; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; gap:8px;">
          <input
            id="person-name-input"
            type="text"
            class="text-input"
            style="min-height:48px; flex:1;"
            placeholder="${escapeHtml(t(lang, 'personNamePlaceholder'))}"
            value="${escapeHtml(w.draftName)}"
          />
        </div>
        <div style="display:flex; gap:8px;">
          <input
            id="person-phone-input"
            type="tel"
            class="text-input"
            style="min-height:48px; flex:1;"
            placeholder="${escapeHtml(t(lang, 'personPhonePlaceholder'))}"
            value="${escapeHtml(w.draftPhone)}"
          />
          <button
            type="submit"
            class="btn-primary"
            style="width:auto; min-width:96px; min-height:48px; padding:0 16px; font-size:17px;"
          >${t(lang, 'addPersonBtn')}</button>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; padding-top:2px;">
          <button
            type="button"
            data-action="quick-add-12"
            style="font-size:14px; font-weight:700; color:var(--green-deep); background:var(--green-tint); padding:8px 14px; border-radius:999px; min-height:44px;"
          >+12 Sample Contacts</button>
        </div>
      </form>

      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div style="font-size:16px; font-weight:800; color:#5B5249;">${t(lang, 'addedPeople')}</div>
        <div style="font-size:15px; font-weight:800; color:var(--green); background:var(--green-tint); padding:4px 12px; border-radius:999px;">
          ${w.people.length}
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px; max-height:240px; overflow-y:auto;">
        ${w.people
          .map(
            (p, idx) => `
          <div class="draft-person-row">
            <div class="avatar-circle" style="background:${p.avatarColor}; width:44px; height:44px; min-width:44px;">
              ${escapeHtml(avatarInitial(p.name))}
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:17px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.name)}</div>
              ${p.rawPhone ? `<div style="font-size:13px; color:var(--ink-muted);">${escapeHtml(p.rawPhone)}</div>` : ''}
            </div>
            <button
              type="button"
              class="remove-circle-btn"
              data-action="remove-draft-person"
              data-index="${idx}"
              aria-label="Remove ${escapeHtml(p.name)}"
            >✕</button>
          </div>
        `
          )
          .join('')}
      </div>

      <label class="deadline-card" for="deadline-input">
        <span style="font-size:22px;">📅</span>
        <div style="flex:1; min-width:0;">
          <div style="font-size:13px; color:#9A7B3A; font-weight:600;">${t(lang, 'deadlineOptional')}</div>
          <input
            id="deadline-input"
            type="text"
            value="${escapeHtml(w.deadline)}"
            placeholder="e.g. 25 October / Diwali"
            style="border:none; background:transparent; font-size:17px; font-weight:800; color:#A06A1E; width:100%; outline:none; padding:0;"
          />
        </div>
      </label>

      <div class="bottom-bar">
        <button
          type="button"
          class="btn-primary"
          data-action="wizard-finish"
          ${w.people.length === 0 ? 'disabled' : ''}
        >
          <span style="font-size:24px;">✓</span>
          <span>${t(lang, 'create')}</span>
        </button>
      </div>
    `;
  }

  return `
    <main class="screen" data-screen="create">
      <header class="header-row">
        <div class="header-left">
          <button type="button" class="back-btn" data-action="wizard-back" aria-label="Back">←</button>
          <h1 class="screen-title">${stepTitle}</h1>
        </div>
        <div class="header-right">
          ${renderLanguageToggle()}
        </div>
      </header>

      ${renderWizardDots(w.step)}
      ${bodyHtml}
    </main>
  `;
}

function renderMarkPaidSheet(col, lang) {
  if (!appContext.activeSheetPersonId) return '';
  const idx = col.people.findIndex((p) => p.id === appContext.activeSheetPersonId);
  if (idx === -1) return '';
  const person = col.people[idx];
  const sharePaise = getPersonSharePaise(col, person, idx);
  const amountStr = inr(sharePaise);

  return `
    <div class="scrim" data-action="close-mark-sheet">
      <div class="bottom-sheet" onclick="event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px;">
          <div class="avatar-circle" style="background:${person.avatarColor}; width:50px; height:50px; min-width:50px; font-size:19px;">
            ${escapeHtml(avatarInitial(person.name))}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:20px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(person.name)}</div>
            <div style="font-size:15px; color:var(--ink-muted); font-weight:600;">${t(lang, 'paidQuestion', { amount: amountStr })}</div>
          </div>
        </div>

        <div class="method-choice-row">
          <button
            type="button"
            class="method-tile cash-highlight"
            data-action="confirm-mark-paid"
            data-person-id="${escapeHtml(person.id)}"
            data-method="cash"
          >
            <div style="font-size:34px; line-height:1;">💵</div>
            <div>${t(lang, 'cash')}</div>
          </button>
          <button
            type="button"
            class="method-tile"
            data-action="confirm-mark-paid"
            data-person-id="${escapeHtml(person.id)}"
            data-method="online"
          >
            <div style="font-size:34px; line-height:1;">📱</div>
            <div>${t(lang, 'online')}</div>
          </button>
        </div>

        ${
          person.status === 'paid'
            ? `
          <button
            type="button"
            class="btn-secondary"
            style="margin-top:12px;"
            data-action="confirm-mark-unpaid"
            data-person-id="${escapeHtml(person.id)}"
          >
            <span>○</span>
            <span>${t(lang, 'markUnpaid')}</span>
          </button>
        `
            : ''
        }
      </div>
    </div>
  `;
}

function renderUndoToast(lang) {
  if (!appContext.undoToast) return '';
  const { personName, status } = appContext.undoToast;
  const shortName = String(personName || '').split(' ')[0] || personName;
  const label =
    status === 'paid'
      ? t(lang, 'undoPaidToast', { name: shortName })
      : t(lang, 'undoUnpaidToast', { name: shortName });

  return `
    <div class="undo-toast" role="status" aria-live="polite">
      <span style="font-size:16px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(label)}</span>
      <button type="button" class="undo-btn" data-action="undo-last-payment">
        ${t(lang, 'undo')}
      </button>
    </div>
  `;
}

function renderDetailScreen(collectionId) {
  const lang = getLang();
  const col = (appContext.state.collections || []).find((c) => c.id === collectionId);
  if (!col) {
    return renderHomeScreen();
  }

  const tally = computeTally(col);
  const emoji = typeEmoji(col.type);
  const collectedStr = inr(tally.collectedPaise);
  const totalStr = inr(tally.totalPaise);
  const vpa = appContext.state.settings.vpa || '';
  const customTemplate = appContext.state.settings.isPro
    ? appContext.state.settings.customNudgeTemplate
    : '';

  return `
    <main class="screen" data-screen="detail" data-collection-id="${escapeHtml(col.id)}">
      <header class="header-row">
        <div class="header-left">
          <button type="button" class="back-btn" data-action="go-home" aria-label="Back">←</button>
          <h1 class="screen-title">${emoji} ${escapeHtml(col.title)}</h1>
        </div>
        <div class="header-right">
          ${renderLanguageToggle()}
        </div>
      </header>

      <section class="ring-section">
        <div
          class="progress-ring"
          style="background:conic-gradient(var(--green) 0% ${tally.percent}%, var(--ring-track) ${tally.percent}% 100%);"
        >
          <div class="progress-ring-inner">
            <div style="font-size:14px; color:var(--ink-muted); font-weight:700;">${t(lang, 'collected')}</div>
            <div style="font-size:34px; font-weight:800; color:var(--green); letter-spacing:-1px; line-height:1.1;">${collectedStr}</div>
            <div style="font-size:15px; color:#9A9085; font-weight:600;">${t(lang, 'ofAmount', { amount: totalStr })}</div>
          </div>
        </div>

        <div class="ring-chips">
          <div class="chip-paid">${t(lang, 'paidChip', { count: tally.paidCount })}</div>
          <div class="chip-pending">${t(lang, 'pendingChip', { count: tally.pendingCount })}</div>
        </div>
      </section>

      <section class="person-list" aria-label="People">
        ${col.people
          .map((p, idx) => {
            const isPaid = p.status === 'paid';
            const isJustPaid = isPaid && appContext.justPaidPersonId === p.id;
            const methodLabel =
              p.method === 'online' ? t(lang, 'online') : t(lang, 'cash');
            const subText = isPaid
              ? isJustPaid
                ? `${methodLabel} · ${t(lang, 'justNow')}`
                : methodLabel
              : t(lang, 'pending');

            const nudgeMsg = buildNudgeMessage({
              collection: col,
              person: p,
              personIndex: idx,
              lang,
              vpa,
              customTemplate
            });
            const personWaHref = waLink(p.phone || '', nudgeMsg);

            return `
            <div class="person-row ${isPaid ? (isJustPaid ? 'just-paid' : '') : 'pending'}">
              <button
                type="button"
                class="person-row-main"
                data-action="open-mark-sheet"
                data-person-id="${escapeHtml(p.id)}"
              >
                <div class="avatar-circle" style="background:${p.avatarColor};">
                  ${escapeHtml(avatarInitial(p.name))}
                </div>
                <div style="flex:1; min-width:0;">
                  <div style="font-size:17px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.name)}</div>
                  <div style="font-size:13px; color:${
                    isPaid
                      ? isJustPaid
                        ? 'var(--green-deep)'
                        : 'var(--ink-muted)'
                      : 'var(--pending-text)'
                  }; font-weight:${isPaid ? (isJustPaid ? '700' : '500') : '600'};">
                    ${escapeHtml(subText)}
                  </div>
                </div>
                ${
                  isPaid
                    ? `<div class="status-paid ${isJustPaid ? 'pop' : ''}" aria-label="${t(lang, 'paid')}">✓</div>`
                    : `<div class="status-pending" aria-label="${t(lang, 'pending')}"></div>`
                }
              </button>

              ${
                !isPaid
                  ? `
                <a
                  href="${escapeHtml(personWaHref)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="wa-circle"
                  title="${t(lang, 'remindOnWhatsApp')}"
                  aria-label="${t(lang, 'remindOnWhatsApp')} ${escapeHtml(p.name)}"
                >${WHATSAPP_SVG}</a>
              `
                  : ''
              }
            </div>
          `;
          })
          .join('')}
      </section>

      <div class="bottom-bar">
        <button
          type="button"
          class="btn-wa"
          data-action="open-share-screen"
          data-id="${escapeHtml(col.id)}"
        >
          ${WHATSAPP_SVG}
          <span>${
            tally.pendingCount > 0
              ? t(lang, 'remindAllCount', { count: tally.pendingCount })
              : t(lang, 'remindAll')
          }</span>
        </button>
      </div>

      ${renderMarkPaidSheet(col, lang)}
      ${renderUndoToast(lang)}
    </main>
  `;
}

function renderShareScreen(collectionId) {
  const lang = getLang();
  const col = (appContext.state.collections || []).find((c) => c.id === collectionId);
  if (!col) {
    return renderHomeScreen();
  }

  const tally = computeTally(col);
  const pendingList = tally.pendingPeople;
  if (appContext.shareQueueIndex >= pendingList.length) {
    appContext.shareQueueIndex = 0;
  }
  const currentPerson = pendingList[appContext.shareQueueIndex] || null;
  const currentPersonIdxInCol = currentPerson
    ? col.people.findIndex((p) => p.id === currentPerson.id)
    : 0;
  const sharePaise = currentPerson
    ? getPersonSharePaise(col, currentPerson, currentPersonIdxInCol)
    : tally.perPersonDisplayPaise;

  const vpa = appContext.state.settings.vpa || '';
  const payeeName = appContext.state.settings.payeeName || 'Organizer';
  const customTemplate = appContext.state.settings.isPro
    ? appContext.state.settings.customNudgeTemplate
    : '';

  const previewMsg = buildNudgeMessage({
    collection: col,
    person: currentPerson,
    personIndex: currentPersonIdxInCol,
    lang,
    vpa,
    customTemplate
  });

  let qrContentHtml = '';
  if (isValidVpa(vpa)) {
    const upiUri = buildUpiUri({
      vpa,
      payeeName,
      amountPaise: sharePaise,
      collectionName: col.title
    });
    qrContentHtml = renderQrSvg(upiUri, 3);
  } else {
    // No fallback VPA ever: the organizer must set their own UPI ID in Settings.
    qrContentHtml = `<button type="button" data-action="open-settings" style="font-size:12px; color:var(--pending-text); text-align:center; padding:8px; min-height:44px; font-weight:700; line-height:1.35;">${t(lang, vpa ? 'vpaInvalid' : 'vpaMissing')}</button>`;
  }

  return `
    <main class="screen" data-screen="share" data-collection-id="${escapeHtml(col.id)}">
      <header class="header-row">
        <div class="header-left">
          <button
            type="button"
            class="back-btn"
            data-action="back-to-detail"
            data-id="${escapeHtml(col.id)}"
            aria-label="Back"
          >←</button>
          <h1 class="screen-title">${t(lang, 'remindTitle')}</h1>
        </div>
        <div class="header-right">
          ${renderLanguageToggle()}
        </div>
      </header>

      ${
        pendingList.length > 0
          ? `
        <div class="pending-queue-strip" role="list" aria-label="Pending people queue">
          ${pendingList
            .map((p, i) => {
              const isCurrent = i === appContext.shareQueueIndex;
              const isNudged = appContext.nudgedPersonIds.has(p.id);
              return `
              <button
                type="button"
                class="queue-person-chip ${isCurrent ? 'current' : ''} ${isNudged ? 'nudged' : ''}"
                data-action="select-share-person"
                data-index="${i}"
              >
                <span>${isNudged ? '✓' : `${i + 1}.`}</span>
                <span>${escapeHtml(p.name.split(' ')[0])}</span>
              </button>
            `;
            })
            .join('')}
        </div>
      `
          : ''
      }

      <div style="font-size:15px; font-weight:800; color:var(--ink-muted); margin-bottom:-6px;">
        ${t(lang, 'messagePreview')}
      </div>
      <div class="wa-bubble-preview" data-testid="wa-message-preview">${escapeHtml(previewMsg)}</div>

      <div class="upi-qr-row">
        <div class="upi-card">
          <label for="share-vpa-input" style="font-size:13px; color:var(--ink-muted); font-weight:700;">
            ${t(lang, 'upiId')}
          </label>
          <input
            id="share-vpa-input"
            type="text"
            value="${escapeHtml(vpa)}"
            placeholder="name@okaxis"
            style="border:none; border-bottom:1.5px dashed var(--btn-border); background:transparent; font-size:18px; font-weight:800; color:var(--green-deep); width:100%; min-height:44px; outline:none; padding:4px 0;"
          />
          <button
            type="button"
            data-action="copy-vpa"
            style="font-size:13px; color:var(--ink-muted); font-weight:700; text-align:left; min-height:44px; display:flex; align-items:center;"
          >
            ${appContext.copiedTarget === 'vpa' ? t(lang, 'copied') : t(lang, 'tapToCopy')}
          </button>
        </div>

        <div class="qr-card">
          <div class="qr-box" data-testid="upi-qr-box">
            ${qrContentHtml}
          </div>
          <div style="font-size:12px; color:var(--ink-muted); font-weight:700;">${t(lang, 'scanToPay')}</div>
        </div>
      </div>

      <div class="summary-link-card">
        <span style="font-size:22px;">🔗</span>
        <div style="flex:1; min-width:0;">
          <div style="font-size:13px; color:#5577BB; font-weight:700;">${t(lang, 'liveTally')}</div>
          <div style="font-size:15px; font-weight:800; color:#3D5FA8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHtml(APP_LINK.replace(/^https?:\/\//, ''))}
          </div>
        </div>
        <button type="button" class="copy-pill-btn" data-action="copy-summary">
          ${appContext.copiedTarget === 'summary' ? t(lang, 'copied') : t(lang, 'copy')}
        </button>
      </div>

      <div class="bottom-bar">
        ${
          currentPerson
            ? `
          <button
            type="button"
            class="btn-wa"
            data-action="send-next-pending"
            data-id="${escapeHtml(col.id)}"
          >
            ${WHATSAPP_SVG}
            <span>${t(lang, 'nextPendingPerson', {
              name: currentPerson.name.split(' ')[0],
              index: appContext.shareQueueIndex + 1,
              total: pendingList.length
            })}</span>
          </button>
        `
            : `
          <button
            type="button"
            class="btn-wa"
            data-action="share-summary-wa"
            data-id="${escapeHtml(col.id)}"
          >
            ${WHATSAPP_SVG}
            <span>${t(lang, 'sendOnWhatsApp')}</span>
          </button>
        `
        }
        <div style="font-size:14px; color:#9A8B79; text-align:center; font-weight:600;">
          ${t(lang, 'pendingBatchCaption', { count: pendingList.length })}
        </div>
      </div>
    </main>
  `;
}

function renderSettingsScreen() {
  const lang = getLang();
  const s = appContext.state.settings;

  return `
    <main class="screen" data-screen="settings">
      <header class="header-row">
        <div class="header-left">
          <button type="button" class="back-btn" data-action="go-home" aria-label="Back">←</button>
          <h1 class="screen-title">${t(lang, 'settings')}</h1>
        </div>
        <div class="header-right">
          ${renderLanguageToggle()}
        </div>
      </header>

      ${
        appContext.deferredInstallPrompt
          ? `
        <button type="button" class="btn-primary" data-action="trigger-install-pwa">
          <span>📲</span>
          <span>${t(lang, 'installApp')}</span>
        </button>
      `
          : ''
      }

      ${
        appContext.settingsNotice
          ? `
        <div style="background:var(--green-tint); border:1.5px solid var(--green); color:var(--green-deep); padding:10px 14px; border-radius:14px; font-weight:700; font-size:15px;">
          ${escapeHtml(appContext.settingsNotice)}
        </div>
      `
          : ''
      }

      <section style="background:var(--card-white); border:1px solid var(--card-border); border-radius:20px; padding:16px; display:flex; flex-direction:column; gap:12px;">
        <div style="font-size:16px; font-weight:800; color:var(--ink);">💳 ${t(lang, 'upiId')}</div>

        <div style="display:flex; flex-direction:column; gap:4px;">
          <label for="settings-payee-input" style="font-size:13px; font-weight:700; color:var(--ink-soft);">
            ${t(lang, 'payeeNameLabel')}
          </label>
          <input
            id="settings-payee-input"
            type="text"
            class="text-input"
            value="${escapeHtml(s.payeeName || '')}"
            placeholder="e.g. Rahul Sharma"
          />
        </div>

        <div style="display:flex; flex-direction:column; gap:4px;">
          <label for="settings-vpa-input" style="font-size:13px; font-weight:700; color:var(--ink-soft);">
            ${t(lang, 'vpaLabel')}
          </label>
          <input
            id="settings-vpa-input"
            type="text"
            class="text-input"
            value="${escapeHtml(s.vpa || '')}"
            placeholder="rahul@okaxis"
          />
        </div>

        <button type="button" class="btn-primary" style="min-height:54px; font-size:18px;" data-action="save-upi-settings">
          <span>✓</span>
          <span>${t(lang, 'save')}</span>
        </button>
      </section>

      <section style="background:var(--card-white); border:1px solid var(--card-border); border-radius:20px; padding:16px; display:flex; flex-direction:column; gap:10px;">
        <button type="button" class="btn-secondary" data-action="export-backup">
          <span>⬇️</span>
          <span>${t(lang, 'exportBackup')}</span>
        </button>

        <button type="button" class="btn-secondary" data-action="trigger-import-backup">
          <span>⬆️</span>
          <span>${t(lang, 'importBackup')}</span>
        </button>
        <input
          id="backup-file-input"
          type="file"
          accept=".json,application/json"
          style="display:none;"
        />

        <button type="button" class="btn-secondary" data-action="export-csv">
          <span>📊</span>
          <span>${t(lang, 'exportCsv')} ⭐</span>
        </button>
      </section>

      <section style="background:var(--card-white); border:1px solid var(--card-border); border-radius:20px; padding:16px; display:flex; flex-direction:column; gap:6px;">
        <div style="font-size:16px; font-weight:800; color:var(--ink);">🔒 ${t(lang, 'aboutTitle')} · v1.0</div>
        <p style="margin:0; font-size:14px; color:var(--ink-soft); font-weight:600; line-height:1.45;">
          ${t(lang, 'privacyNote')}
        </p>
        <a href="./privacy.html" target="_blank" rel="noopener" style="font-size:14px; font-weight:700; color:var(--green-deep); min-height:44px; display:inline-flex; align-items:center;">${t(lang, 'privacyPolicy')} →</a>
      </section>

      ${renderProModal(lang)}
    </main>
  `;
}

export function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;
  const route = appContext.route;

  if (route.name === 'lang') {
    root.innerHTML = renderLangPickScreen();
  } else if (route.name === 'create') {
    root.innerHTML = renderCreateScreen();
  } else if (route.name === 'detail') {
    root.innerHTML = renderDetailScreen(route.params.id);
  } else if (route.name === 'share') {
    root.innerHTML = renderShareScreen(route.params.id);
  } else if (route.name === 'settings') {
    root.innerHTML = renderSettingsScreen();
  } else {
    root.innerHTML = renderHomeScreen();
  }

  bindEvents(root);
}

function handleNumpadInput(key) {
  let cur = appContext.wizard.amountStr || '';
  if (key === '⌫') {
    cur = cur.slice(0, -1);
  } else if (key === '00') {
    if (cur && cur !== '0' && cur.length <= 5) {
      cur += '00';
    }
  } else if (/^\d$/.test(key)) {
    if (cur === '0') {
      cur = key;
    } else if (cur.length < 7) {
      cur += key;
    }
  }
  appContext.wizard.amountStr = cur || '0';
  renderApp();
}

function addDraftPerson(name, phoneStr) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return;
  const { phone, rawPhone } = parsePhone(phoneStr || '');
  appContext.wizard.people.push({
    id: `dp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    phone,
    rawPhone,
    avatarColor: avatarColor(cleanName),
    status: 'pending'
  });
}

function triggerUndoToast(personName, status) {
  if (appContext.undoToast && appContext.undoToast.timerId) {
    clearTimeout(appContext.undoToast.timerId);
  }
  const timerId = setTimeout(() => {
    appContext.undoToast = null;
    appContext.justPaidPersonId = null;
    clearUndo();
    renderApp();
  }, 5000);

  appContext.undoToast = { personName, status, timerId };
}

async function copyText(text, targetKey) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // Fallback ignored in headless
  }
  appContext.copiedTarget = targetKey;
  renderApp();
  setTimeout(() => {
    if (appContext.copiedTarget === targetKey) {
      appContext.copiedTarget = '';
      renderApp();
    }
  }, 2000);
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function bindEvents(root) {
  root.querySelectorAll('[data-action="set-lang"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.getAttribute('data-lang'), true);
    });
  });

  root.querySelectorAll('[data-action="pick-lang-card"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.getAttribute('data-lang'), false);
    });
  });

  root.querySelectorAll('[data-action="lang-continue"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appContext.state = updateSettings(appContext.state, {
        lang: getLang(),
        hasPickedLang: true
      });
      navigate('#home');
    });
  });

  root.querySelectorAll('[data-action="go-home"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appContext.settingsNotice = '';
      navigate('#home');
    });
  });

  root.querySelectorAll('[data-action="seed-samples"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      seedSampleCollections();
    });
  });

  root.querySelectorAll('[data-action="open-collection"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      navigate(`#detail/${id}`);
    });
  });

  root.querySelectorAll('[data-action="start-new-collection"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!canCreateCollection(appContext.state)) {
        appContext.proSheetOpen = true;
        renderApp();
        return;
      }
      const lang = getLang();
      appContext.wizard = createDefaultDraft();
      appContext.wizard.title = t(lang, `preset_${appContext.wizard.type}`);
      navigate('#create');
    });
  });

  root.querySelectorAll('[data-action="close-pro-sheet"]').forEach((el) => {
    el.addEventListener('click', () => {
      appContext.proSheetOpen = false;
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="open-settings"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appContext.settingsNotice = '';
      navigate('#settings');
    });
  });

  // Create wizard handlers
  root.querySelectorAll('[data-action="wizard-back"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (appContext.wizard.step > 0) {
        appContext.wizard.step -= 1;
        renderApp();
      } else {
        navigate('#home');
      }
    });
  });

  root.querySelectorAll('[data-action="select-type"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tp = btn.getAttribute('data-type');
      const lang = getLang();
      appContext.wizard.type = tp;
      if (!appContext.wizard.titleCustomized) {
        appContext.wizard.title = t(lang, `preset_${tp}`);
      }
      renderApp();
    });
  });

  const titleInput = root.querySelector('#collection-title-input');
  if (titleInput) {
    titleInput.addEventListener('input', (e) => {
      appContext.wizard.title = e.target.value;
      appContext.wizard.titleCustomized = true;
    });
  }

  root.querySelectorAll('[data-action="wizard-next-step1"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = getLang();
      if (!appContext.wizard.title.trim()) {
        appContext.wizard.title = t(lang, `preset_${appContext.wizard.type}`);
      }
      appContext.wizard.step = 1;
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="set-amount-mode"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appContext.wizard.amountMode = btn.getAttribute('data-mode');
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="numpad-press"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handleNumpadInput(btn.getAttribute('data-key'));
    });
  });

  root.querySelectorAll('[data-action="wizard-next-step2"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (Number(appContext.wizard.amountStr || '0') > 0) {
        appContext.wizard.step = 2;
        renderApp();
      }
    });
  });

  root.querySelectorAll('[data-action="pick-contacts"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const lang = getLang();
      if (
        typeof navigator !== 'undefined' &&
        navigator.contacts &&
        typeof navigator.contacts.select === 'function'
      ) {
        try {
          const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true });
          if (Array.isArray(picked)) {
            for (const c of picked) {
              const name = (Array.isArray(c.name) ? c.name[0] : c.name) || '';
              const tel = (Array.isArray(c.tel) ? c.tel[0] : c.tel) || '';
              if (name) addDraftPerson(name, tel);
            }
            appContext.wizard.contactMessage = '';
            renderApp();
          }
        } catch {
          // User cancelled picker
        }
      } else {
        appContext.wizard.contactMessage = t(lang, 'contactsUnavailable');
        renderApp();
        const nameEl = document.getElementById('person-name-input');
        if (nameEl) nameEl.focus();
      }
    });
  });

  root.querySelectorAll('[data-action="focus-manual-person"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nameEl = root.querySelector('#person-name-input');
      if (nameEl) nameEl.focus();
    });
  });

  const manualForm = root.querySelector('#manual-person-form');
  if (manualForm) {
    const nameInput = root.querySelector('#person-name-input');
    const phoneInput = root.querySelector('#person-phone-input');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        appContext.wizard.draftName = e.target.value;
      });
    }
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        appContext.wizard.draftPhone = e.target.value;
      });
    }
    manualForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!appContext.wizard.draftName.trim()) return;
      addDraftPerson(appContext.wizard.draftName, appContext.wizard.draftPhone);
      appContext.wizard.draftName = '';
      appContext.wizard.draftPhone = '';
      renderApp();
      const nextName = document.getElementById('person-name-input');
      if (nextName) nextName.focus();
    });
  }

  root.querySelectorAll('[data-action="quick-add-12"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      for (const c of QUICK_SAMPLE_CONTACTS) {
        addDraftPerson(c.name, c.phone);
      }
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="remove-draft-person"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-index'));
      appContext.wizard.people.splice(idx, 1);
      renderApp();
    });
  });

  const deadlineInput = root.querySelector('#deadline-input');
  if (deadlineInput) {
    deadlineInput.addEventListener('input', (e) => {
      appContext.wizard.deadline = e.target.value;
    });
  }

  root.querySelectorAll('[data-action="wizard-finish"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = appContext.wizard;
      if (w.people.length === 0) return;
      const enteredPaise = rupeesToPaise(w.amountStr || '0');
      const isTotal = w.amountMode === 'total';
      const amountPerPersonPaise = isTotal
        ? Math.floor(enteredPaise / w.people.length)
        : enteredPaise;
      const totalTargetPaise = isTotal
        ? enteredPaise
        : enteredPaise * w.people.length;

      const newId = `col_${Date.now()}`;
      appContext.state = addCollection(appContext.state, {
        id: newId,
        type: w.type,
        title: w.title.trim() || t(getLang(), `preset_${w.type}`),
        amountMode: w.amountMode,
        amountPerPersonPaise,
        totalTargetPaise,
        deadline: w.deadline.trim(),
        people: w.people
      });
      appContext.wizard = createDefaultDraft();
      navigate(`#detail/${newId}`);
    });
  });

  // Detail & Mark-Paid sheet handlers
  root.querySelectorAll('[data-action="open-mark-sheet"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appContext.activeSheetPersonId = btn.getAttribute('data-person-id');
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="close-mark-sheet"]').forEach((el) => {
    el.addEventListener('click', () => {
      appContext.activeSheetPersonId = null;
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="confirm-mark-paid"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const collectionId = appContext.route.params.id;
      const personId = btn.getAttribute('data-person-id');
      const method = btn.getAttribute('data-method') || 'cash';
      const col = (appContext.state.collections || []).find((c) => c.id === collectionId);
      const person = col?.people.find((p) => p.id === personId);
      if (!col || !person) return;

      appContext.state = setPersonPaymentStatus(appContext.state, {
        collectionId,
        personId,
        status: 'paid',
        method
      });
      appContext.activeSheetPersonId = null;
      appContext.justPaidPersonId = personId;
      triggerUndoToast(person.name, 'paid');
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="confirm-mark-unpaid"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const collectionId = appContext.route.params.id;
      const personId = btn.getAttribute('data-person-id');
      const col = (appContext.state.collections || []).find((c) => c.id === collectionId);
      const person = col?.people.find((p) => p.id === personId);
      if (!col || !person) return;

      appContext.state = setPersonPaymentStatus(appContext.state, {
        collectionId,
        personId,
        status: 'pending'
      });
      appContext.activeSheetPersonId = null;
      appContext.justPaidPersonId = null;
      triggerUndoToast(person.name, 'pending');
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="undo-last-payment"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (appContext.undoToast && appContext.undoToast.timerId) {
        clearTimeout(appContext.undoToast.timerId);
      }
      const restored = undoLastAction();
      if (restored) {
        appContext.state = restored;
      }
      appContext.undoToast = null;
      appContext.justPaidPersonId = null;
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="open-share-screen"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      appContext.shareQueueIndex = 0;
      appContext.nudgedPersonIds = new Set();
      navigate(`#share/${id}`);
    });
  });

  // Share / Nudge screen handlers
  root.querySelectorAll('[data-action="back-to-detail"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      navigate(`#detail/${id}`);
    });
  });

  root.querySelectorAll('[data-action="select-share-person"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appContext.shareQueueIndex = Number(btn.getAttribute('data-index')) || 0;
      renderApp();
    });
  });

  const shareVpaInput = root.querySelector('#share-vpa-input');
  if (shareVpaInput) {
    shareVpaInput.addEventListener('change', (e) => {
      appContext.state = updateSettings(appContext.state, { vpa: e.target.value.trim() });
      renderApp();
    });
  }

  root.querySelectorAll('[data-action="copy-vpa"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const vpa = appContext.state.settings.vpa || '';
      copyText(vpa, 'vpa');
    });
  });

  root.querySelectorAll('[data-action="copy-summary"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const col = (appContext.state.collections || []).find(
        (c) => c.id === appContext.route.params.id
      );
      if (!col) return;
      const summary = buildSummaryText({
        collection: col,
        lang: getLang(),
        vpa: appContext.state.settings.vpa || ''
      });
      copyText(summary, 'summary');
    });
  });

  root.querySelectorAll('[data-action="send-next-pending"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const col = (appContext.state.collections || []).find(
        (c) => c.id === btn.getAttribute('data-id')
      );
      if (!col) return;
      const tally = computeTally(col);
      const pendingList = tally.pendingPeople;
      const person = pendingList[appContext.shareQueueIndex];
      if (!person) return;

      const idxInCol = col.people.findIndex((p) => p.id === person.id);
      const msg = buildNudgeMessage({
        collection: col,
        person,
        personIndex: idxInCol,
        lang: getLang(),
        vpa: appContext.state.settings.vpa || '',
        customTemplate: appContext.state.settings.isPro
          ? appContext.state.settings.customNudgeTemplate
          : ''
      });
      const href = waLink(person.phone || '', msg);
      window.open(href, '_blank', 'noopener,noreferrer');

      appContext.nudgedPersonIds.add(person.id);
      if (pendingList.length > 1) {
        appContext.shareQueueIndex = (appContext.shareQueueIndex + 1) % pendingList.length;
      }
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="share-summary-wa"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const col = (appContext.state.collections || []).find(
        (c) => c.id === btn.getAttribute('data-id')
      );
      if (!col) return;
      const summary = buildSummaryText({
        collection: col,
        lang: getLang(),
        vpa: appContext.state.settings.vpa || ''
      });
      window.open(waLink('', summary), '_blank', 'noopener,noreferrer');
    });
  });

  // Settings screen handlers
  root.querySelectorAll('[data-action="save-upi-settings"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = getLang();
      const payeeEl = root.querySelector('#settings-payee-input');
      const vpaEl = root.querySelector('#settings-vpa-input');
      const payeeName = payeeEl ? payeeEl.value.trim() : '';
      const vpa = vpaEl ? vpaEl.value.trim() : '';

      if (vpa && !isValidVpa(vpa)) {
        appContext.settingsNotice = t(lang, 'vpaInvalid');
        renderApp();
        return;
      }
      appContext.state = updateSettings(appContext.state, { payeeName, vpa });
      appContext.settingsNotice = `${t(lang, 'save')} ✓`;
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="export-backup"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const json = exportBackupJson(appContext.state);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadBlob(json, `chanda-backup-${dateStr}.json`, 'application/json');
    });
  });

  root.querySelectorAll('[data-action="trigger-import-backup"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fileInput = root.querySelector('#backup-file-input');
      if (fileInput) fileInput.click();
    });
  });

  const backupFileInput = root.querySelector('#backup-file-input');
  if (backupFileInput) {
    backupFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const lang = getLang();
      try {
        const text = await file.text();
        if (window.confirm(t(lang, 'importConfirm'))) {
          appContext.state = importBackupJson(text);
          appContext.settingsNotice = t(lang, 'importSuccess');
          renderApp();
        }
      } catch {
        appContext.settingsNotice = t(lang, 'importError');
        renderApp();
      }
    });
  }

  root.querySelectorAll('[data-action="export-csv"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!appContext.state.settings.isPro) {
        appContext.proSheetOpen = true;
        renderApp();
        return;
      }
      const rows = ['Collection,Person,Phone,Status,Method,PaidAt'];
      for (const col of appContext.state.collections) {
        for (const p of col.people) {
          rows.push(
            [col.title, p.name, p.phone || '', p.status, p.method || '', p.paidAt || '']
              .map((v) => `"${String(v).replace(/"/g, '""')}"`)
              .join(',')
          );
        }
      }
      downloadBlob(rows.join('\n'), 'chanda-export.csv', 'text/csv');
    });
  });

  root.querySelectorAll('[data-action="trigger-install-pwa"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!appContext.deferredInstallPrompt) return;
      appContext.deferredInstallPrompt.prompt();
      await appContext.deferredInstallPrompt.userChoice;
      appContext.deferredInstallPrompt = null;
      renderApp();
    });
  });
}

async function boot() {
  await initI18n();
  appContext.state = loadState();
  appContext.route = parseHash(window.location.hash);
  appContext.ready = true;

  window.addEventListener('hashchange', () => {
    appContext.route = parseHash(window.location.hash);
    appContext.activeSheetPersonId = null;
    renderApp();
  });

  window.addEventListener('keydown', (e) => {
    if (appContext.route.name === 'create' && appContext.wizard.step === 1) {
      if (/^\d$/.test(e.key)) {
        handleNumpadInput(e.key);
      } else if (e.key === 'Backspace') {
        handleNumpadInput('⌫');
      }
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    appContext.deferredInstallPrompt = e;
    renderApp();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  renderApp();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  boot();
}
