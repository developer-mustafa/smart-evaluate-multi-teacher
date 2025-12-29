// js/app.js

// Import Managers
import stateManager from './managers/stateManager.js';
import uiManager from './managers/uiManager.js';
import cacheManager from './managers/cacheManager.js';
import themeManager from './managers/themeManager.js';

// Import Services
import authService, { loginWithEmail, registerWithEmail, signInWithGoogle, logout } from './services/authService.js';
import * as dataService from './services/dataService.js';

// Import Utility Functions (Import all as a namespace)
import * as helpers from './utils/helpers.js'; // <-- helpers.* হিসেবে ব্যবহারের জন্য
import * as permissionHelper from './utils/permissionHelper.js';
import * as pdfGenerator from './utils/pdf-generator.js';

// Import Page Component Modules
import * as dashboard from './components/dashboard.js';
import * as groups from './components/groups.js';
import * as members from './components/members.js';
import * as tasks from './components/tasks.js';
import * as evaluation from './components/evaluation.js';
import * as ranking from './components/ranking.js';
import * as analysis from './components/analysis.js';
import * as admin from './components/admin.js';
import * as exportModule from './components/export.js';
import * as policy from './components/policy.js';
import * as upcomingAssignments from './components/upcoming-assignments.js';
import * as statistics from './components/statistics.js';
import * as studentFilter from './components/student-filter.js';
import * as settings from './components/settings.js';
import * as classManagement from './components/classManagement.js';
import * as teacherManagement from './components/teacherManagement.js';

/**
 * Main application class. Acts as the central controller/coordinator.
 */
class SmartGroupEvaluator {
  constructor() {
    this.services = {
      dataService,
      authService,  // Added for direct access
      auth: { loginWithEmail, registerWithEmail, signInWithGoogle, logout, authServiceInstance: authService },
    };
    this.managers = { stateManager, uiManager, cacheManager, themeManager };
    this.utils = { ...helpers, permissionHelper, pdfGenerator }; // <-- helpers এবং permissionHelper অবজেক্ট পাস করা হয়েছে

    this.components = {}; // Holds initialized component instances

    this.publicPages = [
      'dashboard',
      'upcoming-assignments',
      'all-students',
      'group-policy',
      'export',
      'student-ranking',
      'group-analysis',
      'graph-analysis',
      'graph-analysis',
      'statistics',
      'student-filter',
    ];

    console.log('SmartGroupEvaluator app instantiated.');
  }

  /**
   * Initializes the entire application in the correct order.
   */
  async init() {
    console.log('🚀 Initializing application...');
    uiManager.showLoading('অ্যাপ্লিকেশন লোড হচ্ছে...');

    try {
      this.managers.themeManager.init();
      this._initComponents();
      this._setupGlobalEventListeners(); // Uses uiManager.addListener
      await this._loadInitialData();
      this._populateInitialFilters(); // Populate filters *after* data load
      this.showPage('dashboard'); // Show default page

      console.log('✅ Application initialized successfully.');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      uiManager.showToast(`অ্যাপ্লিকেশন লোড হতে ব্যর্থ হয়েছে: ${error.message}`, 'error', 10000);
      if (uiManager.elements.appContainer) {
        uiManager.elements.appContainer.innerHTML = `<div class="p-6 text-center text-red-600 dark:text-red-400">অ্যাপ্লিকেশন শুরু হতে একটি গুরুতর ত্রুটি ঘটেছে।</div>`;
      }
    } finally {
      // Auth listener handles hiding the initial loader
      if (!stateManager.get('authLoading')) {
        uiManager.hideLoading();
      }
    }
  }

  /**
   * Initializes all component modules, passing necessary dependencies.
   * @private
   */
  _initComponents() {
    console.log('⚙️ Initializing components...');
    const dependencies = {
      managers: this.managers,
      services: this.services,
      utils: this.utils, // Pass the complete helpers namespace
      app: this,
    };

    try {
      // Initialize components
      this.components.groups = groups.init(dependencies);
      this.components.tasks = tasks.init(dependencies);
      this.components.dashboard = dashboard.init(dependencies);
      this.components.members = members.init(dependencies);
      this.components.evaluation = evaluation.init(dependencies);
      this.components.settings = settings.init(dependencies);
      this.components.classManagement = classManagement.init(dependencies);
      this.components.teacherManagement = teacherManagement.init(dependencies);
      this.components.admin = admin.init(dependencies);
      this.components.exportModule = exportModule.init(dependencies);
      this.components.policy = policy.init(dependencies);
      this.components.upcomingAssignments = upcomingAssignments.init(dependencies);
      this.components.statistics = statistics.init(dependencies);
      this.components.ranking = ranking.init(dependencies);
      this.components.analysis = analysis.init(dependencies);
      this.components.studentFilter = studentFilter.init(dependencies);

      console.log('👍 All components initialized.');
    } catch (error) {
      console.error('❌ Error initializing components:', error);
      throw new Error(`Component initialization failed: ${error.message}`);
    }
  }

  /**
   * Sets up global event listeners using uiManager.addListener.
   * @private
   */
  _setupGlobalEventListeners() {
    console.log('🔗 Setting up global event listeners...');
    const uiManagerInstance = this.managers.uiManager; // Alias for clarity

    // --- Navigation (Event Delegation on Sidebar) ---
    if (uiManagerInstance.elements.sidebar) {
      uiManagerInstance.addListener(uiManagerInstance.elements.sidebar, 'click', (e) => {
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn && !navBtn.disabled) {
          const pageId = navBtn.dataset.page;
          if (pageId) {
            e.preventDefault();
            this.showPage(pageId);
          }
        }
      });
    } else {
      console.warn('Sidebar element not found for setting up navigation.');
    }

    // --- Authentication Actions ---
    uiManagerInstance.addListener(uiManagerInstance.elements.loginBtn, 'click', () => this._handleLogin());
    uiManagerInstance.addListener(uiManagerInstance.elements.registerBtn, 'click', () => this._handleRegister());
    uiManagerInstance.addListener(uiManagerInstance.elements.googleSignInBtn, 'click', () =>
      this._handleGoogleSignIn()
    );
    uiManagerInstance.addListener(uiManagerInstance.elements.confirmLogout, 'click', () => this._handleLogout());

    console.log('🎧 Global event listeners attached.');
  }

  /**
   * Loads essential initial data into the stateManager.
   * @private
   */
  async _loadInitialData() {
    console.log('⏳ Loading initial data...');
    try {
      const [groupsResult, studentsResult, tasksResult, evaluationsResult, globalSettingsResult, classesResult, sectionsResult, subjectsResult, teachersResult] = await Promise.allSettled([
        this.services.dataService.loadGroups(),
        this.services.dataService.loadStudents(),
        this.services.dataService.loadTasks(),
        this.services.dataService.loadEvaluations(),
        this.services.dataService.loadGlobalSettings(),
        this.services.dataService.loadClasses(),
        this.services.dataService.loadSections(),
        this.services.dataService.loadSubjects(),
        this.services.dataService.loadTeachers(),
      ]);

      const groupsData = groupsResult.status === 'fulfilled' ? groupsResult.value : [];
      const studentsData = studentsResult.status === 'fulfilled' ? studentsResult.value : [];
      const tasksData = tasksResult.status === 'fulfilled' ? tasksResult.value : [];
      const evaluationsData = evaluationsResult.status === 'fulfilled' ? evaluationsResult.value : [];
      const globalSettings = globalSettingsResult.status === 'fulfilled' ? globalSettingsResult.value : {};
      const classesData = classesResult.status === 'fulfilled' ? classesResult.value : [];
      const sectionsData = sectionsResult.status === 'fulfilled' ? sectionsResult.value : [];
      const subjectsData = subjectsResult.status === 'fulfilled' ? subjectsResult.value : [];
      const teachersData = teachersResult.status === 'fulfilled' ? teachersResult.value : [];

      if (groupsResult.status === 'rejected') console.warn('⚠️ Failed to load groups:', groupsResult.reason);
      if (studentsResult.status === 'rejected') console.warn('⚠️ Failed to load students:', studentsResult.reason);
      if (tasksResult.status === 'rejected') console.warn('⚠️ Failed to load tasks:', tasksResult.reason);
      if (evaluationsResult.status === 'rejected') console.warn('⚠️ Failed to load evaluations:', evaluationsResult.reason);
      if (globalSettingsResult.status === 'rejected') console.warn('⚠️ Failed to load global settings:', globalSettingsResult.reason);
      if (classesResult.status === 'rejected') console.warn('⚠️ Failed to load classes:', classesResult.reason);
      if (sectionsResult.status === 'rejected') console.warn('⚠️ Failed to load sections:', sectionsResult.reason);
      if (subjectsResult.status === 'rejected') console.warn('⚠️ Failed to load subjects:', subjectsResult.reason);
      if (teachersResult.status === 'rejected') console.warn('⚠️ Failed to load teachers:', teachersResult.reason);

      this.managers.stateManager.update({
        groups: groupsData || [],
        students: studentsData || [],
        tasks: tasksData || [],
        evaluations: evaluationsData || [],
        classes: classesData || [],
        sections: sectionsData || [],
        subjects: subjectsData || [],
        teachers: teachersData || [],
      });

      // If logged in as teacher, set active context (future feature)
      const currentUser = this.managers.stateManager.get('currentUser');
      const currentTeacher = this.managers.stateManager.get('currentTeacher');
      
      if (currentUser && currentTeacher) {
        // Set default context from teacher's first assignment
        if (currentTeacher.assignedClasses && currentTeacher.assignedClasses.length > 0) {
          this.managers.stateManager.setActiveContext({
            classId: currentTeacher.assignedClasses[0],
            sectionId: currentTeacher.assignedSections?.[0] || null,
            subjectId: currentTeacher.assignedSubjects?.[0] || null,
            teacherId: currentTeacher.id
          });
          console.log('📚 Teacher context set:', this.managers.stateManager.get('activeContext'));
        }
      }
      
      if (globalSettings && globalSettings.dashboardConfig) {
        console.log('🌍 Global Dashboard Config Loaded:', globalSettings.dashboardConfig);
        this.managers.stateManager.setDashboardConfig(globalSettings.dashboardConfig);
      }

      console.log('📊 Initial data loaded and state updated.');
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
      this.managers.uiManager.showToast(` প্রাথমিক ডেটা লোড করতে সমস্যা হয়েছে: ${error.message}`, 'error');
    }
  }

  /**
   * Populates filter dropdowns after initial data load.
   * @private
   */
  _populateInitialFilters() {
    console.log('🔧 Populating initial filters...');
    try {
      // Components check internally if elements exist
      this.components.members?.populateFilters();

      // Render functions often include filter population
      // Call them only if the component exists
      this.components.evaluation?.render();
      this.components.analysis?.renderSummary();
      this.components.statistics?.render();
    } catch (error) {
      console.error('❌ Error populating initial filters:', error);
      this.managers.uiManager.showToast('ফিল্টার অপশন লোড করতে সমস্যা হয়েছে।', 'warning');
    }
  }

  // --- Page Navigation & Rendering Logic ---
  /**
   * Shows a specific page, handling permissions and triggering component render.
   * @param {string} pageId - The ID of the page to show.
   */
  showPage(pageId) {
    if (!pageId || typeof pageId !== 'string') {
      console.warn(`showPage: Invalid pageId "${pageId}". Defaulting to dashboard.`);
      pageId = 'dashboard';
    }
    console.log(`Navigating to page: ${pageId}`);

    if (!this._checkAuthAndPermissions(pageId)) {
      this.managers.uiManager.showToast('এই পৃষ্ঠাটি দেখার জন্য আপনার অনুমতি নেই।', 'warning');
      if (this.managers.stateManager.get('activePage') !== 'dashboard') {
        console.log('Redirecting to dashboard due to permissions.');
        this.showPage('dashboard');
      }
      return;
    }

    this.managers.uiManager.showPage(pageId);

    try {
      // *** FIXED: Updated component key mapping ***
      const componentKey = this._getComponentKeyForPage(pageId);
      const component = componentKey ? this.components[componentKey] : null;

      if (component) {
        let renderFunction = component.render; // Default render function

        // Handle pages that use a component but call a different render method
        if (pageId === 'all-students' && component.renderStudentCards) {
          renderFunction = component.renderStudentCards;
        } else if (pageId === 'group-analysis' && component.renderSummary) {
          renderFunction = component.renderSummary;
        } else if (pageId === 'graph-analysis' && component.renderGraphs) {
          renderFunction = component.renderGraphs;
        }

        if (typeof renderFunction === 'function') {
          console.log(`Rendering component "${componentKey}" for page: ${pageId}`);
          renderFunction();
          // Re-apply settings after render because render might have rebuilt the DOM
          window.smartEvaluator?.components.settings?.applySettings();
        } else {
          console.warn(`No suitable render function found on component "${componentKey}" for page: ${pageId}`);
        }
      } else {
        console.warn(`No component instance found for page key "${componentKey}" (derived from page ID "${pageId}")`);
      }
    } catch (error) {
      console.error(`❌ Error rendering page ${pageId}:`, error);
      this.managers.uiManager.showToast(`'${pageId}' পৃষ্ঠাটি লোড করতে সমস্যা হয়েছে।`, 'error');
      const pageElement = document.getElementById(`page-${pageId}`);
      if (pageElement)
        this.managers.uiManager.displayEmptyMessage(pageElement, 'এই পৃষ্ঠাটি লোড করার সময় একটি ত্রুটি ঘটেছে।');
    }
  }

  /** * Helper to get the component key (e.g., 'ranking') from the page ID (e.g., 'student-ranking').
   * @private
   */
  _getComponentKeyForPage(pageId) {
    switch (pageId) {
      case 'export':
        return 'exportModule';
      case 'all-students':
        return 'members';
      case 'group-analysis':
        return 'analysis';
      case 'graph-analysis':
        return 'analysis';
      // --- ADDED FIXES ---
      case 'student-ranking':
        return 'ranking';
      case 'admin-management':
        return 'admin';
      case 'group-policy':
        return 'policy';
      case 'upcoming-assignments':
        return 'upcomingAssignments';
      case 'student-filter':
        return 'studentFilter';
      case 'class-management':
        return 'classManagement';
      case 'teacher-management':
        return 'teacherManagement';
      case 'public-settings':
        return 'settings';
      // ---------------------
      default:
        return pageId; // Assumes 'dashboard', 'groups', 'members', 'tasks', 'evaluation', 'statistics' match keys
    }
  }

  /** Checks if the current user can access the requested page. */
  _checkAuthAndPermissions(pageId) {
    if (this.publicPages.includes(pageId)) return true;
    const currentUser = this.managers.stateManager.get('currentUser');
    if (!currentUser) return false;
    const userData = this.managers.stateManager.get('currentUserData');
    const userType = userData?.type || 'user';
    if (pageId === 'admin-management') return userType === 'super-admin';
    if (pageId === 'teacher-management') return userType === 'super-admin';
    if (pageId === 'class-management') return userType === 'super-admin';
    if (pageId === 'settings') return userType === 'admin' || userType === 'super-admin';
    if (pageId === 'public-settings') return true; // Allow any logged in user
    
    // Teacher Access Control
    if (userType === 'teacher') {
        return ['tasks', 'evaluation'].includes(pageId);
    }

    return userType === 'admin' || userType === 'super-admin';
  }

  // --- Auth Event Handlers ---
  async _handleLogin() {
    const email = this.managers.uiManager.elements.loginEmail?.value;
    const password = this.managers.uiManager.elements.loginPassword?.value;
    if (!email || !password) {
      this.managers.uiManager.showToast('ইমেইল এবং পাসওয়ার্ড দিন।', 'warning');
      return;
    }
    this.managers.uiManager.showLoading('লগইন করা হচ্ছে...');
    try {
      await this.services.auth.loginWithEmail(email, password);
    } catch (error) {
      console.error('Login failed (handled by authService):', error.message);
    } finally {
      this.managers.uiManager.hideLoading();
    }
  }
  async _handleRegister() {
    const email = this.managers.uiManager.elements.registerEmail?.value;
    const password = this.managers.uiManager.elements.registerPassword?.value;
    const type = this.managers.uiManager.elements.adminType?.value;
    if (!email || !password || password.length < 6) {
      this.managers.uiManager.showToast('সঠিক ইমেইল এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।', 'warning');
      return;
    }
    this.managers.uiManager.showLoading('রেজিস্ট্রেশন চলছে...');
    try {
      await this.services.auth.registerWithEmail(email, password, type);
      this.managers.uiManager._toggleAuthForm(false);
    } catch (error) {
      console.error('Registration failed (handled by authService):', error.message);
    } finally {
      this.managers.uiManager.hideLoading();
    }
  }
  async _handleGoogleSignIn() {
    this.managers.uiManager.showLoading('Google সাইন ইন করা হচ্ছে...');
    try {
      await this.services.auth.signInWithGoogle();
    } catch (error) {
      console.error('Google Sign-In failed (handled by authService):', error.message);
    } finally {
      this.managers.uiManager.hideLoading();
    }
  }
  async _handleLogout() {
    this.managers.uiManager.showLoading('লগআউট করা হচ্ছে...');
    try {
      await this.services.auth.logout();
      this.managers.uiManager.hideModal(this.managers.uiManager.elements.logoutModal);
    } catch (error) {
      console.error('Logout failed (handled by authService):', error.message);
    } finally {
      this.managers.uiManager.hideLoading();
    }
  }

  // --- Public Method for Data Refresh ---
  async refreshAllData() {
    console.log('🔄 Forcing data refresh...');
    this.managers.cacheManager.setForceRefresh();
    this.managers.uiManager.showLoading('ডেটা রিফ্রেশ করা হচ্ছে...');
    try {
      await this._loadInitialData();
      this._populateInitialFilters();
      const currentPage = this.managers.stateManager.get('activePage');
      if (currentPage) this.showPage(currentPage); // Re-render current page
      this.managers.uiManager.showToast('ডেটা সফলভাবে রিফ্রেশ করা হয়েছে!', 'success');
    } catch (error) {
      console.error('❌ Data refresh failed:', error);
      this.managers.uiManager.showToast('ডেটা রিফ্রেশ ব্যর্থ হয়েছে।', 'error');
    } finally {
      this.managers.uiManager.hideLoading();
    }
  }
}

// --- Application Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
  try {
    const app = new SmartGroupEvaluator();
    window.smartEvaluator = app; // Make instance globally accessible
    app.init(); // Start initialization
    console.log('✅ Application instance created and init sequence started.');
  } catch (error) {
    console.error('❌ Failed to instantiate/initialize SmartGroupEvaluator:', error);
    const errorContainer = document.getElementById('appContainer') || document.body;
    errorContainer.innerHTML = `<div class="p-6 text-center text-red-600 dark:text-red-400">অ্যাপ্লিকেশন শুরু হতে ত্রুটি: ${error.message}</div>`;
  }
});
