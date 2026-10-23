// Chanda Collector — P2: Create Collection 3-Step Wizard (Type -> Amount Numpad -> Contacts/Manual People)
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
  canCreateCollection
} from './lib/store.js';
import {
  inr,
  rupeesToPaise,
  avatarColor,
  avatarInitial,
  typeEmoji
} from './lib/format.js';
import { computeTally } from './lib/tally.js';
import { parsePhone } from './lib/phone.js';

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
  { name: 'AnjaliDesai', phone: '9876543220' },
  { name: 'Rohan Malhotra', phone: '9876543221' }
];

export function createDefaultDraft(lang = 'hinglish') {
  return {
    step: 0, // 0: type, 1: amount, 2: people
    type: 'gift',
    title: '',
    titleCustomized: false,
    amountMode: 'perPerson', // 'perPerson' | 'total'
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
            style="font-size:13px; font-weight:700; color:var(--green-deep); background:var(--green-tint); padding:6px 12px; border-radius:999px; min-height:36px;"
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

export function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;
  const route = appContext.route;

  if (route.name === 'lang') {
    root.innerHTML = renderLangPickScreen();
  } else if (route.name === 'create') {
    root.innerHTML = renderCreateScreen();
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
      appContext.wizard = createDefaultDraft(lang);
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
      appContext.wizard = createDefaultDraft(getLang());
      navigate(`#detail/${newId}`);
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
  renderApp();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  boot();
}
