// js/managers/uiManager.js

import stateManager from './stateManager.js';
// Import the helper function, renaming it to avoid conflict
import { addListener as helperAddListener } from '../utils/helpers.js';

/**
 * Manages all DOM interactions, UI updates, modals, and visual feedback.
 */
class UIManager {
  constructor() {
    this.elements = this._cacheDOMElements();
    this.onConfirmDelete = null;
    this.onSaveEdit = null;
    this.onSaveAdmin = null;
    this.toastTimeout = null;

    this._initTheme();
    this._setupEventListeners(); // Setup internal listeners
    console.log('✅ UIManager initialized.');
  }

  _cacheDOMElements() {
    const elements = {};
    const elementIds = [
      'loadingOverlay',
      'loadingMessage',
      'toast',
      'toastMessage',
      'mobileMenuOverlay',
      'mobileMenuButton',
      'themeToggle',
      'headerLoginBtn',
      'logoutBtn',
      'userInfo',
      'sidebar',
      'appContainer',
      'authModal',
      'closeAuthModal',
      'loginForm',
      'registerForm',
      'showRegister',
      'showLogin',
      'loginEmail',
      'loginPassword',
      'loginBtn',
      'registerEmail',
      'registerPassword',
      'adminType',
      'registerBtn',
      'googleSignInBtn',
      'logoutModal',
      'cancelLogout',
      'confirmLogout',
      'deleteModal',
      'deleteModalTitle',
      'deleteModalText',
      'cancelDelete',
      'confirmDelete',
      'confirmModal',
      'confirmModalTitle',
      'confirmModalText',
      'cancelConfirm',
      'actionConfirm',
      'editModal',
      'editModalTitle',
      'editModalContent',
      'cancelEdit',
      'saveEdit',
      'profileModal',
      'openProfileModal',
      'closeProfileModal',
      'adminModal',
      'adminModalTitle',
      'adminModalContent',
      'cancelAdmin',
      'saveAdmin',
      'adminEmail',
      'adminPassword',
      'adminTypeSelect',
      'permissionsSection',
      'permissionRead',
      'permissionWrite',
      'permissionEdit',
      'permissionDelete',
    ];

    elements.pages = document.querySelectorAll('.page');
    elements.navButtons = document.querySelectorAll('.nav-btn');
    elements.privateTabs = document.querySelectorAll('.private-tab');
    elements.privateTabDividers = document.querySelectorAll('.private-tab-divider');
    elements.privateTabContent = document.querySelectorAll('.private-tab-content');

    for (const id of elementIds) {
      elements[id] = document.getElementById(id);
      if (
        !elements[id] &&
        [
          'appContainer',
          'loadingOverlay',
          'toast',
          'sidebar',
          'authModal',
          'deleteModal',
          'confirmModal',
          'editModal',
          'adminModal',
          'profileModal',
          'logoutModal',
        ].includes(id)
      ) {
        console.error(`❌ UIManager: Essential element with ID "${id}" not found!`);
      }
    }
    return elements;
  }

  // --- Public Method for Adding Listeners ---
  /**
   * Safely adds an event listener to a DOM element using the helper.
   */
  addListener(element, event, handler, options = false) {
    helperAddListener(element, event, handler, options); // Call the imported helper
  }

  /**
   * Sets up global event listeners managed by the UI Manager itself.
   */
  _setupEventListeners() {
    console.log('🎧 Setting up UIManager internal event listeners...');
    // Use 'this.addListener' which now correctly calls the helper
    this.addListener(this.elements.themeToggle, 'click', () => this._toggleTheme());
    this.addListener(this.elements.mobileMenuButton, 'click', () => this._toggleMobileMenu());
    this.addListener(this.elements.mobileMenuOverlay, 'click', () => this._toggleMobileMenu(false));
    this.addListener(this.elements.openProfileModal, 'click', () => this.showModal(this.elements.profileModal));
    this.addListener(this.elements.closeProfileModal, 'click', () => this.hideModal(this.elements.profileModal));
    this.addListener(this.elements.profileModal, 'click', (e) => {
      if (e.target === this.elements.profileModal) this.hideModal(this.elements.profileModal);
    });
    this.addListener(this.elements.headerLoginBtn, 'click', () => {
      this._toggleAuthForm(false);
      this.showModal(this.elements.authModal);
    });
    this.addListener(this.elements.closeAuthModal, 'click', () => this.hideModal(this.elements.authModal));
    this.addListener(this.elements.showRegister, 'click', () => this._toggleAuthForm(true));
    this.addListener(this.elements.showLogin, 'click', () => this._toggleAuthForm(false));
    this.addListener(this.elements.authModal, 'click', (e) => {
      if (e.target === this.elements.authModal) this.hideModal(this.elements.authModal);
    });
    this.addListener(this.elements.logoutBtn, 'click', () => this.showModal(this.elements.logoutModal));
    this.addListener(this.elements.cancelLogout, 'click', () => this.hideModal(this.elements.logoutModal));
    this.addListener(this.elements.cancelDelete, 'click', () => this.hideModal(this.elements.deleteModal));
    this.addListener(this.elements.confirmDelete, 'click', () => {
      if (typeof this.onConfirmDelete === 'function') this.onConfirmDelete();
      this.hideModal(this.elements.deleteModal);
    });
    this.addListener(this.elements.cancelConfirm, 'click', () => this.hideModal(this.elements.confirmModal));
    this.addListener(this.elements.actionConfirm, 'click', () => {
      if (typeof this.onConfirmAction === 'function') this.onConfirmAction();
      this.hideModal(this.elements.confirmModal);
    });
    this.addListener(this.elements.cancelEdit, 'click', () => this.hideModal(this.elements.editModal));
    this.addListener(this.elements.saveEdit, 'click', () => {
      if (typeof this.onSaveEdit === 'function') this.onSaveEdit();
    });
    this.addListener(this.elements.cancelAdmin, 'click', () => this.hideModal(this.elements.adminModal));
    this.addListener(this.elements.saveAdmin, 'click', () => {
      if (typeof this.onSaveAdmin === 'function') this.onSaveAdmin();
    });
    this.addListener(this.elements.adminTypeSelect, 'change', (e) => this._togglePermissionsSection(e.target.value));
    console.log('🎧 UIManager internal event listeners attached.');
  }

  // --- Theme Management ---
  _initTheme() {
    const useDark =
      localStorage.theme === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    this._applyTheme(useDark);
  }
  _toggleTheme() {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    this._applyTheme(!isCurrentlyDark);
  }
  _applyTheme(isDark) {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.theme = isDark ? 'dark' : 'light';
    this._updateThemeIcon(isDark);
  }
  _updateThemeIcon(isDark) {
    const icon = this.elements.themeToggle?.querySelector('i');
    if (icon) {
      icon.className = `fas ${isDark ? 'fa-sun' : 'fa-moon'} text-base sm:text-lg`;
      this.elements.themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  // --- Mobile Menu ---
  _toggleMobileMenu(forceState) {
    const sidebar = this.elements.sidebar;
    const overlay = this.elements.mobileMenuOverlay;
    const buttonIcon = this.elements.mobileMenuButton?.querySelector('i');
    if (!sidebar || !overlay) return;
    let shouldOpen;
    const isCurrentlyClosed = sidebar.classList.contains('-translate-x-full');
    if (forceState === undefined) shouldOpen = isCurrentlyClosed;
    else shouldOpen = forceState;
    sidebar.classList.toggle('-translate-x-full', !shouldOpen);
    overlay.classList.toggle('hidden', !shouldOpen);
    if (buttonIcon) buttonIcon.className = `fas ${shouldOpen ? 'fa-times' : 'fa-bars'} text-xl sm:text-2xl`;
    if (this.elements.mobileMenuButton)
      this.elements.mobileMenuButton.setAttribute('aria-expanded', String(shouldOpen));
  }

  // --- Page Navigation ---
  showPage(pageId) {
    if (!pageId || typeof pageId !== 'string') {
      console.warn(`showPage: Invalid pageId "${pageId}". Defaulting to dashboard.`);
      pageId = 'dashboard';
    }
    const targetPageElement = document.getElementById(`page-${pageId}`);
    if (!targetPageElement) {
      console.error(`showPage: Page element #page-${pageId} not found! Showing dashboard.`);
      if (pageId !== 'dashboard') this.showPage('dashboard');
      return;
    }
    this.elements.pages.forEach((page) => {
      if (page !== targetPageElement) page.classList.add('hidden');
    });
    targetPageElement.classList.remove('hidden');
    stateManager.set('activePage', pageId);
    this._updateActiveNav(pageId);
    if (window.innerWidth < 1024) this._toggleMobileMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  _updateActiveNav(pageId) {
    const activeClass = 'active-nav-btn';
    this.elements.navButtons?.forEach((btn) => {
      const isCurrent = btn.dataset.page === pageId;
      btn.classList.toggle(activeClass, isCurrent);
      btn.setAttribute('aria-current', isCurrent ? 'page' : 'false');
    });
  }

  // --- Loading & Notifications ---
  showLoading(message = 'লোড হচ্ছে...') {
    if (this.elements.loadingOverlay) {
      if (this.elements.loadingMessage) this.elements.loadingMessage.textContent = message;
      this.elements.loadingOverlay.classList.remove('hidden', 'opacity-0');
      stateManager.setLoading(true);
    } else {
      console.warn('showLoading: loadingOverlay element not found.');
    }
  }
  hideLoading() {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.classList.add('opacity-0');
      setTimeout(() => {
        if (this.elements.loadingOverlay.classList.contains('opacity-0')) {
          this.elements.loadingOverlay.classList.add('hidden');
        }
      }, 300);
      stateManager.setLoading(false);
    }
  }
  showToast(message, type = 'info', duration = 3500) {
    if (!this.elements.toast || !this.elements.toastMessage) {
      console.warn('showToast: Toast elements not found.');
      return;
    }
    clearTimeout(this.toastTimeout);
    this.elements.toastMessage.textContent = message;
    this.elements.toast.className = `toast toast-${type}`;
    this.elements.toast.classList.remove('hidden');
    void this.elements.toast.offsetWidth;
    this.elements.toast.classList.add('toast-show');
    this.toastTimeout = setTimeout(() => {
      this.elements.toast?.classList.remove('toast-show');
      setTimeout(() => {
        this.elements.toast?.classList.add('hidden');
      }, 500);
    }, duration);
  }

  // --- Modal Management ---
  showModal(modalElement) {
    if (modalElement instanceof Element) {
      modalElement.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    } else {
      console.warn('showModal: Invalid or missing modal element.');
    }
  }
  hideModal(modalElement) {
    if (modalElement instanceof Element) {
      modalElement.classList.add('hidden');
      document.body.style.overflow = '';
      const modalId = modalElement.id;
      if (modalId === 'deleteModal') this.onConfirmDelete = null;
      else if (modalId === 'editModal') {
        this.onSaveEdit = null;
        if (this.elements.editModalContent) this.elements.editModalContent.innerHTML = '';
      } else if (modalId === 'adminModal') this.onSaveAdmin = null;
    } else {
      console.warn('hideModal: Invalid or missing modal element.');
    }
  }
  showDeleteModal(title = 'নিশ্চিতকরণ', text = 'আপনি কি নিশ্চিত?', confirmCallback) {
    if (this.elements.deleteModal) {
      if (this.elements.deleteModalTitle) this.elements.deleteModalTitle.textContent = title;
      if (this.elements.deleteModalText) this.elements.deleteModalText.textContent = text;
      this.onConfirmDelete = confirmCallback;
      this.showModal(this.elements.deleteModal);
    } else {
      console.error('showDeleteModal: deleteModal element not found.');
    }
  }
  showConfirmModal(title, text, confirmCallback, confirmBtnText = 'নিশ্চিত করুন', confirmBtnClass = 'btn-primary') {
    if (this.elements.confirmModal) {
      if (this.elements.confirmModalTitle) this.elements.confirmModalTitle.textContent = title;
      if (this.elements.confirmModalText) this.elements.confirmModalText.textContent = text;
      
      const actionBtn = this.elements.actionConfirm;
      if (actionBtn) {
        actionBtn.textContent = confirmBtnText;
        // Reset classes and add base btn class + specific class
        actionBtn.className = `btn ${confirmBtnClass}`;
      }

      this.onConfirmAction = confirmCallback;
      this.showModal(this.elements.confirmModal);
    } else {
      console.error('showConfirmModal: confirmModal element not found.');
    }
  }
  showEditModal(title, contentHTML, saveCallback, onOpenCallback) {
    if (this.elements.editModal) {
      if (this.elements.editModalTitle) this.elements.editModalTitle.textContent = title;
      if (this.elements.editModalContent) this.elements.editModalContent.innerHTML = contentHTML;
      else console.warn('showEditModal: editModalContent element not found.');
      this.onSaveEdit = saveCallback;
      this.showModal(this.elements.editModal);
      
      if (typeof onOpenCallback === 'function') {
          onOpenCallback();
      }
    } else {
      console.error('showEditModal: editModal element not found.');
    }
  }
  showAdminModal(title, adminData = null, saveCallback) {
    if (this.elements.adminModal) {
      if (this.elements.adminModalTitle) this.elements.adminModalTitle.textContent = title;
      const emailInput = this.elements.adminEmail;
      const passwordInput = this.elements.adminPassword;
      const typeSelect = this.elements.adminTypeSelect;
      if (emailInput) {
        emailInput.value = adminData?.email || '';
        emailInput.disabled = !!adminData;
      }
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.placeholder = adminData ? 'নতুন পাসওয়ার্ড (ঐচ্ছিক)' : 'পাসওয়ার্ড*';
      }
      if (typeSelect) typeSelect.value = adminData?.type || 'user';
      const perms = adminData?.permissions || { read: true, write: false, edit: false, delete: false };
      if (this.elements.permissionRead) this.elements.permissionRead.checked = perms.read;
      if (this.elements.permissionWrite) this.elements.permissionWrite.checked = perms.write;
      if (this.elements.permissionEdit) this.elements.permissionEdit.checked = perms.edit;
      if (this.elements.permissionDelete) this.elements.permissionDelete.checked = perms.delete;
      this._togglePermissionsSection(typeSelect?.value || 'user');
      this.onSaveAdmin = saveCallback;
      this.showModal(this.elements.adminModal);
    } else {
      console.error('showAdminModal: adminModal element not found.');
    }
  }
  _toggleAuthForm(showRegister) {
    if (
      this.elements.loginForm &&
      this.elements.registerForm &&
      this.elements.showRegister &&
      this.elements.showLogin
    ) {
      this.elements.loginForm.classList.toggle('hidden', showRegister);
      this.elements.registerForm.classList.toggle('hidden', !showRegister);
      this.elements.showRegister.classList.toggle('hidden', showRegister);
      this.elements.showLogin.classList.toggle('hidden', !showRegister);
      const titleEl = this.elements.authModal?.querySelector('h3');
      if (titleEl) titleEl.textContent = showRegister ? 'নতুন অ্যাকাউন্ট তৈরি করুন' : 'অ্যাকাউন্টে প্রবেশ করুন';
    }
  }
  _togglePermissionsSection(type) {
    const showPermissions = type === 'admin';
    this.elements.permissionsSection?.classList.toggle('hidden', !showPermissions);
  }
  // --- Auth UI Updates ---
  updateUserInfo(userData) {
    const isLoggedIn = !!userData;
    this.elements.headerLoginBtn?.classList.toggle('hidden', isLoggedIn);
    this.elements.logoutBtn?.classList.toggle('hidden', !isLoggedIn);
    this.elements.userInfo?.classList.toggle('hidden', !isLoggedIn);
    if (isLoggedIn && this.elements.userInfo) {
      const roleMap = { 'super-admin': 'সুপার অ্যাডমিন', admin: 'অ্যাডমিন', teacher: 'শিক্ষক', user: 'ব্যবহারকারী' };
      const userInfoTextEl = this.elements.userInfo.querySelector('div');
      if (userInfoTextEl) userInfoTextEl.textContent = roleMap[userData?.type] || 'ব্যবহারকারী';
    } else if (this.elements.userInfo) {
      const userInfoTextEl = this.elements.userInfo.querySelector('div');
      if (userInfoTextEl) userInfoTextEl.textContent = '';
    }
  }
  enableNavigation(isLoggedIn, userType) {
    const isAdmin = userType === 'admin' || userType === 'super-admin';
    const isSuperAdmin = userType === 'super-admin';
    const isTeacher = userType === 'teacher';
    const disabledClass = 'disabled-nav';
    
    // Query dynamically because settings.js might have changed classes
    const privateTabs = document.querySelectorAll('.private-tab');
    privateTabs.forEach((tab) => {
      const page = tab.dataset.page;
      let enabled = false;
      if (isLoggedIn) {
        if (page === 'admin-management' || page === 'teacher-management' || page === 'class-management') {
          enabled = isSuperAdmin;
        } else if (page === 'tasks' || page === 'evaluation') {
          // Teachers can access Task Management and Evaluation
          enabled = isAdmin || isTeacher;
        } else {
          // Other private pages only for admins
          enabled = isAdmin;
        }
      }
      tab.disabled = !enabled;
      tab.classList.toggle(disabledClass, !enabled);
    });

    const dividers = document.querySelectorAll('.private-tab-divider');
    dividers.forEach((divider) => {
      divider.classList.toggle('hidden', !isAdmin && !isSuperAdmin && !isTeacher);
    });
  }
  // --- DOM Render Helpers ---
  populateSelect(selectElement, options, defaultOptionText = 'সকল', selectedValue = '') {
    if (!(selectElement instanceof HTMLSelectElement)) {
      console.warn('populateSelect: Provided element is not a select.');
      return;
    }
    const currentVal = selectElement.value;
    selectElement.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = defaultOptionText.includes('সকল') || defaultOptionText.includes('All') ? 'all' : '';
    defaultOpt.textContent = defaultOptionText;
    if (defaultOptionText.includes('নির্বাচন করুন')) {
      defaultOpt.disabled = true;
      defaultOpt.selected = !selectedValue && !currentVal;
    }
    selectElement.appendChild(defaultOpt);
    options?.forEach((option) => {
      if (option && typeof option.value !== 'undefined' && typeof option.text !== 'undefined') {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.text;
        selectElement.appendChild(opt);
      }
    });
    const possibleValues = ['', 'all', ...options.map((o) => o.value)];
    const valueToSet =
      selectedValue && possibleValues.includes(selectedValue)
        ? selectedValue
        : currentVal && possibleValues.includes(currentVal)
        ? currentVal
        : defaultOpt.value;
    selectElement.value = valueToSet;
  }
  displayEmptyMessage(container, message = 'কোনো তথ্য পাওয়া যায়নি।') {
    if (!(container instanceof Element)) {
      console.warn('displayEmptyMessage: Provided container is not valid.');
      return;
    }
    container.innerHTML = `<div class="placeholder-content p-6 text-center text-gray-500 dark:text-gray-400">
            <i class="fas fa-info-circle text-3xl mb-3 text-gray-400"></i><p>${message}</p>
        </div>`;
  }
  clearContainer(container) {
    if (container instanceof Element) {
      container.innerHTML = '';
    } else if (container) {
      console.warn('clearContainer: Provided container is not valid.', container);
    }
  }
}
const uiManager = new UIManager();
export default uiManager;
