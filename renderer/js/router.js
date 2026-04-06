/* ══════════════════════════════════════════════════════════════════════
   router.js — SPA-style page router & nav manager
   ══════════════════════════════════════════════════════════════════════ */

const Router = {
  currentPage: 'home',
  menuOpen: false,

  init() {
    // Bottom nav buttons
    document.querySelectorAll('.bottom-nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.page));
    });

    // License manager shortcut (returns to activation gate)
    document.getElementById('btn-license-manager')?.addEventListener('click', () => {
      App.goToLicenseManager();
    });

    // Legacy menu controls (keep optional so older layouts do not break)
    document.getElementById('btn-menu')?.addEventListener('click', () => this.toggleMenu());
    document.getElementById('menu-close')?.addEventListener('click', () => this.closeMenu());
    document.getElementById('menu-backdrop')?.addEventListener('click', () => this.closeMenu());

    // Menu items
    document.querySelectorAll('.menu-grid-item[data-action]').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.closeMenu();
        if (action === 'updates') {
          App._openUpdateCenter();
        } else if (action === 'license-manager') {
          // Navigate to system page which has license manager
          this.navigate('system');
        }
      });
    });

    // Back buttons (added dynamically based on page)
    document.addEventListener('click', (e) => {
      const backBtn = e.target.closest('.subpage-back-btn');
      if (backBtn) {
        this.navigate('home');
      }
    });
  },

  navigate(page) {
    this.currentPage = page;
    this.closeMenu();

    // Show/hide bottom nav (only on home)
    const bottomNav = document.getElementById('bottom-nav');
    const pageContainer = document.getElementById('page-container');

    if (page === 'home') {
      bottomNav.classList.remove('hidden');
      pageContainer.classList.add('has-bottom-nav');
    } else {
      bottomNav.classList.add('hidden');
      pageContainer.classList.remove('has-bottom-nav');
    }

    // Update active state on bottom nav
    document.querySelectorAll('.bottom-nav-item[data-page]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Toggle page sections
    document.querySelectorAll('.page-section').forEach(el => {
      const isActive = el.id === `page-${page}`;
      el.classList.toggle('active', isActive);
      if (isActive) el.classList.add('page-enter');
    });

    // Render active page
    App.renderAll();
  },

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
    document.getElementById('menu-overlay')?.classList.toggle('open', this.menuOpen);
    document.getElementById('menu-backdrop')?.classList.toggle('visible', this.menuOpen);
  },

  closeMenu() {
    this.menuOpen = false;
    document.getElementById('menu-overlay')?.classList.remove('open');
    document.getElementById('menu-backdrop')?.classList.remove('visible');
  },
};

window.Router = Router;
