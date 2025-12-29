// js/managers/stateManager.js

/**
 * Manages the global application state including core data, user info, and UI filters.
 */
class StateManager {
  constructor() {
    this._state = this._initializeState();
    this.state = this._state; // Direct access for simplicity
    console.log('StateManager initialized.');
  }

  /**
   * Defines the initial structure and default values of the application state.
   * @returns {object} The initial state object.
   * @private
   */
  _initializeState() {
    return {
      // Core Application Data
      groups: [],
      students: [],
      tasks: [],
      evaluations: [],
      admins: [],
      classes: [],
      sections: [],
      subjects: [],
      teachers: [],

      // Multi-Teacher System
      currentTeacher: null,
      activeContext: {
        classId: null,
        sectionId: null,
        subjectId: null,
        session: null,
        teacherId: null
      },

      // Authentication & User State
      currentUser: null,
      currentUserData: null,
      authLoading: true,
      isPublicMode: true,

      // UI Filters (Centralized)
      filters: {
        membersList: {
          searchTerm: '',
          groupFilter: 'all',
          academicFilter: 'all',
        },
        studentCards: {
          searchTerm: '',
          groupFilter: 'all',
          academicFilter: 'all',
        },
        groupAnalysis: {
          groupFilter: 'all',
        },
        graphAnalysis: {
          groupFilter: 'all',
          startDate: '',
          endDate: '',
          studentSearch: '',
        },
        statistics: {
          taskFilter: 'all',
          groupFilter: 'all',
          evaluationType: 'all',
          viewMode: 'table',
          showPendingOnly: false,
        },
        analysis: {
          groupFilter: 'all',
          taskFilter: 'all',
          evaluationType: 'all',
          viewMode: 'table',
          showFullOnly: false,
          criteriaView: 'topic',
          summaryEvaluationView: 'table',
        },
        adminManagement: {
          searchTerm: '',
        },
      },
      
      // Dashboard Configuration (Forced Assignment)
      dashboardConfig: {
        forceAssignmentId: null,
        isForced: false
      },

      // Other UI State
      activePage: 'dashboard',
      isLoading: false,
    };
  }

  // --- State Accessors ---

  getState() {
    return this.state;
  }
  get(key) {
    if (key in this.state) return this.state[key];
    console.warn(`Attempted to get unknown state key: ${key}`);
    return undefined;
  }

  // --- State Mutators ---
  set(key, value) {
    if (key in this.state) {
      this.state[key] = value;
      // console.log(`State updated - ${key}:`, value); // Debug
    } else {
      console.warn(`Attempted to set unknown state key: ${key}`);
    }
  }

  update(updates) {
    if (typeof updates !== 'object' || updates === null) {
      console.warn('StateManager update called with invalid argument:', updates);
      return;
    }
    for (const key in updates) {
      if (updates.hasOwnProperty(key) && key in this.state) {
        this.set(key, updates[key]);
      } else if (updates.hasOwnProperty(key)) {
        console.warn(`Attempted to update unknown state key during bulk update: ${key}`);
      }
    }
  }

  // --- Filter Specific Methods ---
  getFilters() {
    return this.state.filters;
  }

  getFilterSection(sectionKey) {
    if (sectionKey in this.state.filters) return this.state.filters[sectionKey];
    console.warn(`Attempted to get unknown filter section: ${sectionKey}`);
    return undefined;
  }

  updateFilters(sectionKey, filterUpdates) {
    if (!(sectionKey in this.state.filters)) {
      console.warn(`Attempted to update filters for unknown section: ${sectionKey}`);
      return false;
    }
    if (typeof filterUpdates !== 'object' || filterUpdates === null) {
      console.warn(`Invalid filterUpdates provided for section ${sectionKey}:`, filterUpdates);
      return false;
    }
    const sectionFilters = this.state.filters[sectionKey];
    let changed = false;
    for (const key in filterUpdates) {
      if (filterUpdates.hasOwnProperty(key) && key in sectionFilters) {
        if (sectionFilters[key] !== filterUpdates[key]) {
          sectionFilters[key] = filterUpdates[key];
          changed = true;
        }
      } else if (filterUpdates.hasOwnProperty(key)) {
        console.warn(`Attempted to update unknown filter key "${key}" in section "${sectionKey}"`);
      }
    }
    return changed;
  }

  resetAllFilters() {
    const initialFilters = this._initializeState().filters;
    this.set('filters', JSON.parse(JSON.stringify(initialFilters)));
    console.log('All filters reset.');
  }

  resetFiltersForSection(sectionKey) {
    if (!(sectionKey in this.state.filters)) {
      console.warn(`Attempted to reset filters for unknown section: ${sectionKey}`);
      return;
    }
    const initialSectionFilters = this._initializeState().filters[sectionKey];
    this.state.filters[sectionKey] = JSON.parse(JSON.stringify(initialSectionFilters));
    console.log(`Filters reset for section: ${sectionKey}`);
  }

  // --- User/Auth Specific ---
  setUser(user, userData) {
    this.update({
      currentUser: user,
      currentUserData: userData,
      isPublicMode: !user,
      authLoading: false,
    });
  }
  setAuthLoading(isLoading) {
    this.set('authLoading', isLoading);
  }

  // --- Loading State ---
  setLoading(isLoading) {
    this.set('isLoading', isLoading);
  }

  // --- Dashboard Config Persistence ---

  getDashboardConfig() {
    // Return in-memory state which is populated from server on app init
    return this.state.dashboardConfig || { forceAssignmentId: null, isForced: false };
  }

  setDashboardConfig(config) {
    this.state.dashboardConfig = { ...this.state.dashboardConfig, ...config };
    // We don't save to localStorage anymore to ensure global sync is the source of truth
    console.log('Dashboard config updated (State):', this.state.dashboardConfig);
  }

  // --- Multi-Teacher System ---

  /**
   * Set the active context for data filtering (used by teachers)
   */
  setActiveContext(contextUpdates) {
    if (typeof contextUpdates !== 'object' || contextUpdates === null) {
      console.warn('setActiveContext called with invalid argument:', contextUpdates);
      return;
    }
    this.state.activeContext = { ...this.state.activeContext, ...contextUpdates };
    console.log('Active context updated:', this.state.activeContext);
  }

  /**
   * Get filtered data based on current user role and active context
   * @param {string} collectionName - Name of the collection (groups, students, tasks, etc.)
   * @returns {Array} Filtered array
   */
  getFilteredData(collectionName) {
    const collection = this.state[collectionName];
    if (!Array.isArray(collection)) {
      console.warn(`getFilteredData called with invalid collection: ${collectionName}`);
      return [];
    }

    const currentUserType = this.state.currentUserData?.type;
    
    // Super admin sees everything
    if (currentUserType === 'super-admin') {
      return collection;
    }
    
    // Teachers see filtered data based on activeContext OR assigned data
    if (currentUserType === 'teacher') {
      const context = this.state.activeContext;
      const teacher = this.state.currentTeacher; // Use currentTeacher which has assignments!
      const assignedClasses = teacher?.assignedClasses || [];
      const assignedSections = teacher?.assignedSections || [];
      const assignedSubjects = teacher?.assignedSubjects || [];
      
      return collection.filter(item => {
        // For tasks collection: strictly require subjectId
        if (collectionName === 'tasks') {
            if (!item.subjectId) return false; // Hide tasks without subject
            if (context.subjectId && item.subjectId !== context.subjectId) return false;
            if (!context.subjectId && assignedSubjects.length > 0 && !assignedSubjects.includes(item.subjectId)) return false;
            return true; // Tasks are filtered by subject only
        }

        // 1. Class Filter
        if (item.classId) {
            if (context.classId && item.classId !== context.classId) return false;
            if (!context.classId && assignedClasses.length > 0 && !assignedClasses.includes(item.classId)) return false;
        }

        // 2. Section Filter
        if (item.sectionId) {
            if (context.sectionId && item.sectionId !== context.sectionId) return false;
            if (!context.sectionId && assignedSections.length > 0 && !assignedSections.includes(item.sectionId)) return false;
        }

        // 3. Subject Filter
        if (item.subjectId) {
            if (context.subjectId && item.subjectId !== context.subjectId) return false;
            if (!context.subjectId && assignedSubjects.length > 0 && !assignedSubjects.includes(item.subjectId)) return false;
        }
        
        // 4. Teacher ID Filter (if applicable, though usually class/subject is enough)
        if (item.teacherId && context.teacherId && item.teacherId !== context.teacherId) {
          return false;
        }
        
        return true;
      });
    }
    
    // Public users and regular admins see everything (for now)
    return collection;
  }
}

const stateManager = new StateManager();
export default stateManager;
