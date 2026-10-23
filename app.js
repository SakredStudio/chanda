// Chanda Collector — App Shell, i18n Loader, State Persistence, and Router (P0)
import {
  SUPPORTED_LANGS,
  registerTranslations,
  t,
  normalizeLang
} from './lib/i18n.js';
import {
  loadState,
  updateSettings
} from './lib/store.js';

export const appContext = {
  state: loadState(),
  route: { name: 'home', params: {} },
  ready: false
};

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

export function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;
  const lang = getLang();
  const route = appContext.route;

  root.innerHTML = `
    <main class="screen" data-screen="${route.name}">
      <header class="header-row">
        <div class="header-left">
          <h1 class="screen-title">${t(lang, 'homeTitle')}</h1>
        </div>
        ${renderLanguageToggle()}
      </header>
    </main>
  `;

  root.querySelectorAll('[data-action="set-lang"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.getAttribute('data-lang'), true);
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
