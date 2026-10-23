// Chanda Collector — P1: Language Pick Screen + Home Collections List & Sample Seed
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
import { inr, typeEmoji } from './lib/format.js';
import { computeTally } from './lib/tally.js';

export const appContext = {
  state: loadState(),
  route: { name: 'home', params: {} },
  proSheetOpen: false,
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
      amountPerPersonPaise: 100000, // ₹1,000 × 20 = ₹20,000 (14 paid = ₹14,000, 70%)
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
      amountPerPersonPaise: 50000, // ₹500 × 24 = ₹12,000 (17 paid = ₹8,500, 71%)
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
      amountPerPersonPaise: 200000, // ₹2,000 × 15 = ₹30,000 (11 paid = ₹22,000, 73%)
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

export function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;
  const route = appContext.route;

  if (route.name === 'lang') {
    root.innerHTML = renderLangPickScreen();
  } else {
    root.innerHTML = renderHomeScreen();
  }

  bindEvents(root);
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
  renderApp();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  boot();
}
