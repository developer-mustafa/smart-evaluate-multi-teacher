// js/components/evaluation.js

// নির্ভরতা (Dependencies)
let stateManager, uiManager, dataService, helpers, app, tasksComponent, permissionHelper;
import { serverTimestamp } from '../config/firebase.js'; // <-- FIXED: Import serverTimestamp

// DOM এলিমেন্ট
const elements = {};
let currentEditingEvaluationId = null;
let currentTaskBreakdown = null;

// --- Evaluation Model Constants ---
const SCORE_BREAKDOWN_MAX = {
  task: 20,
  team: 15,
  additional: 25,
  mcq: 40,
};
const TOTAL_MAX_SCORE = 100;

const ROLE_BADGE_META = {
  'team-leader': {
    label: 'টিম লিডার',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-500/40',
  },
  'time-keeper': {
    label: 'টাইম কিপার',
    className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-500/40',
  },
  reporter: {
    label: 'রিপোর্টার',
    className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-100 dark:border-purple-500/40',
  },
  'resource-manager': {
    label: 'রিসোর্স ম্যানেজার',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-500/40',
  },
  'peace-maker': {
    label: 'পিস মেকার',
    className: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-100 dark:border-rose-500/40',
  },
};

// Subject color palette for unique subject badges (Safe Colors & High Contrast)
const SUBJECT_COLORS = [
  'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-white dark:border-red-700',
  'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-white dark:border-orange-700',
  'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-white dark:border-yellow-700',
  'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-white dark:border-green-700',
  'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900 dark:text-white dark:border-teal-700',
  'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-white dark:border-blue-700',
  'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-white dark:border-indigo-700',
  'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-white dark:border-purple-700',
  'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900 dark:text-white dark:border-pink-700',
  'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-white dark:border-gray-600',
];

// Class color palette for unique class badges (Safe Colors & High Contrast)
const CLASS_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-white dark:border-blue-700',
  'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-white dark:border-indigo-700',
  'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900 dark:text-white dark:border-violet-700',
  'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-white dark:border-purple-700',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-900 dark:text-white dark:border-fuchsia-700',
  'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900 dark:text-white dark:border-pink-700',
  'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900 dark:text-white dark:border-rose-700',
  'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-white dark:border-orange-700',
  'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-white dark:border-amber-700',
  'bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900 dark:text-white dark:border-lime-700',
  'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-white dark:border-emerald-700',
  'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900 dark:text-white dark:border-teal-700',
  'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900 dark:text-white dark:border-cyan-700',
  'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900 dark:text-white dark:border-sky-700',
];

// Get consistent color for a subject based on its name
function _getSubjectColor(subjectName) {
  if (!subjectName) return SUBJECT_COLORS[0];

  // Predefined colors for common subjects to ensure distinctness
  const lowerName = subjectName.trim().toLowerCase();
  if (lowerName.includes('বাংলা') || lowerName.includes('bangla')) return SUBJECT_COLORS[0]; // Red/Rose
  if (lowerName.includes('ইংরেজি') || lowerName.includes('english')) return SUBJECT_COLORS[5]; // Blue
  if (lowerName.includes('গণিত') || lowerName.includes('math')) return SUBJECT_COLORS[1]; // Orange
  if (lowerName.includes('আইসিটি') || lowerName.includes('ict') || lowerName.includes('তথ্য')) return SUBJECT_COLORS[4]; // Teal
  if (lowerName.includes('বিজ্ঞান') || lowerName.includes('science')) return SUBJECT_COLORS[3]; // Green
  if (lowerName.includes('ধর্ম') || lowerName.includes('religion') || lowerName.includes('ইসলাম')) return SUBJECT_COLORS[7]; // Purple
  if (lowerName.includes('পদার্থ') || lowerName.includes('physics')) return SUBJECT_COLORS[8]; // Indigo
  if (lowerName.includes('রসায়ন') || lowerName.includes('chemistry')) return SUBJECT_COLORS[2]; // Yellow/Amber
  if (lowerName.includes('জীব') || lowerName.includes('biology')) return SUBJECT_COLORS[6]; // Pink/Fuchsia

  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

// Get consistent color for a class based on its name
function _getClassColor(className) {
  if (!className) return CLASS_COLORS[0];
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = className.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CLASS_COLORS[Math.abs(hash) % CLASS_COLORS.length];
}

// Additional Criteria Definitions
const additionalCriteria = {
  topic: [
    { id: 'topic_none', text: 'এখনো এই টাস্ক পারিনা', marks: -5 },
    { id: 'topic_understood', text: 'শুধু বুঝেছি', marks: 5 },
    { id: 'topic_learned_well', text: 'ভালো করে শিখেছি', marks: 10 },
  ],
  options: [
    { id: 'homework_done', text: 'সপ্তাহে প্রতিদিন বাড়ির কাজ করেছি', marks: 5 },
    { id: 'attendance_regular', text: 'সাপ্তাহিক নিয়মিত উপস্থিতি', marks: 10 },
  ],
};

function _renderStudentRoleBadge(roleCode) {
  const baseClasses =
    'inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border mt-1';
  if (!roleCode) {
    return `<span class="${baseClasses} bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">দায়িত্ব নির্ধারিত নয়</span>`;
  }
  const meta = ROLE_BADGE_META[roleCode] || {
    label: helpers?.ensureBengaliText ? helpers.ensureBengaliText(roleCode) : roleCode,
    className:
      'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
  };
  const label = meta.label || (helpers?.ensureBengaliText ? helpers.ensureBengaliText(roleCode) : roleCode);
  const className = meta.className || '';
  return `<span class="${baseClasses} ${className}">${label}</span>`;
}

/**
 * Evaluation কম্পোনেন্ট শুরু করে (Initialize)।
 */
export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  dataService = dependencies.services.dataService;
  permissionHelper = dependencies.utils.permissionHelper;
  helpers = dependencies.utils;
  app = dependencies.app;
  tasksComponent = dependencies.app.components.tasks;

  _cacheDOMElements();
  _setupEventListeners();
  console.log('✅ Evaluation component initialized.');
  return { render };
}

/**
 * Evaluation পেজ (#page-evaluation) রেন্ডার করে।
 */
export function render() {
  if (!elements.page) {
    console.error('❌ Evaluation render failed: Page element not found.');
    return;
  }
  console.log('Rendering Evaluation page...');
  _populateSelectors();
  _renderDashboardConfig(); // Add this line
  _renderEvaluationList();
  if (!currentEditingEvaluationId) {
    uiManager.clearContainer(elements.evaluationFormContainer);
    currentTaskBreakdown = null;
  }
}

/**
 * DOM এলিমেন্ট ক্যাশ করে।
 * @private
 */
function _cacheDOMElements() {
  elements.page = document.getElementById('page-evaluation');
  if (elements.page) {
    elements.evaluationTaskSelect = elements.page.querySelector('#evaluationTaskSelect');
    elements.evaluationGroupSelect = elements.page.querySelector('#evaluationGroupSelect');
    elements.evaluationClassSelect = elements.page.querySelector('#evaluationClassSelect');
    elements.evaluationSectionSelect = elements.page.querySelector('#evaluationSectionSelect');
    elements.evaluationSubjectSelect = elements.page.querySelector('#evaluationSubjectSelect');
    elements.startEvaluationBtn = elements.page.querySelector('#startEvaluationBtn');
    elements.dashboardConfigContainer = elements.page.querySelector('#dashboardConfigContainer'); // Add this
    elements.evaluationFormContainer = elements.page.querySelector('#evaluationForm');
    elements.evaluationListTableBody = elements.page.querySelector('#evaluationListTable');
  } else {
    console.error('❌ Evaluation init failed: #page-evaluation element not found!');
  }
}

/**
 * ইভেন্ট লিসেনার সেট আপ করে।
 * @private
 */
function _setupEventListeners() {
  if (!elements.page) return;
  
  // Filter change listeners
  if (elements.evaluationClassSelect) {
      uiManager.addListener(elements.evaluationClassSelect, 'change', () => {
          _updateDependentFilters();
          _filterEvaluationOptions();
      });
  }
  if (elements.evaluationSectionSelect) {
      uiManager.addListener(elements.evaluationSectionSelect, 'change', _filterEvaluationOptions);
  }
  if (elements.evaluationSubjectSelect) {
      uiManager.addListener(elements.evaluationSubjectSelect, 'change', _filterEvaluationOptions);
  }

  uiManager.addListener(elements.startEvaluationBtn, 'click', _handleStartOrEditEvaluation);
  uiManager.addListener(elements.evaluationFormContainer, 'submit', (e) => {
    if (e.target && e.target.id === 'dynamicEvaluationForm') {
      e.preventDefault();
      _handleSubmitEvaluation();
    }
  });
  uiManager.addListener(elements.evaluationFormContainer, 'click', (e) => {
    if (e.target && e.target.id === 'cancelEvaluationBtn') _handleCancelEvaluation();
  });
  uiManager.addListener(elements.evaluationFormContainer, 'input', (e) => {
    if (
      e.target &&
      (e.target.classList.contains('score-input') ||
        e.target.classList.contains('criteria-input') ||
        e.target.classList.contains('comments-input'))
    ) {
      _handleScoreInput(e.target);
    }
  });
  uiManager.addListener(elements.evaluationListTableBody, 'click', (e) => {
    const editBtn = e.target.closest('.edit-evaluation-btn');
    const deleteBtn = e.target.closest('.delete-evaluation-btn');
    if (editBtn) _handleEditEvaluation(editBtn.dataset.id);
    else if (deleteBtn) _handleDeleteEvaluation(deleteBtn.dataset.id);
  });
}

/**
 * টাস্ক এবং গ্রুপ সিলেক্ট ড্রপডাউন পপুলেট করে।
 * @private
 */
function _populateSelectors() {
  console.log('📋 Populating evaluation selectors...');
  
  // Populate Filter Dropdowns (Class, Section, Subject)
  const classes = stateManager.get('classes') || [];
  const sections = stateManager.get('sections') || [];
  const subjects = stateManager.get('subjects') || [];
  const user = stateManager.get('currentUserData');
  
  let availableClasses = classes;
  let availableSections = sections;
  let availableSubjects = subjects;

  // Teacher Restriction Logic - Strict & Robust
  if (user && user.type === 'teacher') {
      const teacher = stateManager.get('currentTeacher');
      const assignedClasses = teacher?.assignedClasses || [];
      const assignedSections = teacher?.assignedSections || [];
      const assignedSubjects = teacher?.assignedSubjects || [];
      
      const assignedSectionNames = new Set(
          sections.filter(s => assignedSections.includes(s.id)).map(s => s.name?.trim())
      );
      const assignedSubjectNames = new Set(
          subjects.filter(s => assignedSubjects.includes(s.id)).map(s => s.name?.trim())
      );
      
      if (assignedClasses.length > 0) availableClasses = classes.filter(c => assignedClasses.includes(c.id));
      
      if (assignedSections.length > 0) {
          availableSections = sections.filter(s => 
              assignedSections.includes(s.id) || (s.name && assignedSectionNames.has(s.name.trim()))
          );
      }
      
      if (assignedSubjects.length > 0) {
          availableSubjects = subjects.filter(s => 
              assignedSubjects.includes(s.id) || (s.name && assignedSubjectNames.has(s.name.trim()))
          );
      }
  }

  if (elements.evaluationClassSelect) uiManager.populateSelect(elements.evaluationClassSelect, availableClasses.map(c => ({ value: c.id, text: c.name })), 'সকল ক্লাস');
  
  // Initial population of dependent filters
  _updateDependentFilters();
  
  // Initial population of Task and Group (will be filtered by default "All")
  _filterEvaluationOptions();
}

/**
 * Updates Section and Subject dropdowns based on selected Class.
 * Ensures no duplicates and only relevant options are shown.
 * @private
 */
function _updateDependentFilters() {
    const selectedClassId = elements.evaluationClassSelect?.value;
    const sections = stateManager.get('sections') || [];
    const subjects = stateManager.get('subjects') || [];
    const tasks = stateManager.get('tasks') || [];
    const user = stateManager.get('currentUserData');

    let availableSections = sections;
    let availableSubjects = subjects;

    // Teacher Restriction Base
    if (user && user.type === 'teacher') {
        const teacher = stateManager.get('currentTeacher');
        const assignedSections = teacher?.assignedSections || [];
        const assignedSubjects = teacher?.assignedSubjects || [];
        
        if (assignedSections.length > 0) {
             // Relaxed Section Filter: Match ID or Name
             const assignedSectionNames = new Set(
                sections.filter(s => assignedSections.includes(s.id)).map(s => s.name?.trim())
             );
             availableSections = sections.filter(s => 
                assignedSections.includes(s.id) || (s.name && assignedSectionNames.has(s.name.trim()))
             );
        }

        if (assignedSubjects.length > 0) {
            // Relaxed Subject Filter: Match ID or Name
            const assignedSubjectNames = new Set(
                subjects.filter(s => assignedSubjects.includes(s.id)).map(s => s.name?.trim())
            );
            availableSubjects = subjects.filter(s => 
                assignedSubjects.includes(s.id) || (s.name && assignedSubjectNames.has(s.name.trim()))
            );
        }
    }

    if (selectedClassId) {
        // Filter Sections: Show sections that have STUDENTS or GROUPS in this class
        const students = stateManager.get('students') || [];
        const groups = stateManager.get('groups') || [];
        
        const sectionsInClass = new Set();
        const sectionNamesInClass = new Set(); // Track names too

        const addSection = (sid) => {
            if (!sid) return;
            sectionsInClass.add(sid);
            const sec = sections.find(s => s.id === sid);
            if (sec && sec.name) sectionNamesInClass.add(sec.name.trim());
        };
        
        // Check students
        students.forEach(s => {
            if (s.classId === selectedClassId) addSection(s.sectionId);
        });
        
        // Check groups
        groups.forEach(g => {
            if (g.classId === selectedClassId) addSection(g.sectionId);
        });

        // Check Tasks
        tasks.forEach(t => {
            if (t.classId === selectedClassId) addSection(t.sectionId);
        });

        if (sectionsInClass.size > 0) {
            availableSections = availableSections.filter(s => 
                sectionsInClass.has(s.id) || (s.name && sectionNamesInClass.has(s.name.trim()))
            );
        }
        
        // Filter Subjects: Show only subjects that have TASKS for this class
        const subjectsInClassTasks = new Set();
        const subjectNamesInClassTasks = new Set();

        tasks.filter(t => t.classId === selectedClassId).forEach(t => {
            if (t.subjectId) {
                subjectsInClassTasks.add(t.subjectId);
                const sub = subjects.find(s => s.id === t.subjectId);
                if (sub && sub.name) subjectNamesInClassTasks.add(sub.name.trim());
            }
        });

        availableSubjects = availableSubjects.filter(s => 
            subjectsInClassTasks.has(s.id) || (s.name && subjectNamesInClassTasks.has(s.name.trim()))
        );
    }

    // Populate with current selection preservation
    const currentSection = elements.evaluationSectionSelect?.value;
    const currentSubject = elements.evaluationSubjectSelect?.value;

    if (elements.evaluationSectionSelect) {
        // Deduplicate sections by name to prevent duplicates in UI
        const uniqueSections = [];
        const seenSectionNames = new Set();
        availableSections.forEach(s => {
            const name = s.name ? s.name.trim() : '';
            if (name && !seenSectionNames.has(name)) {
                seenSectionNames.add(name);
                uniqueSections.push(s);
            }
        });

        uiManager.populateSelect(elements.evaluationSectionSelect, uniqueSections.map(s => ({ value: s.id, text: s.name })), 'সকল শাখা');
        if (currentSection && uniqueSections.some(s => s.id === currentSection)) {
            elements.evaluationSectionSelect.value = currentSection;
        }
    }

    if (elements.evaluationSubjectSelect) {
        // Deduplicate subjects by name
        const uniqueSubjects = [];
        const seenSubjectNames = new Set();
        availableSubjects.forEach(s => {
            const name = s.name ? s.name.trim() : '';
            if (name && !seenSubjectNames.has(name)) {
                seenSubjectNames.add(name);
                uniqueSubjects.push(s);
            }
        });

        uiManager.populateSelect(elements.evaluationSubjectSelect, uniqueSubjects.map(s => ({ value: s.id, text: s.name })), 'সকল বিষয়');
        if (currentSubject && uniqueSubjects.some(s => s.id === currentSubject)) {
            elements.evaluationSubjectSelect.value = currentSubject;
        }
    }
}

/**
 * Filters Task and Group options based on selected Class, Section, and Subject.
 * @private
 */
function _filterEvaluationOptions() {
    const selectedClassId = elements.evaluationClassSelect?.value;
    const selectedSectionId = elements.evaluationSectionSelect?.value;
    const selectedSubjectId = elements.evaluationSubjectSelect?.value;

    const tasks = stateManager.get('tasks') || [];
    const groups = stateManager.get('groups') || [];
    const user = stateManager.get('currentUserData');

    // 1. Filter Tasks
    let filteredTasks = tasks;
    
    // Teacher Restriction for Tasks
    if (user && user.type === 'teacher') {
        const teacher = stateManager.get('currentTeacher');
        const assignedSubjects = teacher?.assignedSubjects || [];
        const subjects = stateManager.get('subjects') || [];
        
        // Strict Subject Filter: Match ID or Name
        const assignedSubjectNames = new Set(
            subjects.filter(s => assignedSubjects.includes(s.id)).map(s => s.name?.trim())
        );
        
        filteredTasks = filteredTasks.filter(t => {
             if (!t.subjectId) return false;
             if (assignedSubjects.includes(t.subjectId)) return true;
             
             const taskSubject = subjects.find(s => s.id === t.subjectId);
             return taskSubject && taskSubject.name && assignedSubjectNames.has(taskSubject.name.trim());
        });
    }

    // Apply Dropdown Filters to Tasks
    console.log('📋 Evaluation Filter - Start:', { 
        totalTasks: tasks.length, 
        selectedClassId, 
        selectedSectionId, 
        selectedSubjectId 
    });
    
    if (selectedClassId) {
        filteredTasks = filteredTasks.filter(t => t.classId === selectedClassId);
        console.log('📋 After class filter:', filteredTasks.length);
    }
    if (selectedSectionId) {
        // Section filter should match by section name due to deduplication
        const sections = stateManager.get('sections') || [];
        const selectedSection = sections.find(s => s.id === selectedSectionId);
        if (selectedSection) {
            filteredTasks = filteredTasks.filter(t => {
                if (!t.sectionId) return true; // Tasks without section are available to all
                const taskSection = sections.find(s => s.id === t.sectionId);
                return taskSection && taskSection.name === selectedSection.name;
            });
        } else {
            filteredTasks = filteredTasks.filter(t => !t.sectionId || t.sectionId === selectedSectionId);
        }
        console.log('📋 After section filter:', filteredTasks.length);
    }
    if (selectedSubjectId) {
        const subjects = stateManager.get('subjects') || [];
        const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
        
        if (selectedSubject && selectedSubject.name) {
             const selectedName = selectedSubject.name.trim();
             filteredTasks = filteredTasks.filter(t => {
                 if (t.subjectId === selectedSubjectId) return true;
                 const taskSubject = subjects.find(s => s.id === t.subjectId);
                 return taskSubject && taskSubject.name && taskSubject.name.trim() === selectedName;
             });
        } else {
             filteredTasks = filteredTasks.filter(t => t.subjectId === selectedSubjectId);
        }
        console.log('📋 After subject filter:', filteredTasks.length);
    }
    
    console.log('📋 Final filtered tasks:', filteredTasks.map(t => ({ name: t.name, classId: t.classId, sectionId: t.sectionId, subjectId: t.subjectId })));

    // 2. Filter Groups
    let filteredGroups = groups;
    
    // Teacher Restriction for Groups
    // User Note: "Group gulo kintu nirdisto class er jonno universal... eki class er jekono sakha ba bishoy er shikkhok... access pabe"
    // Meaning: If a teacher has access to Class X, they should see ALL groups of Class X, regardless of section assignment.
    
    if (user && user.type === 'teacher') {
         const teacher = stateManager.get('currentTeacher');
         const assignedClasses = teacher?.assignedClasses || [];
         const assignedSections = teacher?.assignedSections || [];
         const allSections = stateManager.get('sections') || [];
         
         const assignedSectionNames = new Set(
            allSections.filter(s => assignedSections.includes(s.id)).map(s => s.name?.trim())
         );

         // Filter by Class AND Section (if applicable)
         // Groups are often class-wide, but if a teacher is restricted to Section A, 
         // they should probably only see groups that are explicitly for Section A OR Universal groups?
         // User said: "Group gulo kintu nirdisto class er jonno universal... eki class er jekono sakha ba bishoy er shikkhok... access pabe"
         // This implies Class-level access is enough.
         // BUT, if I am a teacher of Class 6, Section A, and there is a group explicitly for Section B, should I see it?
         // Probably not. 
         
         filteredGroups = filteredGroups.filter(g => {
             if (assignedClasses.length > 0 && !assignedClasses.includes(g.classId)) return false;
             
             // If group has a sectionId, check strict section access
             if (g.sectionId && assignedSections.length > 0) {
                 if (assignedSections.includes(g.sectionId)) return true;
                 const sec = allSections.find(s => s.id === g.sectionId);
                 if (sec && sec.name && assignedSectionNames.has(sec.name.trim())) return true;
                 return false;
             }
             
             return true;
         });
    }

    // Apply Dropdown Filters to Groups
    if (selectedClassId) filteredGroups = filteredGroups.filter(g => g.classId === selectedClassId);
    
    // IMPORTANT: User said groups are universal for the class.
    // So we should NOT filter groups by Section if the user selects a section for filtering Tasks.
    // However, if the group ITSELF is defined with a sectionId, maybe we should?
    // "Universal" implies they might span sections or be independent. 
    // But usually groups are formed within a class. 
    // If I filter by section, and groups are cross-section, I might hide them.
    // Let's LISTEN to the user: "Universal for specific class".
    // So, I will NOT filter groups by Section ID from the dropdown, UNLESS the group strictly belongs to that section.
    // But to be safe and follow "Universal", let's show all groups of that Class.
    
    // Actually, if a group is created with a sectionId, it belongs to that section.
    // If the dropdown selects Section A, should we show Group of Section B? Probably not.
    // But if the group has NO sectionId (global to class), we show it.
    
    if (selectedSectionId) {
        const allSections = stateManager.get('sections') || [];
        const selectedSection = allSections.find(s => s.id === selectedSectionId);
        const selectedSectionName = selectedSection?.name?.trim().toLowerCase();

        filteredGroups = filteredGroups.filter(g => {
            if (!g.sectionId) return true; // Universal group
            
            // Check direct ID match first
            if (g.sectionId === selectedSectionId) return true;
            
            // Fallback to name match
            if (selectedSectionName) {
                const groupSection = allSections.find(s => s.id === g.sectionId);
                const groupSectionName = groupSection?.name?.trim().toLowerCase();
                return groupSectionName === selectedSectionName;
            }
            
            return false;
        });
    }

    // 3. Populate Selects
    // Populate Tasks
    const taskOptions = filteredTasks
        .map(t => {
            let dateStr = '';
            try {
                if (t.date) {
                    if (typeof t.date === 'string') dateStr = t.date;
                    else if (typeof t.date.toDate === 'function') dateStr = t.date.toDate().toISOString();
                    else if (t.date instanceof Date) dateStr = t.date.toISOString();
                }
            } catch (e) { console.warn('Date conversion error', e); }
            
            return {
                value: t.id,
                text: `${helpers.ensureBengaliText(t.name)} (${helpers.formatTimestamp(t.date) || 'N/A'})`,
                sortDate: dateStr
            };
        })
        .sort((a, b) => b.sortDate.localeCompare(a.sortDate));
    
    if (elements.evaluationTaskSelect) {
        uiManager.populateSelect(elements.evaluationTaskSelect, taskOptions, 'টাস্ক নির্বাচন করুন');
        if (elements.evaluationTaskSelect.options.length > 1) {
             elements.evaluationTaskSelect.selectedIndex = 0; // Reset selection
        }
    }

    // Populate Groups
    const groupOptions = filteredGroups.map(g => ({ value: g.id, text: g.name }));
    if (elements.evaluationGroupSelect) {
        uiManager.populateSelect(elements.evaluationGroupSelect, groupOptions, 'গ্রুপ নির্বাচন করুন');
    }
}

/**
 * মূল্যায়ন শুরু বা সম্পাদনার জন্য ফর্ম লোড করার হ্যান্ডলার।
 * @private
 */
async function _handleStartOrEditEvaluation() {
  const taskId = elements.evaluationTaskSelect?.value;
  const groupId = elements.evaluationGroupSelect?.value;
  if (!taskId || !groupId) {
    uiManager.showToast('অনুগ্রহ করে টাস্ক এবং গ্রুপ নির্বাচন করুন।', 'warning');
    return;
  }

  const task = stateManager.get('tasks').find((t) => t.id === taskId);
  const group = stateManager.get('groups').find((g) => g.id === groupId);
  if (!task || !group) {
    uiManager.showToast('নির্বাচিত টাস্ক বা গ্রুপ খুঁজে পাওয়া যায়নি।', 'error');
    return;
  }

  if (!task.maxScoreBreakdown || task.maxScoreBreakdown.mcq === undefined) {
    uiManager.showToast(
      'এই টাস্কটির স্কোর ব্রেকডাউন (task, team, additional, mcq) সেট করা নেই। অনুগ্রহ করে টাস্কটি সম্পাদনা করুন।',
      'error',
      5000
    );
    return;
  }
  currentTaskBreakdown = task.maxScoreBreakdown;

  let studentsInGroup = stateManager
    .get('students')
    .filter((s) => s.groupId === groupId)
    .sort((a, b) => String(a.roll).localeCompare(String(b.roll), undefined, { numeric: true }));

  // Filter students for teacher - use currentTeacher for assignments
  // Teachers can evaluate ALL students from their assigned classes (not restricted by section)
  const user = stateManager.get('currentUserData');
  if (user && user.type === 'teacher') {
      const teacher = stateManager.get('currentTeacher');
      const assignedClasses = teacher?.assignedClasses || [];
      studentsInGroup = studentsInGroup.filter(s => 
          assignedClasses.includes(s.classId)
      );
  }
  if (studentsInGroup.length === 0) {
    uiManager.showToast('নির্বাচিত গ্রুপে কোনো শিক্ষার্থী নেই।', 'warning');
    return;
  }

  const existingEvaluation = stateManager.get('evaluations').find((e) => e.taskId === taskId && e.groupId === groupId);
  if (existingEvaluation) {
    await _loadEvaluationForEditing(existingEvaluation.id, task, group, studentsInGroup);
  } else {
    _renderEvaluationForm(task, group, studentsInGroup, null);
    currentEditingEvaluationId = null;
  }
}

/**
 * ডাইনামিক মূল্যায়ন ফর্ম তৈরি এবং রেন্ডার করে (স্লাইড অনুযায়ী)।
 * @private
 */
function _renderEvaluationForm(task, group, students, existingScores = null) {
  if (!elements.evaluationFormContainer) return;

  const breakdown = task.maxScoreBreakdown || SCORE_BREAKDOWN_MAX;
  const maxTask = parseFloat(breakdown.task) || 0;
  const maxTeam = parseFloat(breakdown.team) || 0;
  const maxAdditional = parseFloat(breakdown.additional) || 0;
  const maxMcq = parseFloat(breakdown.mcq) || 0;
  const totalMaxScore = task.maxScore || maxTask + maxTeam + maxAdditional + maxMcq;

  currentTaskBreakdown = breakdown;

  const classes = stateManager.get('classes') || [];
  const sections = stateManager.get('sections') || [];
  const classesMap = new Map(classes.map(c => [c.id, c]));
  const sectionsMap = new Map(sections.map(s => [s.id, s]));

  let formHtml = `
    <form id="dynamicEvaluationForm" class="card card-body space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 dark:border-gray-600">
             <h3 class="text-xl font-semibold text-gray-800 dark:text-white">
                 ${existingScores ? 'সম্পাদনা' : 'নতুন মূল্যায়ন'}: ${helpers.ensureBengaliText(
    task.name
  )} - ${helpers.ensureBengaliText(group.name)}
             </h3>
             <p class="text-sm text-gray-600 dark:text-gray-400 mt-1 sm:mt-0" title="টাস্ক-${maxTask}, টিম-${maxTeam}, অতি-${maxAdditional}, MCQ-${maxMcq}">
                 মোট সর্বোচ্চ স্কোর: ${helpers.convertToBanglaNumber(totalMaxScore)}
             </p>
        </div>
        <div class="overflow-x-auto relative shadow-md sm:rounded-lg">
            <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead class="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
                    <tr>
                        <th scope="col" class="th w-1/12">রোল</th>
                        <th scope="col" class="th w-2/12">নাম ও দায়িত্ব</th>
                        <th scope="col" class="th text-center w-1/12">টাস্ক (${helpers.convertToBanglaNumber(
                          maxTask
                        )})</th>
                        <th scope="col" class="th text-center w-1/12">টিম (${helpers.convertToBanglaNumber(
                          maxTeam
                        )})</th>
                        <th scope="col" class="th text-center w-1/12">MCQ (${helpers.convertToBanglaNumber(
                          maxMcq
                        )})</th>
                        <th scope="col" class="th text-center w-4/12">
                          <div class="flex flex-col items-center gap-1">
                            <span>অতিরিক্ত ক্রাইটেরিয়া (সর্বোচ্চ ${helpers.convertToBanglaNumber(
                              maxAdditional
                            )})</span>
                            <button type="button" id="unmarkAllCriteriaBtn" class="px-2 py-0.5 text-[10px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 rounded border border-rose-200 dark:border-rose-800 transition-colors">
                              <i class="fas fa-times-circle text-[9px]"></i> আনমার্কড অল
                            </button>
                          </div>
                        </th>
                        <th scope="col" class="th text-center w-1/12">মন্তব্য</th>
                        <th scope="col" class="th text-center w-1/12">মোট (${helpers.convertToBanglaNumber(
                          totalMaxScore
                        )})</th>
                    </tr>
                </thead>
                <tbody>
    `;

  students.forEach((student, index) => {
    const scoreData = existingScores ? existingScores[student.id] : null;
    const rowClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700';
    const criteriaDetails = scoreData?.additionalCriteria || {};
    const topicChoice = criteriaDetails.topic || '';
    const homeworkChecked = criteriaDetails.homework || false;
    const attendanceChecked = criteriaDetails.attendance || false;
    const comments = scoreData?.comments || '';
    const problemRecovered = scoreData?.problemRecovered || false; // Load saved status

    // Determine if checkbox should be visible initially
    const showProblemRecovered = topicChoice === 'topic_none' || topicChoice === 'topic_understood';

    const className = classesMap.get(student.classId)?.name || '-';
    const sectionName = sectionsMap.get(student.sectionId)?.name || '-';

    formHtml += `
            <tr class="${rowClass} border-b dark:border-gray-600 student-row" data-student-id="${student.id}">
                <td class="td font-medium text-gray-900 dark:text-white">${helpers.convertToBanglaNumber(
                  student.roll
                )}</td>
                <td class="td">
                    <div class="font-semibold text-gray-900 dark:text-white">${helpers.ensureBengaliText ? helpers.ensureBengaliText(student.name || '') : student.name || ''}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${className} • ${sectionName}</div>
                    ${_renderStudentRoleBadge(student.role)}
                    
                    <!-- Problem Recovered Checkbox Container -->
                    <div class="problem-recovered-container mt-2 ${showProblemRecovered ? '' : 'hidden'}">
                        <label class="inline-flex items-center space-x-2 cursor-pointer bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-100 dark:border-red-800">
                            <input type="checkbox" class="form-checkbox h-3 w-3 text-red-600 rounded border-gray-300 focus:ring-red-500 problem-recovered-input" 
                                   ${problemRecovered ? 'checked' : ''}>
                            <span class="text-xs font-medium text-red-700 dark:text-red-300">প্রবলেম রিজলভড</span>
                        </label>
                    </div>
                </td>
                <td class="td"><input type="number" step="any" class="score-input task-score" min="0" max="${maxTask}" data-max="${maxTask}" value="${
      scoreData?.taskScore ?? ''
    }" aria-label="${student.name} Task Score"></td>
                <td class="td"><input type="number" step="any" class="score-input team-score" min="0" max="${maxTeam}" data-max="${maxTeam}" value="${
      scoreData?.teamScore ?? ''
    }" aria-label="${student.name} Team Score"></td>
                <td class="td"><input type="number" step="any" class="score-input mcq-score" min="0" max="${maxMcq}" data-max="${maxMcq}" value="${
      scoreData?.mcqScore ?? ''
    }" aria-label="${student.name} MCQ Score"></td>
                <td class="td criteria-cell" data-max-additional="${maxAdditional}">
                    <fieldset class="space-y-2">
                        <legend class="sr-only">অতিরিক্ত ক্রাইটেরিয়া</legend>
                        ${additionalCriteria.topic
                          .map(
                            (opt) => `
                            <label class="flex items-center text-xs space-x-2 cursor-pointer">
                                <input type="radio" name="topic-${student.id}" value="${opt.id}" data-marks="${
                              opt.marks
                            }" ${topicChoice === opt.id ? 'checked' : ''} class="criteria-input topic-radio">
                                <span>${opt.text} (${opt.marks > 0 ? '+' : ''}${helpers.convertToBanglaNumber(
                              opt.marks
                            )})</span>
                            </label>
                        `
                          )
                          .join('')}
                        <hr class="dark:border-gray-600 my-1">
                        ${additionalCriteria.options
                          .map(
                            (opt) => `
                            <label class="flex items-center text-xs space-x-2 cursor-pointer">
                                <input type="checkbox" name="${opt.id}-${student.id}" value="${opt.id}" data-marks="${
                              opt.marks
                            }" ${homeworkChecked && opt.id === 'homework_done' ? 'checked' : ''} ${
                              attendanceChecked && opt.id === 'attendance_regular' ? 'checked' : ''
                            } class="criteria-input">
                                <span>${opt.text} (+${helpers.convertToBanglaNumber(opt.marks)})</span>
                            </label>
                        `
                          )
                          .join('')}
                    </fieldset>
                </td>
                <td class="td"><textarea class="form-input text-xs p-1 comments-input" rows="3" placeholder="পাঠদান-মন্তব্য..." aria-label="${
                  student.name
                } Comments">${comments}</textarea></td>
                <td class="td text-center font-bold text-lg total-score-display dark:text-white" data-total-max="${totalMaxScore}">
                   ${
                     scoreData?.totalScore !== undefined
                       ? helpers.convertToBanglaNumber(parseFloat(scoreData.totalScore).toFixed(2))
                       : '0'
                   }
                </td>
            </tr>
        `;
  });
  formHtml += `
                </tbody>
            </table>
            <style>
                .td { padding: 8px 6px; border: 1px solid #e5e7eb; vertical-align: top; }
                .dark .td { border-color: #4b5563; }
                .th { padding: 10px 6px; border: 1px solid #e5e7eb; vertical-align: middle; }
                .dark .th { border-color: #4b5563; }
                .score-input, .comments-input { width: 100%; min-width: 50px; padding: 4px; border: 1px solid #d1d5db; border-radius: 4px; text-align: center; background-color: white; }
                .dark .score-input, .dark .comments-input { background-color: #374151; border-color: #4b5563; color: white; }
                .score-input:focus, .comments-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; outline: none; }
                .criteria-cell { background-color: #f9fafb; }
                .dark .criteria-cell { background-color: rgba(31, 41, 55, 0.5); }
                .criteria-input { width: 1rem; height: 1rem; cursor: pointer; border: 1px solid #d1d5db; background-color: transparent; accent-color: #2563eb; }
                .dark .criteria-input { border-color: #4b5563; background-color: #1f2937; accent-color: #60a5fa; }
            </style>
        </div>
        <div class="flex justify-end space-x-3 pt-4 border-t dark:border-gray-600">
             <button type="button" id="cancelEvaluationBtn" class="btn btn-light">বাতিল</button>
             <button type="submit" class="btn btn-primary">${existingScores ? 'আপডেট করুন' : 'জমা দিন'}</button>
        </div>
    </form>
    `;
  elements.evaluationFormContainer.innerHTML = formHtml;
  
  // Add event listener for Unmark All button
  const unmarkAllBtn = document.getElementById('unmarkAllCriteriaBtn');
  if (unmarkAllBtn) {
    unmarkAllBtn.addEventListener('click', () => {
      const form = document.getElementById('dynamicEvaluationForm');
      if (!form) return;
      
      // Uncheck all checkboxes and radio buttons in criteria cells
      form.querySelectorAll('.criteria-cell input[type="checkbox"]').forEach(checkbox => {
        if (!checkbox.classList.contains('problem-recovered-input')) {
          checkbox.checked = false;
        }
      });
      
      form.querySelectorAll('.criteria-cell input[type="radio"]').forEach(radio => {
        radio.checked = false;
      });
      
      // Hide all problem recovered containers since no topic is selected
      form.querySelectorAll('.problem-recovered-container').forEach(container => {
        container.classList.add('hidden');
      });
      
      // Recalculate scores for all rows
      form.querySelectorAll('.student-row').forEach(row => {
        const anyInput = row.querySelector('.score-input');
        if (anyInput) {
          _handleScoreInput(anyInput);
        }
      });
      
      uiManager.showToast('সকল অতিরিক্ত ক্রাইটেরিয়া রিসেট করা হয়েছে', 'info', 2000);
    });
  }
}

/**
 * স্কোর ইনপুট বা ক্রাইটেরিয়া পরিবর্তনের সময় মোট স্কোর গণনা করে।
 * @private
 */
function _handleScoreInput(inputElement) {
  const row = inputElement.closest('.student-row');
  if (!row) return;

  // --- Logic for Problem Recovered Visibility ---
  if (inputElement.classList.contains('topic-radio')) {
      const problemRecoveredContainer = row.querySelector('.problem-recovered-container');
      const problemRecoveredInput = row.querySelector('.problem-recovered-input');
      const selectedValue = inputElement.value;

      if (selectedValue === 'topic_none' || selectedValue === 'topic_understood') {
          problemRecoveredContainer.classList.remove('hidden');
      } else {
          problemRecoveredContainer.classList.add('hidden');
          if (problemRecoveredInput) problemRecoveredInput.checked = false; // Uncheck if hidden
      }
  }
  // ----------------------------------------------

  const totalDisplay = row.querySelector('.total-score-display');
  const totalMaxScore = parseFloat(totalDisplay?.dataset.totalMax || TOTAL_MAX_SCORE);

  const breakdown = currentTaskBreakdown || SCORE_BREAKDOWN_MAX;
  const maxTask = parseFloat(breakdown.task) || 0;
  const maxTeam = parseFloat(breakdown.team) || 0;
  const maxAdditional = parseFloat(breakdown.additional) || 0;
  const maxMcq = parseFloat(breakdown.mcq) || 0;

  // 1. Get Numeric Input Scores & Validate
  const taskScoreEl = row.querySelector('.task-score');
  const teamScoreEl = row.querySelector('.team-score');
  const mcqScoreEl = row.querySelector('.mcq-score');

  const getValue = (el, max) => {
    if (!el) return 0;
    let value = el.value === '' ? null : parseFloat(el.value);
    if (value !== null) {
      if (isNaN(value) || value < 0) {
        value = 0;
        el.value = 0;
      } else if (value > max) {
        value = max;
        el.value = max;
        uiManager.showToast(`সর্বোচ্চ নম্বর ${helpers.convertToBanglaNumber(max)}।`, 'warning', 1500);
      }
    }
    return value || 0; // Return 0 if null or NaN
  };

  const taskScore = getValue(taskScoreEl, maxTask);
  const teamScore = getValue(teamScoreEl, maxTeam);
  const mcqScore = getValue(mcqScoreEl, maxMcq);

  // 2. Calculate Additional Criteria Score
  let additionalScore = 0;
  const topicRadio = row.querySelector('input[type="radio"]:checked');
  if (topicRadio) {
    additionalScore += parseFloat(topicRadio.dataset.marks) || 0;
  }
  row.querySelectorAll('input[type="checkbox"]:checked').forEach((checkbox) => {
      // Exclude problem-recovered-input from score calculation
      if (!checkbox.classList.contains('problem-recovered-input')) {
         additionalScore += parseFloat(checkbox.dataset.marks) || 0;
      }
  });
  additionalScore = Math.min(Math.max(additionalScore, -5), maxAdditional); // Cap

  // 3. Calculate Total
  const calculatedTotal = taskScore + teamScore + mcqScore + additionalScore;
  const finalTotal = Math.min(Math.max(calculatedTotal, 0), totalMaxScore); // Cap total 0-TotalMax

  if (totalDisplay) {
    totalDisplay.textContent = helpers.convertToBanglaNumber(finalTotal.toFixed(2));
  }
}

/**
 * মূল্যায়ন ফর্ম বাতিল করে।
 * @private
 */
function _handleCancelEvaluation() {
  uiManager.clearContainer(elements.evaluationFormContainer);
  currentEditingEvaluationId = null;
  currentTaskBreakdown = null;
  if (elements.evaluationTaskSelect) elements.evaluationTaskSelect.selectedIndex = 0;
  if (elements.evaluationGroupSelect) elements.evaluationGroupSelect.selectedIndex = 0;
  uiManager.showToast('মূল্যায়ন বাতিল করা হয়েছে।', 'info');
}

/**
 * মূল্যায়ন ফর্ম সাবমিট করে (4 scores + criteria)।
 * @private
 */
async function _handleSubmitEvaluation() {
  // Permission check
  if (!permissionHelper?.canWrite()) {
    uiManager.showToast('আপনার evaluation submit করার অনুমতি নেই।', 'warning');
    return;
  }

  const taskId = elements.evaluationTaskSelect?.value;
  const groupId = elements.evaluationGroupSelect?.value;
  const task = stateManager.get('tasks').find((t) => t.id === taskId);
  if (!task || !groupId || !currentTaskBreakdown) {
    uiManager.showToast('অবৈধ টাস্ক, গ্রুপ, বা স্কোর ব্রেকডাউন। ফর্মটি রিলোড করুন।', 'error');
    return;
  }

  const { task: maxTask, team: maxTeam, additional: maxAdditional, mcq: maxMcq } = currentTaskBreakdown;
  const totalMaxScore = task.maxScore || TOTAL_MAX_SCORE;

  const scores = {};
  let formIsValid = true;
  let studentCount = 0;
  let groupTotalScoreSum = 0;

  elements.evaluationFormContainer?.querySelectorAll('.student-row').forEach((row) => {
    const studentId = row.dataset.studentId;
    if (!studentId) {
      formIsValid = false;
      return;
    }

    const taskInput = row.querySelector('.task-score');
    const teamInput = row.querySelector('.team-score');
    const mcqInput = row.querySelector('.mcq-score');
    const comments = row.querySelector('.comments-input')?.value.trim() || '';

    const topicRadio = row.querySelector('input[type="radio"]:checked');
    const homeworkCheck = row.querySelector('input[type="checkbox"][value="homework_done"]');
    const attendanceCheck = row.querySelector('input[type="checkbox"][value="attendance_regular"]');
    
    // Capture Problem Recovered status
    const problemRecoveredInput = row.querySelector('.problem-recovered-input');
    const problemRecovered = problemRecoveredInput ? problemRecoveredInput.checked : false;

    const taskScoreRaw = taskInput?.value;
    const teamScoreRaw = teamInput?.value;
    const mcqScoreRaw = mcqInput?.value;

    // Check if row is empty (all score inputs are empty AND no criteria selected)
    const isRowEmpty =
      taskScoreRaw === '' &&
      teamScoreRaw === '' &&
      mcqScoreRaw === '' &&
      !topicRadio &&
      !homeworkCheck?.checked &&
      !attendanceCheck?.checked;

    if (isRowEmpty) {
      row.style.outline = ''; // Not an error, just skip
      return; // Skip this student, don't score them
    }

    // Row is not empty, so validate it
    const taskScore = parseFloat(taskScoreRaw);
    const teamScore = parseFloat(teamScoreRaw);
    const mcqScore = parseFloat(mcqScoreRaw);

    let additionalScore = 0;
    const additionalCriteriaDetails = {
      topic: topicRadio?.value || null,
      homework: homeworkCheck?.checked || false,
      attendance: attendanceCheck?.checked || false,
    };
    if (topicRadio) additionalScore += parseFloat(topicRadio.dataset.marks) || 0;
    if (homeworkCheck?.checked) additionalScore += parseFloat(homeworkCheck.dataset.marks) || 0;
    if (attendanceCheck?.checked) additionalScore += parseFloat(attendanceCheck.dataset.marks) || 0;
    additionalScore = Math.min(Math.max(additionalScore, -5), maxAdditional);

    // --- Validation for non-empty row ---
    let rowIsValid = true;
    if (isNaN(taskScore) || taskScore < 0 || taskScore > maxTask) rowIsValid = false;
    if (isNaN(teamScore) || teamScore < 0 || teamScore > maxTeam) rowIsValid = false;
    if (isNaN(mcqScore) || mcqScore < 0 || mcqScore > maxMcq) rowIsValid = false;
    if (!topicRadio) rowIsValid = false; // Topic understanding is mandatory if row is not empty

    if (!rowIsValid) {
      formIsValid = false;
      row.style.outline = '2px solid red';
      uiManager.showToast(
        `শিক্ষার্থী ${
          row.querySelector('td:nth-child(2)')?.textContent || studentId
        } এর স্কোর বা ক্রাইটেরিয়া অসম্পূর্ণ/অবৈধ।`,
        'warning',
        2500
      );
      return;
    } else {
      row.style.outline = '';
    }
    // --- End Validation ---

    const totalScore = parseFloat((taskScore + teamScore + mcqScore + additionalScore).toFixed(2));
    const cappedTotalScore = Math.min(Math.max(totalScore, 0), totalMaxScore);

    scores[studentId] = {
      taskScore,
      teamScore,
      additionalScore,
      mcqScore,
      totalScore: cappedTotalScore,
      additionalCriteria: additionalCriteriaDetails,
      comments,
      problemRecovered, // Save the status
    };
    groupTotalScoreSum += cappedTotalScore;
    studentCount++; // This student has been scored
  });

  if (!formIsValid) {
    uiManager.showToast('ফর্মটিতে অবৈধ স্কোর রয়েছে। লাল চিহ্নিত সারি পরীক্ষা করুন।', 'error');
    return;
  }

  // Check if at least one student was scored
  if (studentCount === 0) {
    uiManager.showToast('অনুগ্রহ করে কমপক্ষে একজন শিক্ষার্থীর মূল্যায়ন সম্পন্ন করুন।', 'warning');
    return;
  }

  const groupAverageScoreValue = groupTotalScoreSum / studentCount;
  const groupAveragePercent = totalMaxScore > 0 ? (groupAverageScoreValue / totalMaxScore) * 100 : 0;

  const group = stateManager.get('groups').find((g) => g.id === groupId);
  const evaluationData = {
    taskId,
    groupId,
    classId: group?.classId || null,
    sectionId: group?.sectionId || null,
    taskName: task.name,
    groupName: group?.name || 'Unknown',
    scores, // Object containing only the scored students
    studentCount: studentCount, // Number of students actually scored
    groupTotalScore: groupTotalScoreSum,
    groupAverageScore: groupAveragePercent, // Store average percentage
    maxPossibleScore: totalMaxScore,
    evaluationDate: serverTimestamp(), // <-- FIXED: Use serverTimestamp
    taskDate: task.date,
  };

  const action = currentEditingEvaluationId ? 'আপডেট' : 'জমা';
  uiManager.showLoading(`মূল্যায়ন ${action} হচ্ছে...`);
  try {
    if (currentEditingEvaluationId) {
      // Remove 'evaluationDate' on update, use 'updatedAt' (handled by dataService)
      delete evaluationData.evaluationDate;
      await dataService.updateEvaluation(currentEditingEvaluationId, evaluationData);
    } else {
      // Add new evaluation (evaluationDate is set)
      await dataService.addEvaluation(evaluationData);
    }
    await app.refreshAllData();
    _handleCancelEvaluation();
    uiManager.showToast(`মূল্যায়ন ${action} হয়েছে।`, 'success');
    _renderEvaluationList();
  } catch (error) {
    console.error(`❌ Error ${action}ing evaluation:`, error);
    uiManager.showToast(`মূল্যায়ন ${action} দিতে সমস্যা: ${error.message}`, 'error');
  } finally {
    uiManager.hideLoading();
  }
}

/**
 * বিদ্যমান মূল্যায়ন তালিকা রেন্ডার করে।
 * @private
 */
function _renderEvaluationList() {
  if (!elements.evaluationListTableBody) return;
  let evaluations = stateManager.get('evaluations');
  const user = stateManager.get('currentUserData');
  const tasks = stateManager.get('tasks') || [];
  const groups = stateManager.get('groups') || [];
  const classes = stateManager.get('classes') || [];
  const allSubjects = stateManager.get('subjects') || [];
  const allSections = stateManager.get('sections') || [];
  
  if (user && user.type === 'teacher') {
      const teacher = stateManager.get('currentTeacher');
      const assignedSubjects = teacher?.assignedSubjects || [];
      const assignedClasses = teacher?.assignedClasses || [];
      const assignedSections = teacher?.assignedSections || [];
      
      // Pre-calculate name sets for robust matching
      const assignedSubjectNames = new Set(
          allSubjects.filter(s => assignedSubjects.includes(s.id)).map(s => s.name?.trim())
      );
      const assignedSectionNames = new Set(
          allSections.filter(s => assignedSections.includes(s.id)).map(s => s.name?.trim())
      );

      const taskMap = new Map(tasks.map(t => [t.id, t]));
      const groupMap = new Map(groups.map(g => [g.id, g]));

      evaluations = evaluations.filter(e => {
          const task = taskMap.get(e.taskId);
          const group = groupMap.get(e.groupId);
          
          // Filter by subject (from task) - Relaxed: Match ID or Name
          let subjectMatch = false;
          if (task && task.subjectId) {
              if (assignedSubjects.includes(task.subjectId)) {
                  subjectMatch = true;
              } else {
                  const sub = allSubjects.find(s => s.id === task.subjectId);
                  if (sub && sub.name && assignedSubjectNames.has(sub.name.trim())) {
                      subjectMatch = true;
                  }
              }
          }
          
          // Filter by class/section (from evaluation or group)
          // Class is usually strict ID
          const classMatch = e.classId ? assignedClasses.includes(e.classId) : 
                            (group?.classId ? assignedClasses.includes(group.classId) : true);
          
          // Section: Relaxed Match ID or Name
          let sectionMatch = true; // Default true if no section info
          const targetSectionId = e.sectionId || group?.sectionId;
          
          if (targetSectionId && assignedSections.length > 0) {
              if (assignedSections.includes(targetSectionId)) {
                  sectionMatch = true;
              } else {
                  const sec = allSections.find(s => s.id === targetSectionId);
                  if (sec && sec.name && assignedSectionNames.has(sec.name.trim())) {
                      sectionMatch = true;
                  } else {
                      sectionMatch = false;
                  }
              }
          }

          return subjectMatch && classMatch && sectionMatch;
      });
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));
  evaluations.sort((a, b) => (b.taskDate || '').localeCompare(a.taskDate || ''));
  uiManager.clearContainer(elements.evaluationListTableBody);
  if (evaluations.length === 0) {
    const row = elements.evaluationListTableBody.insertRow();
    row.innerHTML = `<td colspan="5" class="placeholder-content p-4 text-center text-gray-500 dark:text-gray-400">কোনো মূল্যায়ন খুঁজে পাওয়া যায়নি।</td>`;
    return;
  }
  evaluations.forEach((e) => {
    const task = taskMap.get(e.taskId);
    const taskName = task?.name || e.taskName || '❓';
    const groupName = groupMap.get(e.groupId) || e.groupName || '❓';
    const date = e.taskDate ? helpers.formatTimestamp(e.taskDate) : 'N/A';
    const avgScorePercent = e.groupAverageScore !== undefined ? e.groupAverageScore : null;
    const scoreDisplay =
      avgScorePercent !== null && !isNaN(avgScorePercent)
        ? `${helpers.convertToBanglaNumber(avgScorePercent.toFixed(1))}%`
        : 'N/A';
    const scoreColor =
      avgScorePercent !== null && !isNaN(avgScorePercent) ? helpers.getPerformanceColorClass(avgScorePercent) : '';

    // Resolve Class and Subject
    const classId = task?.classId || e.classId;
    const subjectId = task?.subjectId; // Subject usually comes from task
    
    const className = classId ? (classes.find(c => c.id === classId)?.name || 'অজানা') : '-';
    const subjectName = subjectId ? (allSubjects.find(s => s.id === subjectId)?.name || 'অজানা') : '-';
    
    const classColor = _getClassColor(className);
    const subjectColor = _getSubjectColor(subjectName);

    const row = elements.evaluationListTableBody.insertRow();
    row.className = 'border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50';
    row.innerHTML = `
            <td class="td p-3">
                <div class="font-semibold text-gray-900 dark:text-white">${taskName}</div>
                <div class="flex flex-wrap gap-1 mt-1">
                    ${className !== '-' ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${classColor}">${className}</span>` : ''}
                    ${subjectName !== '-' ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${subjectColor}">${subjectName}</span>` : ''}
                </div>
            </td> 
            <td class="td p-3">${groupName}</td> <td class="td p-3">${date}</td>
            <td class="td p-3 text-center font-semibold ${scoreColor}">${scoreDisplay}</td>
            <td class="td p-3 text-center whitespace-nowrap">
                <button data-id="${e.id}" class="edit-evaluation-btn btn btn-light btn-sm p-1 mx-1" aria-label="সম্পাদনা"><i class="fas fa-edit pointer-events-none"></i></button>
                <button data-id="${e.id}" class="delete-evaluation-btn btn btn-danger btn-sm p-1 mx-1" aria-label="ডিলিট"><i class="fas fa-trash pointer-events-none"></i></button>
            </td>`;
  });
}

/**
 * বিদ্যমান মূল্যায়ন সম্পাদনা করার জন্য লোড করে।
 * @private
 */
async function _loadEvaluationForEditing(evaluationId, task, group, studentsInGroup) {
  uiManager.showLoading('পূর্বের মূল্যায়ন লোড হচ্ছে...');
  try {
    const evaluation = await dataService.getEvaluationById(evaluationId);
    if (!evaluation || !evaluation.scores) throw new Error('মূল্যায়নের বিস্তারিত স্কোর পাওয়া যায়নি।');
    _renderEvaluationForm(task, group, studentsInGroup, evaluation.scores);
    currentEditingEvaluationId = evaluationId;
    elements.evaluationFormContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error('❌ Error loading evaluation for edit:', error);
    uiManager.showToast(`মূল্যায়ন লোড করতে সমস্যা: ${error.message}`, 'error');
    _handleCancelEvaluation();
  } finally {
    uiManager.hideLoading();
  }
}

/**
 * মূল্যায়ন সম্পাদনা করার বাটন হ্যান্ডলার।
 * @private
 */
async function _handleEditEvaluation(evaluationId) {
  // Permission check
  if (!permissionHelper?.canEdit()) {
    uiManager.showToast('আপনার evaluation সম্পাদনা করার অনুমতি নেই।', 'warning');
    return;
  }

  const evaluationSummary = stateManager.get('evaluations').find((e) => e.id === evaluationId);
  if (!evaluationSummary) {
    uiManager.showToast('মূল্যায়ন খুঁজে পাওয়া যায়নি।', 'error');
    return;
  }
  const task = stateManager.get('tasks').find((t) => t.id === evaluationSummary.taskId);
  const group = stateManager.get('groups').find((g) => g.id === evaluationSummary.groupId);
  if (!task) {
    uiManager.showToast('এই মূল্যায়নের টাস্কটি ডিলিট করা হয়েছে।', 'error');
    return;
  }
  if (!group) {
    uiManager.showToast('এই মূল্যায়নের গ্রুপটি ডিলিট করা হয়েছে।', 'error');
    return;
  }

  if (!task.maxScoreBreakdown || task.maxScoreBreakdown.mcq === undefined) {
    uiManager.showToast('এই টাস্কের স্কোর ব্রেকডাউন সেভ করা নেই। সম্পাদনা করা যাবে না।', 'error', 5000);
    return;
  }
  currentTaskBreakdown = task.maxScoreBreakdown;

  const studentsInGroup = stateManager
    .get('students')
    .filter((s) => s.groupId === evaluationSummary.groupId)
    .sort((a, b) => String(a.roll).localeCompare(String(b.roll), undefined, { numeric: true }));
  if (studentsInGroup.length === 0) {
    uiManager.showToast('এই গ্রুপে এখন কোনো শিক্ষার্থী নেই।', 'warning');
    return;
  }

  if (elements.evaluationTaskSelect) elements.evaluationTaskSelect.value = evaluationSummary.taskId;
  if (elements.evaluationGroupSelect) elements.evaluationGroupSelect.value = evaluationSummary.groupId;
  await _loadEvaluationForEditing(evaluationId, task, group, studentsInGroup);
}

/**
 * মূল্যায়ন ডিলিট করার বাটন হ্যান্ডলার।
 * @private
 */
function _handleDeleteEvaluation(evaluationId) {
  // Permission check
  if (!permissionHelper?.canDelete()) {
    uiManager.showToast('আপনার evaluation মুছে ফেলার অনুমতি নেই।', 'warning');
    return;
  }

  const evaluation = stateManager.get('evaluations').find((e) => e.id === evaluationId);
  if (!evaluation) {
    uiManager.showToast('মূল্যায়ন খুঁজে পাওয়া যায়নি।', 'error');
    return;
  }
  const taskName = evaluation.taskName || 'এই টাস্ক';
  const groupName = evaluation.groupName || 'এই গ্রুপ';
  const message = `আপনি কি নিশ্চিত "${taskName}" এর জন্য "${groupName}" গ্রুপের মূল্যায়ন ডিলিট করতে চান?`;
  uiManager.showDeleteModal('মূল্যায়ন ডিলিট', message, async () => {
    uiManager.showLoading('ডিলিট হচ্ছে...');
    try {
      await dataService.deleteEvaluation(evaluationId);
      await app.refreshAllData();
      _renderEvaluationList();
      if (currentEditingEvaluationId === evaluationId) _handleCancelEvaluation();
      uiManager.showToast('মূল্যায়ন ডিলিট করা হয়েছে।', 'success');
    } catch (error) {
      uiManager.showToast(`ডিলিট ত্রুটি: ${error.message}`, 'error');
    } finally {
      uiManager.hideLoading();
    }
  });
}

/**
 * ড্যাশবোর্ড ডিসপ্লে কনফিগারেশন রেন্ডার করে।
 * @private
 */
function _renderDashboardConfig() {
  if (!elements.dashboardConfigContainer) return;
  
  // Permission check: Only super admins should see this
  const isSuperAdmin = permissionHelper?.isSuperAdmin();
  
  if (!isSuperAdmin) {
      elements.dashboardConfigContainer.classList.add('hidden');
      return;
  }
  elements.dashboardConfigContainer.classList.remove('hidden');

  const config = stateManager.getDashboardConfig();
  const tasks = stateManager.get('tasks') || [];
  const classes = stateManager.get('classes') || [];
  const sections = stateManager.get('sections') || [];
  const subjects = stateManager.get('subjects') || [];
  
  // Deduplicate subjects by name
  const uniqueSubjects = [];
  const seenSubjectNames = new Set();
  subjects.forEach(s => {
      const name = s.name ? s.name.trim() : '';
      if (name && !seenSubjectNames.has(name)) {
          seenSubjectNames.add(name);
          uniqueSubjects.push(s);
      }
  });

  // Sort tasks by date (newest first)
  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateB - dateA;
  });

  const isForced = config.isForced;
  const forcedId = config.forceAssignmentId;

  elements.dashboardConfigContainer.innerHTML = `
    <div class="card card-body mb-6 border-l-4 border-indigo-500">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-800 dark:text-white">ড্যাশবোর্ড ডিসপ্লে কনফিগারেশন</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">ড্যাশবোর্ডে কোন এসাইনমেন্টের ডেটা দেখানো হবে তা নির্ধারণ করুন।</p>
        </div>
        <div class="flex items-center gap-3">
             <label class="inline-flex items-center cursor-pointer">
                <input type="checkbox" id="forceDashboardToggle" class="sr-only peer" ${isForced ? 'checked' : ''}>
                <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                <span class="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">ম্যানুয়াল ফোর্স</span>
            </label>
        </div>
      </div>
      
      <div id="forceConfigControls" class="mt-4 pt-4 border-t dark:border-gray-700 transition-all duration-300 ${isForced ? '' : 'hidden opacity-50 pointer-events-none'}">
          
          <!-- Filters -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                  <label class="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">ক্লাস</label>
                  <select id="configClassFilter" class="form-select w-full text-sm py-1">
                      <option value="">সকল ক্লাস</option>
                      ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                  </select>
              </div>
              <div>
                  <label class="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">শাখা</label>
                  <select id="configSectionFilter" class="form-select w-full text-sm py-1">
                      <option value="">সকল শাখা</option>
                      ${sections.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                  </select>
              </div>
              <div>
                  <label class="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">বিষয়</label>
                  <select id="configSubjectFilter" class="form-select w-full text-sm py-1">
                      <option value="">সকল বিষয়</option>
                      ${uniqueSubjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                  </select>
              </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 items-end">
            <div class="w-full sm:w-1/2">
                <label for="forceAssignmentSelect" class="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">এসাইনমেন্ট নির্বাচন করুন</label>
                <select id="forceAssignmentSelect" class="form-select w-full">
                    <option value="" disabled ${!forcedId ? 'selected' : ''}>এসাইনমেন্ট বেছে নিন...</option>
                    ${sortedTasks.map(t => `<option value="${t.id}" ${t.id === forcedId ? 'selected' : ''}>${t.name}</option>`).join('')}
                </select>
            </div>
            <button id="saveDashboardConfigBtn" class="btn btn-primary whitespace-nowrap">
                <i class="fas fa-save mr-2"></i> সেভ কনফিগারেশন
            </button>
          </div>
          <p class="text-xs text-amber-600 dark:text-amber-400 mt-2">
            <i class="fas fa-info-circle"></i> এটি চালু থাকলে ড্যাশবোর্ডে সবসময় নির্বাচিত এসাইনমেন্টের ডেটা দেখাবে।
          </p>
      </div>
    </div>
  `;

  // Attach Listeners
  const toggle = elements.dashboardConfigContainer.querySelector('#forceDashboardToggle');
  const controls = elements.dashboardConfigContainer.querySelector('#forceConfigControls');
  const saveBtn = elements.dashboardConfigContainer.querySelector('#saveDashboardConfigBtn');
  const select = elements.dashboardConfigContainer.querySelector('#forceAssignmentSelect');
  
  const classFilter = elements.dashboardConfigContainer.querySelector('#configClassFilter');
  const sectionFilter = elements.dashboardConfigContainer.querySelector('#configSectionFilter');
  const subjectFilter = elements.dashboardConfigContainer.querySelector('#configSubjectFilter');

  // Filter Logic
  const filterAssignments = () => {
      const classId = classFilter.value;
      const sectionId = sectionFilter.value;
      const subjectId = subjectFilter.value;

      const filtered = sortedTasks.filter(t => {
          if (classId && t.classId !== classId) return false;
          if (sectionId && t.sectionId !== sectionId) return false;
          
          // Subject filter: match by ID or Name (since we deduplicated by name)
          if (subjectId) {
              if (t.subjectId === subjectId) return true;
              // Check name match
              const selectedSubject = subjects.find(s => s.id === subjectId);
              const taskSubject = subjects.find(s => s.id === t.subjectId);
              if (selectedSubject && taskSubject && selectedSubject.name.trim() === taskSubject.name.trim()) return true;
              return false;
          }
          
          return true;
      });

      // Update Select
      const currentVal = select.value;
      select.innerHTML = `<option value="" disabled>এসাইনমেন্ট বেছে নিন...</option>` + 
          filtered.map(t => `<option value="${t.id}" ${t.id === currentVal ? 'selected' : ''}>${t.name}</option>`).join('');
      
      // Restore selection if valid
      if (currentVal && filtered.find(t => t.id === currentVal)) {
          select.value = currentVal;
      } else {
          select.value = "";
      }
  };

  classFilter.addEventListener('change', filterAssignments);
  sectionFilter.addEventListener('change', filterAssignments);
  subjectFilter.addEventListener('change', filterAssignments);

  // Pre-select filters if forced assignment exists
  if (forcedId) {
      const forcedTask = tasks.find(t => t.id === forcedId);
      if (forcedTask) {
          if (forcedTask.classId) classFilter.value = forcedTask.classId;
          if (forcedTask.sectionId) sectionFilter.value = forcedTask.sectionId;
          
          // For subject, we need to find the matching option in our unique list
          if (forcedTask.subjectId) {
              // Try direct ID match first
              if (uniqueSubjects.find(s => s.id === forcedTask.subjectId)) {
                  subjectFilter.value = forcedTask.subjectId;
              } else {
                  // Try name match
                  const taskSubject = subjects.find(s => s.id === forcedTask.subjectId);
                  if (taskSubject) {
                      const matchingUnique = uniqueSubjects.find(s => s.name.trim() === taskSubject.name.trim());
                      if (matchingUnique) subjectFilter.value = matchingUnique.id;
                  }
              }
          }
          
          // Trigger filter to update assignment list and ensure consistency
          filterAssignments();
          // Ensure forced ID is selected
          select.value = forcedId;
      }
  }

  toggle.addEventListener('change', async (e) => {
      const checked = e.target.checked;
      if (checked) {
          controls.classList.remove('hidden', 'opacity-50', 'pointer-events-none');
      } else {
          controls.classList.add('hidden', 'opacity-50', 'pointer-events-none');
          // Auto-save when disabling
          const newConfig = { isForced: false, forceAssignmentId: null };
          stateManager.setDashboardConfig(newConfig);
          
          try {
            await dataService.saveGlobalSettings({ dashboardConfig: newConfig });
            uiManager.showToast('ম্যানুয়াল ফোর্স বন্ধ করা হয়েছে (Global)।', 'info');
          } catch (err) {
            console.error(err);
            uiManager.showToast('সেটিং সেভ করতে সমস্যা হয়েছে।', 'error');
          }
      }
  });

  saveBtn.addEventListener('click', async () => {
      const shouldForce = toggle.checked;
      const selectedId = select.value;

      if (shouldForce && !selectedId) {
          uiManager.showToast('অনুগ্রহ করে একটি এসাইনমেন্ট নির্বাচন করুন।', 'warning');
          return;
      }

      const newConfig = {
          isForced: shouldForce,
          forceAssignmentId: selectedId
      };

      stateManager.setDashboardConfig(newConfig);

      try {
        uiManager.showLoading('সেভ হচ্ছে...');
        await dataService.saveGlobalSettings({ dashboardConfig: newConfig });
        uiManager.showToast('ড্যাশবোর্ড কনফিগারেশন সেভ হয়েছে (Global)।', 'success');
      } catch (err) {
        console.error(err);
        uiManager.showToast('সেভ করতে সমস্যা হয়েছে।', 'error');
      } finally {
        uiManager.hideLoading();
      }
  });
}
