/* ══════════════════════════════════════════════════════════════════════
   i18n.js — Lightweight runtime localization manager
   ══════════════════════════════════════════════════════════════════════ */

const I18n = {
  currentLang: 'en',
  bundles: {},
  supported: ['en', 'gr', 'fr'],
  storageKey: 'livis:lang',

  async init() {
    const saved = localStorage.getItem(this.storageKey);
    this.currentLang = this.supported.includes(saved) ? saved : 'en';

    await this._loadLang(this.currentLang);
    this._wireLanguageButtons();
    this._wireLanguageModal();
    this.applyStaticTranslations();
    this._syncLanguageSelect();
  },

  async _loadLang(lang) {
    if (lang === 'en') {
      this.bundles.en = this.bundles.en || {};
      return;
    }
    if (this.bundles[lang]) return;

    try {
      const res = await fetch(`locales/${lang}/translation.json`);
      if (!res.ok) throw new Error(`Failed to load locale: ${lang}`);
      this.bundles[lang] = await res.json();
    } catch (err) {
      console.error('I18n load failed:', err);
      this.bundles[lang] = {};
    }
  },

  t(key, vars = {}, fallback = null) {
    const bundle = this.bundles[this.currentLang] || {};
    const value = bundle[key] ?? fallback ?? key;
    return String(value).replace(/\{\{(\w+)\}\}/g, (_, token) => {
      const v = vars[token];
      return v === undefined || v === null ? '' : String(v);
    });
  },

  async setLanguage(lang) {
    if (!this.supported.includes(lang)) return;
    await this._loadLang(lang);
    this.currentLang = lang;
    localStorage.setItem(this.storageKey, lang);
    this.applyStaticTranslations();
    this._syncLanguageSelect();
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
  },

  applyStaticTranslations() {
    const map = [
      ['title', 'app.title'],
      ['#header-status-text', 'header.status.systemActive'],
      ['#btn-notification', 'header.notificationTitle', 'title'],
      ['#btn-lang-activation', 'header.language', 'title'],
      ['#btn-lang-main', 'header.language', 'title'],
      ['#main-app .station-name', 'header.missionControl'],
      ['#main-app .station-name-sub', 'header.fleetManagement'],
      ['#activation-gate .station-name', 'header.activationPortal'],
      ['#activation-gate .station-name-sub', 'header.licenseVerification'],
      ['#activation-gate .header-status-pill span:last-child', 'header.status.awaitingLicense'],
      ['#btn-resume', 'activation.resume.button'],
      ['#btn-download-profile-act', 'activation.downloadProfile'],
      ['#btn-download-profile-home', 'home.downloadProfile'],
      ['#btn-add-line', 'fleet.addWorkstation'],
      ['#btn-add-line-empty', 'fleet.addWorkstation'],
      ['#btn-bulk-update', 'fleet.updateAll'],
      ['#fleet-empty h3', 'fleet.empty.title'],
      ['#fleet-empty p', 'fleet.empty.desc'],
      ['#btn-banner-review', 'update.banner.review'],
      ['#banner-version', 'update.banner.available'],
      ['#fleet-loading span', 'fleet.loading'],
      ['#btn-license-manager span', 'nav.licenseManager'],
      ['.bottom-nav-item[data-page="fleet"] span', 'nav.fleet'],
      ['.bottom-nav-item[data-page="system"] span', 'nav.system'],
      ['#menu-overlay h2', 'menu.title'],
      ['.menu-grid-item[data-action="updates"] span', 'menu.softwareUpdates'],
      ['.menu-grid-item[data-action="license-manager"] span', 'menu.licenseManager'],
      ['.menu-footer-links a:first-child', 'menu.termsOfUse'],
      ['.menu-footer-links span', 'menu.and'],
      ['.menu-footer-links a:last-child', 'menu.privacyPolicy'],
      ['#languageModal .modal-title', 'header.languageModalTitle'],
      ['label[for="language-select"]', 'header.language'],
      ['#btn-language-cancel', 'common.cancel'],
      ['#btn-language-apply', 'common.continue'],
      ['#toast-later', 'toast.later'],
    ];

    map.forEach(([selector, key, attr]) => {
      const el = document.querySelector(selector);
      if (!el) return;
      const translated = this.t(key, {}, attr === 'title' ? el.getAttribute('title') : el.textContent?.trim());
      if (attr === 'title') el.setAttribute('title', translated);
      else if (selector === 'title') document.title = translated;
      else this._setText(el, translated);
    });

    this._syncLanguageSelect();
  },

  _setText(el, text) {
    const icon = el.querySelector(':scope > i');
    const hasSingleIconLayout = icon && el.children.length <= 2;
    if (hasSingleIconLayout) {
      el.innerHTML = `${icon.outerHTML} ${text}`;
      return;
    }
    el.textContent = text;
  },

  _wireLanguageButtons() {
    document.querySelectorAll('.btn-language-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('languageModal'));
        this._syncLanguageSelect();
        modal.show();
      });
    });
  },

  _wireLanguageModal() {
    const applyBtn = document.getElementById('btn-language-apply');
    const cancelBtn = document.getElementById('btn-language-cancel');
    const select = document.getElementById('language-select');
    if (!applyBtn || !cancelBtn || !select) return;

    cancelBtn.addEventListener('click', () => {
      bootstrap.Modal.getInstance(document.getElementById('languageModal'))?.hide();
    });

    applyBtn.addEventListener('click', async () => {
      const next = select.value;
      await this.setLanguage(next);
      bootstrap.Modal.getInstance(document.getElementById('languageModal'))?.hide();
    });
  },

  _syncLanguageSelect() {
    const select = document.getElementById('language-select');
    if (!select) return;
    select.value = this.currentLang;
    const optEn = select.querySelector('option[value="en"]');
    const optGr = select.querySelector('option[value="gr"]');
    const optFr = select.querySelector('option[value="fr"]');
    if (optEn) optEn.textContent = this.t('header.language.en', {}, 'English');
    if (optGr) optGr.textContent = this.t('header.language.gr', {}, 'German');
    if (optFr) optFr.textContent = this.t('header.language.fr', {}, 'French');
  },
};

window.I18n = I18n;
