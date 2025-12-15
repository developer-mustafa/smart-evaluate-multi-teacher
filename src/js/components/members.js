﻿// js/components/members.js

// নির্ভরতা (Dependencies)
let stateManager, uiManager, dataService, helpers, app, permissionHelper;

// DOM এলিমেন্ট (উভয় পেজের জন্য)
const elements = {
  membersPage: null,
  csvFileInput: null,
  csvFileName: null,
  downloadTemplateBtn: null,
  processImportBtn: null,
  studentNameInput: null,
  studentRollInput: null,
  studentGenderInput: null,
  studentGroupInput: null,
  studentContactInput: null,
  studentAcademicGroupInput: null,
  studentSessionInput: null,
  studentRoleInput: null,
  addStudentBtn: null,
  membersFilterGroup: null,
  membersFilterAcademicGroup: null,
  studentSearchInput: null,
  studentsListContainer: null,
  cardsPage: null,
  cardsFilterGroup: null,
  cardsFilterAcademicGroup: null,
  allStudentsSearchInput: null,
  allStudentsCardsContainer: null,
};

// ডিবাউন্সিং (Debouncing) ফাংশন সার্চের জন্য
let membersSearchDebouncer;
let cardsSearchDebouncer;

const renderScopeKeys = {
  membersList: 'members-list',
  studentCards: 'student-cards',
};

let lastGroupOptionsSignature = '';
let lastAcademicOptionsSignature = '';

const BADGE_BASE_CLASS = 'inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border';

const ROLE_BADGE_META = {
  'team-leader': {
    label: 'টিম লিডার',
    className:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-500/40',
  },
  'time-keeper': {
    label: 'টাইম কিপার',
    className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-500/40',
  },
  reporter: {
    label: 'রিপোর্টার',
    className:
      'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-100 dark:border-purple-500/40',
  },
  'resource-manager': {
    label: 'রিসোর্স ম্যানেজার',
    className:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-500/40',
  },
  'peace-maker': {
    label: 'পিস মেকার',
    className:
      'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-100 dark:border-rose-500/40',
  },
};

const ACADEMIC_BADGE_META = {
  science: {
    className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-100 dark:border-sky-500/40',
  },
  humanities: {
    className:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:border-amber-500/40',
  },
  business: {
    className:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-500/40',
  },
  other: {
    className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
  },
};

/* ------------------------------------
   SOFT 3D THEME (Injected Once)
------------------------------------ */
function _ensureSoft3DStyles() {
  if (document.getElementById('members-soft3d-styles')) return;
  const style = document.createElement('style');
  style.id = 'members-soft3d-styles';
  style.textContent = `
  /* Panel (group section wrapper) */
  .panel-3d{
    border-radius: 1rem;
    overflow: hidden;
    box-shadow:
      0 1px 0 rgba(255,255,255,.6) inset,
      0 10px 18px rgba(0,0,0,.06),
      0 2px 4px rgba(0,0,0,.04);
  }
  .dark .panel-3d{
    box-shadow:
      0 1px 0 rgba(255,255,255,.08) inset,
      0 12px 22px rgba(0,0,0,.25),
      0 2px 4px rgba(0,0,0,.18);
  }

  /* Section header gloss */
  .header-3d::after{
    content:""; position:absolute; inset:0; pointer-events:none;
    background: radial-gradient(120% 140% at 110% -20%, rgba(255,255,255,.18), transparent 60%);
  }
  .dark .header-3d::after{
    background: radial-gradient(120% 140% at 110% -20%, rgba(255,255,255,.08), transparent 60%);
  }

  /* Card 3D (student card/list item) */
  .card-3d{
    border-radius: .875rem;
    box-shadow:
      0 1px 0 rgba(255,255,255,.55) inset,
      0 10px 18px rgba(0,0,0,.06),
      0 2px 4px rgba(0,0,0,.04);
    transition: transform .15s ease, box-shadow .15s ease;
    will-change: transform;
  }
  .card-3d:hover{
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255,255,255,.6) inset,
      0 14px 24px rgba(0,0,0,.10),
      0 4px 8px rgba(0,0,0,.06);
  }
  .dark .card-3d{
    box-shadow:
      0 1px 0 rgba(255,255,255,.08) inset,
      0 12px 22px rgba(0,0,0,.25),
      0 2px 4px rgba(0,0,0,.18);
  }
  .dark .card-3d:hover{
    box-shadow:
      0 1px 0 rgba(255,255,255,.10) inset,
      0 16px 26px rgba(0,0,0,.35),
      0 4px 8px rgba(0,0,0,.25);
  }

  /* Chip/Badge subtle inner highlight */
  .badge-3d{
    box-shadow: 0 1px 0 rgba(255,255,255,.45) inset, 0 1px 2px rgba(0,0,0,.06);
  }
  .dark .badge-3d{
    box-shadow: 0 1px 0 rgba(255,255,255,.10) inset, 0 1px 2px rgba(0,0,0,.25);
  }
  `;
  document.head.appendChild(style);
}

function _renderStudentRoleBadge(roleCode) {
  const baseClasses = `${BADGE_BASE_CLASS} badge-3d`;
  if (!roleCode) {
    return `<span class="${baseClasses} bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">দায়িত্ব নির্ধারিত নয়</span>`;
  }
  const meta = ROLE_BADGE_META[roleCode] || {
    label: roleCode,
    className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
  };
  const label = meta.label ? _formatLabel(meta.label) : _formatLabel(roleCode);
  return `<span class="${baseClasses} ${meta.className || ''}">${label}</span>`;
}

function _renderAcademicBadge(academicGroup) {
  const baseClasses = `${BADGE_BASE_CLASS} badge-3d`;
  const value = (academicGroup || '').toString().trim();
  if (!value) {
    return `<span class="${baseClasses} bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">একাডেমিক শাখা নির্ধারিত নয়</span>`;
  }
  const key = _getAcademicKey(value);
  const meta = ACADEMIC_BADGE_META[key] || {
    className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
  };
  const label = _formatLabel(value);
  return `<span class="${baseClasses} ${meta.className}">${label}</span>`;
}

function _formatLabel(value) {
  if (value === null || value === undefined) return '';
  const text =
    helpers?.ensureBengaliText && typeof helpers.ensureBengaliText === 'function'
      ? helpers.ensureBengaliText(value)
      : String(value);
  return _escapeHtml(text.trim());
}

function _escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _getAcademicKey(academicGroup) {
  const value = (academicGroup || '').toString().toLowerCase();
  if (!value) return 'other';
  if (value.includes('science') || value.includes('বিজ্ঞান')) return 'science';
  if (value.includes('human') || value.includes('মানবিক')) return 'humanities';
  if (value.includes('business') || value.includes('ব্যবসা') || value.includes('কমার্স')) return 'business';
  return 'other';
}

function _safeLower(value) {
  if (typeof value === 'string') return value.toLowerCase();
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
}

function _normalizeTimestampValue(value) {
  if (!value) return '';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      try {
        return String(value.toMillis());
      } catch {
        /* ignore */
      }
    }
    if (typeof value.seconds === 'number') {
      const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
      return `${value.seconds}:${nanos}`;
    }
  }
  return JSON.stringify(value);
}

function _buildStudentRenderSignature(students, filters, scopeKey) {
  const canonical = [...students].sort((a, b) => {
    const groupCompare = (a.groupId || '').localeCompare(b.groupId || '');
    if (groupCompare !== 0) return groupCompare;
    const rollCompare = `${a.roll ?? ''}`.localeCompare(`${b.roll ?? ''}`, undefined, { numeric: true });
    if (rollCompare !== 0) return rollCompare;
    return (a.name || '').localeCompare(b.name || '', 'bn');
  });
  const studentPayload = canonical
    .map((student) => {
      const rollValue = student.roll === undefined || student.roll === null ? '' : `${student.roll}`;
      return [
        student.id || '',
        student.name || '',
        rollValue,
        student.groupId || '',
        student.academicGroup || '',
        student.session || '',
        student.gender || '',
        student.role || '',
        student.contact || '',
        _normalizeTimestampValue(student.updatedAt),
      ].join('|');
    })
    .join('~');
  const filterPayload = JSON.stringify({
    group: filters?.groupFilter || 'all',
    academic: filters?.academicFilter || 'all',
    search: (filters?.searchTerm || '').toLowerCase(),
  });
  return `${scopeKey}::${filterPayload}::${studentPayload}`;
}

/**
 * Members কম্পোনেন্ট শুরু করে (Initialize)।
 */
export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  dataService = dependencies.services.dataService;
  permissionHelper = dependencies.utils.permissionHelper;
  helpers = dependencies.utils; // The full helpers object
  app = dependencies.app;

  // Initialize debouncers using the helper
  membersSearchDebouncer = helpers.createDebouncer(300);
  cardsSearchDebouncer = helpers.createDebouncer(300);

  _ensureSoft3DStyles(); // ✅ 3D theme once

  _cacheDOMElements();
  _setupEventListeners();

  console.log('✅ Members component initialized.');

  return {
    render,
    renderStudentCards,
    populateFilters,
  };
}

/**
 * Members পেজ (#page-members) রেন্ডার করে।
 */
export function render() {
  if (!elements.membersPage) return;
  populateFilters();
  _populateClassDropdown();
  _populateSectionDropdown();
  _renderStudentsList();
}

/**
 * All Students Cards পেজ (#page-all-students) রেন্ডার করে।
 */
export function renderStudentCards() {
  if (!elements.cardsPage) {
    console.error('❌ Student Cards render failed: Page element #page-all-students not found.');
    return;
  }
  console.log('Rendering All Students (Cards) page...');
  populateFilters(); // এই পেজের ফিল্টারও পপুলেট করি
  _renderStudentCardsList(); // কার্ড তালিকা রেন্ডার করি
}

/**
 * এই কম্পোনেন্টের জন্য প্রয়োজনীয় DOM এলিমেন্টগুলো ক্যাশ করে।
 * @private
 */
function _cacheDOMElements() {
  // Members Page
  elements.membersPage = document.getElementById('page-members');
  if (elements.membersPage) {
    elements.csvFileInput = elements.membersPage.querySelector('#csvFileInput');
    elements.csvFileName = elements.membersPage.querySelector('#csvFileName');
    elements.downloadTemplateBtn = elements.membersPage.querySelector('#downloadTemplateBtn');
    elements.processImportBtn = elements.membersPage.querySelector('#processImportBtn');
    elements.studentNameInput = elements.membersPage.querySelector('#studentNameInput');
    elements.studentRollInput = elements.membersPage.querySelector('#studentRollInput');
    elements.studentGenderInput = elements.membersPage.querySelector('#studentGenderInput');
    elements.studentClassInput = elements.membersPage.querySelector('#studentClassInput');
    elements.studentSectionInput = elements.membersPage.querySelector('#studentSectionInput');
    elements.studentGroupInput = elements.membersPage.querySelector('#studentGroupInput');
    elements.studentContactInput = elements.membersPage.querySelector('#studentContactInput');
    elements.studentAcademicGroupInput = elements.membersPage.querySelector('#studentAcademicGroupInput');
    elements.studentSessionInput = elements.membersPage.querySelector('#studentSessionInput');
    elements.studentRoleInput = elements.membersPage.querySelector('#studentRoleInput');
    elements.addStudentBtn = elements.membersPage.querySelector('#addStudentBtn');
    elements.membersFilterGroup = elements.membersPage.querySelector('#membersFilterGroup');
    elements.membersFilterAcademicGroup = elements.membersPage.querySelector('#membersFilterAcademicGroup');
    elements.studentSearchInput = elements.membersPage.querySelector('#studentSearchInput');
    elements.studentsListContainer = elements.membersPage.querySelector('#studentsList');
  } else {
    console.warn('Members page element (#page-members) not found!');
  }

  // All Students Cards Page
  elements.cardsPage = document.getElementById('page-all-students');
  if (elements.cardsPage) {
    elements.cardsFilterGroup = elements.cardsPage.querySelector('#cardsFilterGroup');
    elements.cardsFilterAcademicGroup = elements.cardsPage.querySelector('#cardsFilterAcademicGroup');
    elements.allStudentsSearchInput = elements.cardsPage.querySelector('#allStudentsSearchInput');
    elements.allStudentsCardsContainer = elements.cardsPage.querySelector('#allStudentsCards');
  } else {
    console.warn('All Students Cards page element (#page-all-students) not found!');
  }
}

/**
 * Members পেজের ইভেন্ট লিসেনার সেট আপ করে।
 * @private
 */
function _setupEventListeners() {
  // Members Page Listeners
  if (elements.membersPage) {
    uiManager.addListener(elements.addStudentBtn, 'click', _handleAddStudent);
    uiManager.addListener(elements.downloadTemplateBtn, 'click', _handleDownloadTemplate);
    uiManager.addListener(elements.csvFileInput, 'change', _handleFileSelect);
    uiManager.addListener(elements.processImportBtn, 'click', _handleProcessImport);
    
    // Cascading dropdown: Class -> Section
    uiManager.addListener(elements.studentClassInput, 'change', (e) => {
      const selectedClassId = e.target.value;
      _populateSectionDropdown(selectedClassId);
    });

    // Filters (Members List)
    uiManager.addListener(elements.membersFilterGroup, 'change', (e) => {
      if (stateManager.updateFilters('membersList', { groupFilter: e.target.value })) {
        _renderStudentsList();
      }
    });
    uiManager.addListener(elements.membersFilterAcademicGroup, 'change', (e) => {
      if (stateManager.updateFilters('membersList', { academicFilter: e.target.value })) {
        _renderStudentsList();
      }
    });
    uiManager.addListener(elements.studentSearchInput, 'input', (e) => {
      const searchTerm = e.target.value.trim();
      membersSearchDebouncer(() => {
        if (stateManager.updateFilters('membersList', { searchTerm })) {
          _renderStudentsList();
        }
      });
    });

    // Event delegation for edit/delete buttons in the list
    // Using capture phase (true) to catch clicks before stopPropagation in inline onclick
    if (elements.studentsListContainer) {
      elements.studentsListContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-student-btn');
        const deleteBtn = e.target.closest('.delete-student-btn');
        if (editBtn) {
          e.stopPropagation();
          _handleEditStudent(editBtn.dataset.id);
        } else if (deleteBtn) {
          e.stopPropagation();
          _handleDeleteStudent(deleteBtn.dataset.id);
        }
      }, true); // capture phase
    }
  }

  // All Students Cards Page Listeners
  if (elements.cardsPage) {
    // Filters (Cards View)
    uiManager.addListener(elements.cardsFilterGroup, 'change', (e) => {
      if (stateManager.updateFilters('studentCards', { groupFilter: e.target.value })) {
        _renderStudentCardsList();
      }
    });
    uiManager.addListener(elements.cardsFilterAcademicGroup, 'change', (e) => {
      if (stateManager.updateFilters('studentCards', { academicFilter: e.target.value })) {
        _renderStudentCardsList();
      }
    });
    uiManager.addListener(elements.allStudentsSearchInput, 'input', (e) => {
      const searchTerm = e.target.value.trim();
      cardsSearchDebouncer(() => {
        if (stateManager.updateFilters('studentCards', { searchTerm })) {
          _renderStudentCardsList();
        }
      });
    });

    // Print Button Listener
    const printBtn = elements.cardsPage.querySelector('#printStudentsBtn');
    if (printBtn) {
      uiManager.addListener(printBtn, 'click', _handlePrintStudents);
    }
  }
}

/**
 * Handles printing the filtered student list.
 * @private
 */
function _handlePrintStudents() {
  const filters = stateManager.getFilterSection('studentCards');
  const allStudents = stateManager.get('students') || [];
  
  // Filter students based on current filters
  const filteredStudents = allStudents.filter(student => {
    const matchesGroup = filters.groupFilter === 'all' || student.groupId === filters.groupFilter;
    const matchesAcademic = filters.academicFilter === 'all' || student.academicGroup === filters.academicFilter;
    const matchesSearch = !filters.searchTerm || 
      student.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      String(student.roll || '').includes(filters.searchTerm) ||
      (student.phone && student.phone.includes(filters.searchTerm));
      
    return matchesGroup && matchesAcademic && matchesSearch;
  });

  if (filteredStudents.length === 0) {
    uiManager.showToast('প্রিন্ট করার জন্য কোনো শিক্ষার্থী পাওয়া যায়নি।', 'warning');
    return;
  }

  // Generate Print HTML
  const date = new Date().toLocaleDateString('bn-BD');
  const groups = stateManager.get('groups') || [];
  
  const rows = filteredStudents.map((s, index) => {
    const group = groups.find(g => g.id === s.groupId);
    const groupName = group ? helpers.ensureBengaliText(group.name) : 'N/A';
    const roleText = helpers.getStudentRoleText(s.role);
    const isLeader = s.role === 'leader' || s.role === 'team-leader';
    const roleStyle = isLeader ? 'color: #ef4444; font-weight: bold;' : '';

    return `
      <tr>
        <td>${helpers.convertToBanglaNumber(index + 1)}</td>
        <td>${s.name}</td>
        <td>${helpers.convertToBanglaNumber(s.roll)}</td>
        <td>${groupName}</td>
        <td>${s.academicGroup || '-'}</td>
        <td>${s.session || '-'}</td>
        <td>${s.gender || '-'}</td>
        <td style="${roleStyle}">${roleText}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8">
      <title>Students List - ${date}</title>
      <style>
        body { font-family: 'Kalpurush', sans-serif; padding: 20px; }
        h1 { text-align: center; margin-bottom: 10px; }
        .meta { text-align: center; margin-bottom: 20px; color: #666; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        @media print {
          .no-print { display: none; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      </style>
    </head>
    <body>
      <h1>Students Directory</h1>
      <div class="meta">
        Total Students: ${helpers.convertToBanglaNumber(filteredStudents.length)} | Date: ${date}
      </div>
      <table>
        <thead>
          <tr>
            <th>ক্রমিক</th>
            <th>নাম</th>
            <th>রোল</th>
            <th>গ্রুপ</th>
            <th>একাডেমিক গ্রুপ</th>
            <th>সেশন</th>
            <th>লিঙ্গ</th>
            <th>পদবী</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
    </html>
  `;

  // Use Iframe for printing to avoid about:blank issues
  let printFrame = document.getElementById('printFrame');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'printFrame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
  }

  const frameDoc = printFrame.contentWindow.document;
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  // Wait for content to load then print
  printFrame.contentWindow.focus();
  setTimeout(() => {
    printFrame.contentWindow.print();
  }, 500);
}

/**
 * Handles click/keyboard activation on a student card to open the detail modal.
 * Ensures the same modal (and data) used in the ranking page.
 * @param {Event} event
 */
function _handleStudentCardActivation(event) {
  if (!event) return;
  const isKeydown = event.type === 'keydown';
  if (isKeydown && event.key !== 'Enter' && event.key !== ' ') return;

  const rawTarget = event.target;
  let target = null;
  if (typeof Element !== 'undefined' && rawTarget instanceof Element) {
    target = rawTarget;
  } else if (rawTarget?.parentElement) {
    target = rawTarget.parentElement;
  }
  if (!target) return;

  if (target.closest('button, a, input, textarea, select, label')) return;

  const card = target.closest('[data-student-id]');
  if (!card) return;
  const studentId = (card.getAttribute('data-student-id') || '').trim();
  if (!studentId) return;

  if (isKeydown) event.preventDefault();

  const students = stateManager.get('students') || [];
  const fallbackStudent =
    students.find((stu) => (stu?.id === undefined || stu?.id === null ? false : String(stu.id).trim() === studentId)) ||
    null;

  let fallbackGroupName = null;
  if (fallbackStudent) {
    const groups = stateManager.get('groups') || [];
    const targetGroupId =
      fallbackStudent.groupId === undefined || fallbackStudent.groupId === null
        ? null
        : String(fallbackStudent.groupId).trim();
    const matchGroup = groups.find((grp) => {
      if (grp?.id === undefined || grp?.id === null) return false;
      return String(grp.id).trim() === targetGroupId;
    });
    fallbackGroupName = matchGroup?.name || null;
  }

  let stateSnapshot = null;
  if (typeof stateManager?.getState === 'function') {
    try {
      stateSnapshot = stateManager.getState();
    } catch (err) {
      console.warn('Members: failed to capture state snapshot for modal', err);
    }
  }

  if (typeof window === 'undefined' || typeof window.openStudentModalById !== 'function') {
    console.warn('Members: student modal handler unavailable for', studentId);
    return;
  }

  try {
    window.openStudentModalById(studentId);
  } catch (error) {
    console.warn('Members: failed to open student modal', error);
  }
}

/**
 * ফিল্টার ড্রপডাউনগুলো (গ্রুপ ও একাডেমিক গ্রুপ) পপুলেট করে।
 */
export function populateFilters() {
  const groups = stateManager.get('groups') || [];
  const groupSignature = JSON.stringify(groups.map((g) => `${g.id || ''}:${g.name || ''}`));

  if (groupSignature !== lastGroupOptionsSignature) {
    lastGroupOptionsSignature = groupSignature;
    const filterSelectIds = [];
    if (elements.membersFilterGroup) filterSelectIds.push('membersFilterGroup');
    if (elements.cardsFilterGroup) filterSelectIds.push('cardsFilterGroup');

    if (app.components.groups && app.components.groups.populateGroupSelects) {
      if (filterSelectIds.length) {
        app.components.groups.populateGroupSelects(filterSelectIds, 'সকল গ্রুপ');
      }
      if (elements.studentGroupInput) {
        app.components.groups.populateGroupSelects(['studentGroupInput'], 'একটি গ্রুপ নির্বাচন করুন');
        if (elements.studentGroupInput.options[0]) {
          elements.studentGroupInput.options[0].disabled = true;
        }
      }
    } else if (filterSelectIds.length || elements.studentGroupInput) {
      console.warn('Members: Groups component not available to populate group selects.');
    }
  }

  const students = stateManager.get('students') || [];
  const academicGroups = [...new Set(students.map((s) => s.academicGroup).filter(Boolean))].sort((a, b) =>
    (a || '').localeCompare(b || '', 'bn')
  );
  const academicSignature = JSON.stringify(academicGroups);
  if (academicSignature !== lastAcademicOptionsSignature) {
    lastAcademicOptionsSignature = academicSignature;
    const academicOptions = academicGroups.map((ag) => ({ value: ag, text: ag }));
    const academicSelects = [elements.membersFilterAcademicGroup, elements.cardsFilterAcademicGroup];
    academicSelects.forEach((select) => {
      if (select) {
        uiManager.populateSelect(select, academicOptions, 'সকল একাডেমিক গ্রুপ');
      }
    });
  }
}

// --- Rendering Logic ---

/**
 * ফিল্টার করা শিক্ষার্থীদের তালিকা (#page-members) রেন্ডার করে।
 * @private
 */
function _renderStudentsList() {
  if (!elements.studentsListContainer) return;

  const filters = stateManager.getFilterSection('membersList');
  const filteredStudents = _applyFilters(filters);
  const renderSignature = _buildStudentRenderSignature(filteredStudents, filters, renderScopeKeys.membersList);
  if (elements.studentsListContainer.dataset.renderSignature === renderSignature) {
    return;
  }

  uiManager.clearContainer(elements.studentsListContainer);

  if (!filteredStudents.length) {
    uiManager.displayEmptyMessage(elements.studentsListContainer, 'কোনো শিক্ষার্থী পাওয়া যায়নি।');
    elements.studentsListContainer.dataset.renderSignature = renderSignature;
    return;
  }

  const groups = stateManager.get('groups') || [];
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const groupColors = _getGroupColorClasses(groups);

  const groupedStudents = new Map();
  filteredStudents.forEach((student) => {
    const key = student.groupId || 'unassigned';
    if (!groupedStudents.has(key)) groupedStudents.set(key, []);
    groupedStudents.get(key).push(student);
  });

  const sortedGroupEntries = Array.from(groupedStudents.entries()).sort((a, b) => {
    if (a[0] === 'unassigned') return 1;
    if (b[0] === 'unassigned') return -1;
    const nameA = groupMap.get(a[0])?.name || '';
    const nameB = groupMap.get(b[0])?.name || '';
    return nameA.localeCompare(nameB, 'bn');
  });

  const sections = sortedGroupEntries
    .map(([groupId, students]) => {
      const palette = groupColors[groupId] || groupColors.__default;
      const groupInfo = groupMap.get(groupId);
      const groupNameRaw = groupInfo?.name || 'গ্রুপ নির্ধারিত নয়';
      const groupName =
        helpers?.ensureBengaliText && typeof helpers.ensureBengaliText === 'function'
          ? helpers.ensureBengaliText(groupNameRaw)
          : groupNameRaw;
      const totalLabel =
        helpers?.convertToBanglaNumber && typeof helpers.convertToBanglaNumber === 'function'
          ? helpers.convertToBanglaNumber(students.length)
          : students.length;

      students.sort((a, b) => {
        const rollA = a.roll !== undefined && a.roll !== null ? a.roll.toString() : '';
        const rollB = b.roll !== undefined && b.roll !== null ? b.roll.toString() : '';
        const rollCompare = rollA.localeCompare(rollB, undefined, { numeric: true });
        if (rollCompare !== 0) return rollCompare;
        return (a.name || '').localeCompare(b.name || '', 'bn');
      });

      const studentCards = students
        .map((student) => {
          const name =
            helpers?.ensureBengaliText && typeof helpers.ensureBengaliText === 'function'
              ? helpers.ensureBengaliText(student.name || '')
              : student.name || '';
          const hasRoll = student.roll !== undefined && student.roll !== null && `${student.roll}`.trim() !== '';
          const rollDisplay = hasRoll
            ? helpers?.convertToBanglaNumber && typeof helpers.convertToBanglaNumber === 'function'
              ? helpers.convertToBanglaNumber(student.roll)
              : student.roll
            : '';
          const session =
            helpers?.ensureBengaliText && typeof helpers.ensureBengaliText === 'function'
              ? helpers.ensureBengaliText(student.session || '')
              : student.session || '';
          const gender =
            helpers?.ensureBengaliText && typeof helpers.ensureBengaliText === 'function'
              ? helpers.ensureBengaliText(student.gender || '')
              : student.gender || '';
          const academicGroupText =
            helpers?.ensureBengaliText && typeof helpers.ensureBengaliText === 'function'
              ? helpers.ensureBengaliText(student.academicGroup || '')
              : student.academicGroup || '';
          const contactMarkup = student.contact
            ? `<div class="mt-2 text-xs text-gray-500 dark:text-gray-400">যোগাযোগ: ${student.contact}</div>`
            : '';

          return `
            <article 
              class="card-3d rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/70 p-4 hover:shadow-md transition cursor-pointer"
              onclick="window.openStudentModalById && window.openStudentModalById('${student.id}')"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h5 class="text-base font-semibold text-gray-900 dark:text-white">${name || 'নাম নেই'}</h5>
                  <div class="mt-2 flex flex-wrap gap-2">
                    ${_renderAcademicBadge(student.academicGroup)}
                    ${_renderStudentRoleBadge(student.role)}
                  </div>
                </div>
                <span class="text-sm font-semibold text-gray-500 dark:text-gray-400">${
                  rollDisplay ? `রোল ${rollDisplay}` : ''
                }</span>
              </div>
              <div class="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                <p><span class="font-medium text-gray-700 dark:text-gray-200">সেশন:</span> ${session || 'N/A'}</p>
                <p><span class="font-medium text-gray-700 dark:text-gray-200">লিঙ্গ:</span> ${gender || 'N/A'}</p>
                <p><span class="font-medium text-gray-700 dark:text-gray-200">একাডেমিক গ্রুপ:</span> ${
                  academicGroupText || 'N/A'
                }</p>
              </div>
              ${contactMarkup}
              <div class="mt-4 flex justify-end gap-2">
                <button data-id="${
                  student.id
                }" class="edit-student-btn btn btn-light btn-sm py-1 px-2" aria-label="সম্পাদনা"><i class="fas fa-edit pointer-events-none"></i></button>
                <button data-id="${
                  student.id
                }" class="delete-student-btn btn btn-danger btn-sm py-1 px-2" aria-label="ডিলিট"><i class="fas fa-trash pointer-events-none"></i></button>
              </div>
            </article>
          `;
        })
        .join('');

      const headerClasses = `relative header-3d px-4 py-3 bg-gradient-to-r ${
        palette.headerBg || 'from-slate-500 to-slate-600'
      } text-white flex items-center justify-between`;
      const sectionWrapper = `mb-6 panel-3d rounded-xl overflow-hidden shadow-sm border ${
        palette.panelBorder || 'border-gray-200 dark:border-gray-700'
      }`;
      const bodyWrapper = `p-4 ${palette.sectionBg || 'bg-gray-50 dark:bg-gray-900/40'}`;

      return `
        <section class="${sectionWrapper}">
          <header class="${headerClasses}">
            <h3 class="text-lg font-semibold">${groupName}</h3>
            <span class="text-sm font-medium">মোট শিক্ষার্থী: ${totalLabel}</span>
          </header>
          <div class="${bodyWrapper}">
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              ${studentCards}
            </div>
          </div>
        </section>
      `;
    })
    .join('');

  elements.studentsListContainer.innerHTML = sections;
  elements.studentsListContainer.dataset.renderSignature = renderSignature;
}

/**
 * ফিল্টার করা শিক্ষার্থীদের কার্ড ভিউ (#page-all-students) রেন্ডার করে।
 * @private
 */
function _renderStudentCardsList() {
  if (!elements.allStudentsCardsContainer) return;

  const filters = stateManager.getFilterSection('studentCards');
  const filteredStudents = _applyFilters(filters);

  const renderSignature = _buildStudentRenderSignature(filteredStudents, filters, renderScopeKeys.studentCards);
  if (elements.allStudentsCardsContainer.dataset.renderSignature === renderSignature) {
    return;
  }

  filteredStudents.sort(
    (a, b) => (a.groupId || '').localeCompare(b.groupId || '') || (a.name || '').localeCompare(b.name || '', 'bn')
  );
  uiManager.clearContainer(elements.allStudentsCardsContainer);

  if (!filteredStudents.length) {
    uiManager.displayEmptyMessage(elements.allStudentsCardsContainer, 'কোনো শিক্ষার্থী পাওয়া যায়নি।');
    elements.allStudentsCardsContainer.dataset.renderSignature = renderSignature;
    return;
  }

  const groups = stateManager.get('groups') || [];
  const groupsMap = new Map(groups.map((g) => [g.id, g]));
  const groupColors = _getGroupColorClasses(groups);

  const cards = filteredStudents
    .map((student) => {
      const groupInfo = groupsMap.get(student.groupId);
      const groupNameRaw = groupInfo?.name || 'গ্রুপ নির্ধারিত নয়';
      const groupName = _formatLabel(groupNameRaw);
      const palette = groupColors[student.groupId] || groupColors.__default;
      const name = _formatLabel(student.name || 'নাম নেই');
      const hasRoll = student.roll !== undefined && student.roll !== null && `${student.roll}`.trim() !== '';
      const rollDisplay = hasRoll
        ? helpers?.convertToBanglaNumber && typeof helpers.convertToBanglaNumber === 'function'
          ? helpers.convertToBanglaNumber(student.roll)
          : String(student.roll)
        : '';
      const session = _formatLabel(student.session || 'N/A');
      const gender = _formatLabel(student.gender || 'N/A');
      const academicGroup = _formatLabel(student.academicGroup || 'N/A');

      return `
  <article
    class="card-3d relative mx-auto w-full max-w-lg md:max-w-xl rounded-2xl border ${
      palette.panelBorder || 'border-gray-200 dark:border-gray-700'
    } bg-white dark:bg-gray-900/80 hover:shadow-lg transition duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2"
    data-student-id="${student.id}"
    role="button"
    tabindex="0"
    aria-label="${name} - বিস্তারিত"
    onclick="window.openStudentModalById && window.openStudentModalById('${student.id}')"
  >
    <!-- Top gradient bar -->
    <div class="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${
      palette.headerBg || 'from-indigo-500 to-blue-500'
    } rounded-t-2xl"></div>

    <!-- Body (kept compact) -->
    <div class="relative px-2 pt-8 pb-4 flex flex-col items-center gap-2">

      <!-- Roll: top-center -->
      <span
        class="absolute -top-4 left-1/2 -translate-x-1/2 inline-flex h-10 min-w-[72px] px-3 items-center justify-center rounded-xl
               bg-gray-100 text-[13px] font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-200 shadow-inner
               ring-1 ring-gray-300 dark:ring-gray-700"
      >
        ${rollDisplay ? `রোল ${rollDisplay}` : 'N/A'}
      </span>

      <!-- Name (below roll) -->
      <h4
        class="mt-1 text-base md:text-lg font-semibold leading-snug text-gray-900 dark:text-white
               text-center whitespace-normal break-words hyphens-auto"
        title="${name}"
      >
        ${name}
      </h4>

      <!-- Badges (tight wrap) -->
      <!-- Badges (tight wrap) -->
      <div class="flex flex-col items-center gap-1.5 w-full">
        <div class="flex flex-wrap justify-center gap-1.5 w-full">
          ${_renderAcademicBadge(student.academicGroup)}
          ${_renderStudentRoleBadge(student.role)}
        </div>
        <span class="${BADGE_BASE_CLASS} ${
        palette.chipBg ||
        'bg-gray-200 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600'
      } badge-3d max-w-full whitespace-normal text-center leading-tight justify-center px-3 py-1.5 text-[11px]" title="গ্রুপ: ${groupName}">গ্রুপ: ${groupName}</span>
      </div>

      <!-- Info grid (compact, non-overlapping) -->
      <!-- Info grid (compact, non-overlapping) -->
      <section class="w-full" aria-label="Student details">
        <div class="flex items-center justify-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/50 px-3 py-1.5">
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] text-gray-500 dark:text-gray-400">সেশন:</span>
            <span class="text-[11px] font-bold text-gray-700 dark:text-gray-200">${session}</span>
          </div>
          <div class="h-3 w-px bg-gray-300 dark:bg-gray-600"></div>
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] text-gray-500 dark:text-gray-400">লিঙ্গ:</span>
            <span class="text-[11px] font-bold text-gray-700 dark:text-gray-200">${gender}</span>
          </div>
        </div>
      </section>

    </div>
  </article>
`;
    })
    .join('');

  elements.allStudentsCardsContainer.innerHTML = `
    <div class="grid items-stretch gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      ${cards}
    </div>
  `;
  elements.allStudentsCardsContainer.dataset.renderSignature = renderSignature;
}

/**
 * শিক্ষার্থীদের তালিকা ফিল্টার করে।
 * @param {object} filters - { groupFilter, academicFilter, searchTerm }
 * @returns {Array<object>} - ফিল্টার করা শিক্ষার্থীদের তালিকা।
 * @private
 */
function _applyFilters(filters) {
  const students = stateManager.get('students') || [];

  const { groupFilter, academicFilter, searchTerm } = filters || {};
  const term = _safeLower(searchTerm || '');

  return students.filter((student) => {
    const matchesGroup = !groupFilter || groupFilter === 'all' || student.groupId === groupFilter;
    const matchesAcademic =
      !academicFilter || academicFilter === 'all' || student.academicGroup === academicFilter;
    const matchesSearch =
      !term ||
      _safeLower(student.name).includes(term) ||
      _safeLower(student.roll).includes(term) ||
      _safeLower(student.academicGroup).includes(term);
    return matchesGroup && matchesAcademic && matchesSearch;
  });
}

// --- CRUD Handlers ---

/**
 * নতুন শিক্ষার্থী যোগ করার হ্যান্ডলার।
 * @private
 */
async function _handleAddStudent() {
  // Permission check
  if (!permissionHelper?.canWrite()) {
    uiManager.showToast('আপনার নতুন শিক্ষার্থী যোগ করার অনুমতি নেই।', 'warning');
    return;
  }

  const name = elements.studentNameInput?.value.trim();
  const roll = elements.studentRollInput?.value.trim();
  const gender = elements.studentGenderInput?.value;
  const classId = elements.studentClassInput?.value;
  const sectionId = elements.studentSectionInput?.value;
  const groupId = elements.studentGroupInput?.value;
  const contact = elements.studentContactInput?.value.trim();
  const academicGroup = elements.studentAcademicGroupInput?.value.trim();
  const session = elements.studentSessionInput?.value.trim();
  const role = elements.studentRoleInput?.value;

  if (!name || !roll || !gender || !classId || !sectionId || !academicGroup || !session) {
    uiManager.showToast('নাম, রোল, লিঙ্গ, ক্লাস, শাখা, একাডেমিক গ্রুপ এবং সেশন আবশ্যক।', 'warning');
    return;
  }

  uiManager.showLoading('শিক্ষার্থী যাচাই করা হচ্ছে...');
  try {
    const isDuplicate = await dataService.checkStudentUniqueness(roll, academicGroup);
    if (isDuplicate) {
      uiManager.showToast('এই রোল নম্বর এবং একাডেমিক গ্রুপ দিয়ে ইতিমধ্যে একজন শিক্ষার্থী রয়েছে।', 'warning');
      uiManager.hideLoading();
      return;
    }
  } catch (error) {
    console.error('Uniqueness check failed:', error);
    uiManager.showToast(`শিক্ষার্থী যাচাই করতে সমস্যা হয়েছে: ${error.message}`, 'error');
    uiManager.hideLoading();
    return;
  }

  const newStudentData = { name, roll, gender, classId, sectionId, groupId, contact, academicGroup, session, role };

  uiManager.showLoading('শিক্ষার্থী যোগ করা হচ্ছে...');
  try {
    await dataService.addStudent(newStudentData);
    await app.refreshAllData(); // Refresh data

    // Reset form
    if (elements.studentNameInput) elements.studentNameInput.value = '';
    if (elements.studentRollInput) elements.studentRollInput.value = '';
    if (elements.studentGroupInput) elements.studentGroupInput.value = '';
    if (elements.studentClassInput) elements.studentClassInput.value = '';
    if (elements.studentSectionInput) elements.studentSectionInput.value = '';
    if (elements.studentContactInput) elements.studentContactInput.value = '';
    if (elements.studentAcademicGroupInput) elements.studentAcademicGroupInput.value = '';
    if (elements.studentSessionInput) elements.studentSessionInput.value = '';
    if (elements.studentRoleInput) elements.studentRoleInput.value = '';

    uiManager.showToast('শিক্ষার্থী সফলভাবে যোগ করা হয়েছে।', 'success');
  } catch (error) {
    console.error('❌ Error adding student:', error);
    uiManager.showToast(`শিক্ষার্থী যোগ করতে সমস্যা হয়েছে: ${error.message}`, 'error');
  } finally {
    uiManager.hideLoading();
  }
}

/**
 * শিক্ষার্থী সম্পাদনার জন্য মোডাল দেখানোর হ্যান্ডলার।
 * @param {string} studentId
 * @private
 */
function _handleEditStudent(studentId) {
  // Permission check
  if (!permissionHelper?.canEdit()) {
    uiManager.showToast('আপনার শিক্ষার্থী সম্পাদনা করার অনুমতি নেই।', 'warning');
    return;
  }

  const student = stateManager.get('students').find((s) => s.id === studentId);
  if (!student) {
    uiManager.showToast('শিক্ষার্থী পাওয়া যায়নি।', 'error');
    return;
  }

  const groups = stateManager.get('groups');
  const classes = stateManager.get('classes') || [];
  const sections = stateManager.get('sections') || [];

  const groupOptions = groups
    .map(
      (g) =>
        `<option value="${g.id}" ${g.id === student.groupId ? 'selected' : ''}>${helpers.ensureBengaliText(
          g.name
        )}</option>`
    )
    .sort((a, b) => a.localeCompare(b, 'bn'))
    .join('');

  const classOptions = `<option value="">ক্লাস নির্বাচন করুন</option>` + classes
    .map(c => `<option value="${c.id}" ${c.id === student.classId ? 'selected' : ''}>${c.name}</option>`)
    .join('');

  const initialSections = sections.filter(s => s.classId === (student.classId || ''));
  const sectionOptions = `<option value="">শাখা নির্বাচন করুন</option>` + initialSections
    .map(s => `<option value="${s.id}" ${s.id === student.sectionId ? 'selected' : ''}>${s.name}</option>`)
    .join('');

  const roleOptions = [
    { value: '', text: 'কোনোটি না' },
    { value: 'team-leader', text: 'টিম লিডার' },
    { value: 'time-keeper', text: 'টাইম কিপার' },
    { value: 'reporter', text: 'রিপোর্টার' },
    { value: 'resource-manager', text: 'রিসোর্স ম্যানেজার' },
    { value: 'peace-maker', text: 'পিস মেকার' },
  ]
    .map((r) => `<option value="${r.value}" ${r.value === student.role ? 'selected' : ''}>${r.text}</option>`)
    .join('');

  const contentHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label class="label">নাম*</label><input id="editStudentName" type="text" value="${
              student.name || ''
            }" class="form-input" maxlength="100"></div>
            <div><label class="label">রোল*</label><input id="editStudentRoll" type="text" value="${
              student.roll || ''
            }" class="form-input" maxlength="20"></div>
            <div><label class="label">লিঙ্গ*</label><select id="editStudentGender" class="form-select"><option value="ছেলে" ${
              student.gender === 'ছেলে' ? 'selected' : ''
            }>ছেলে</option><option value="মেয়ে" ${
    student.gender === 'মেয়ে' ? 'selected' : ''
  }>মেয়ে</option></select></div>
            <div><label class="label">গ্রুপ</label><select id="editStudentGroup" class="form-select"><option value="">গ্রুপ নেই</option>${groupOptions}</select></div>
            <div><label class="label">ক্লাস</label><select id="editStudentClass" class="form-select">${classOptions}</select></div>
            <div><label class="label">শাখা</label><select id="editStudentSection" class="form-select">${sectionOptions}</select></div>
            <div><label class="label">যোগাযোগ</label><input id="editStudentContact" type="text" value="${
              student.contact || ''
            }" class="form-input" maxlength="100"></div>
            <div><label class="label">একাডেমিক গ্রুপ*</label><input id="editStudentAcademicGroup" type="text" value="${
              student.academicGroup || ''
            }" class="form-input" maxlength="50"></div>
            <div><label class="label">সেশন*</label><input id="editStudentSession" type="text" value="${
              student.session || ''
            }" class="form-input" maxlength="20"></div>
            <div><label class="label">দায়িত্ব</label><select id="editStudentRole" class="form-select">${roleOptions}</select></div>
        </div>`;

  uiManager.showEditModal('শিক্ষার্থী সম্পাদনা', contentHTML, async () => {
    // Save Callback
    const updatedData = {
      name: document.getElementById('editStudentName')?.value.trim(),
      roll: document.getElementById('editStudentRoll')?.value.trim(),
      gender: document.getElementById('editStudentGender')?.value,
      groupId: document.getElementById('editStudentGroup')?.value,
      classId: document.getElementById('editStudentClass')?.value,
      sectionId: document.getElementById('editStudentSection')?.value,
      contact: document.getElementById('editStudentContact')?.value.trim(),
      academicGroup: document.getElementById('editStudentAcademicGroup')?.value.trim(),
      session: document.getElementById('editStudentSession')?.value.trim(),
      role: document.getElementById('editStudentRole')?.value,
    };
    if (
      !updatedData.name ||
      !updatedData.roll ||
      !updatedData.gender ||
      !updatedData.academicGroup ||
      !updatedData.session
    ) {
      uiManager.showToast('নাম, রোল, লিঙ্গ, একাডেমিক গ্রুপ এবং সেশন আবশ্যক।', 'warning');
      return;
    }

    uiManager.showLoading('যাচাই করা হচ্ছে...');
    if (updatedData.roll !== student.roll || updatedData.academicGroup !== student.academicGroup) {
      try {
        const isDuplicate = await dataService.checkStudentUniqueness(
          updatedData.roll,
          updatedData.academicGroup,
          studentId
        );
        if (isDuplicate) {
          uiManager.showToast('এই রোল নম্বর এবং একাডেমিক গ্রুপ দিয়ে অন্য একজন শিক্ষার্থী রয়েছে।', 'warning');
          uiManager.hideLoading();
          return;
        }
      } catch (error) {
        uiManager.showToast(`যাচাই করতে সমস্যা: ${error.message}`, 'error');
        uiManager.hideLoading();
        return;
      }
    }
    uiManager.showLoading('আপডেট করা হচ্ছে...');
    try {
      await dataService.updateStudent(studentId, updatedData);
      await app.refreshAllData();
      uiManager.hideModal(uiManager.elements.editModal);
      uiManager.showToast('শিক্ষার্থী সফলভাবে আপডেট করা হয়েছে।', 'success');
    } catch (error) {
      console.error('❌ Error updating student:', error);
      uiManager.showToast(`আপডেট করতে সমস্যা হয়েছে: ${error.message}`, 'error');
    } finally {
      uiManager.hideLoading();
    }
  });

  // Dynamic Section Loading
  setTimeout(() => {
    const classSelect = document.getElementById('editStudentClass');
    const sectionSelect = document.getElementById('editStudentSection');
    if (classSelect && sectionSelect) {
      classSelect.addEventListener('change', () => {
        const selectedClassId = classSelect.value;
        const relevantSections = sections.filter((s) => s.classId === selectedClassId);
        sectionSelect.innerHTML =
          `<option value="">শাখা নির্বাচন করুন</option>` +
          relevantSections.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
      });
    }
  }, 100);
}

/**
 * শিক্ষার্থী ডিলিটের হ্যান্ডলার।
 * @param {string} studentId
 * @private
 */
function _handleDeleteStudent(studentId) {
  // Permission check
  if (!permissionHelper?.canDelete()) {
    uiManager.showToast('আপনার শিক্ষার্থী মুছে ফেলার অনুমতি নেই।', 'warning');
    return;
  }

  const student = stateManager.get('students').find((s) => s.id === studentId);
  if (!student) {
    uiManager.showToast('শিক্ষার্থী পাওয়া যায়নি।', 'error');
    return;
  }

  const message = `আপনি কি নিশ্চিত যে আপনি "${student.name}" (রোল: ${helpers.convertToBanglaNumber(
    student.roll
  )}) কে ডিলিট করতে চান?`;

  uiManager.showDeleteModal('শিক্ষার্থী ডিলিট নিশ্চিতকরণ', message, async () => {
    // Confirm Callback
    uiManager.showLoading('ডিলিট করা হচ্ছে...');
    try {
      await dataService.deleteStudent(studentId);
      // TODO: Delete associated evaluation data?
      await app.refreshAllData();
      uiManager.showToast('শিক্ষার্থী সফলভাবে ডিলিট করা হয়েছে।', 'success');
    } catch (error) {
      console.error('❌ Error deleting student:', error);
      uiManager.showToast(`ডিলিট করতে সমস্যা হয়েছে: ${error.message}`, 'error');
    } finally {
      uiManager.hideLoading();
    }
  });
}

// --- CSV Handling ---

function _handleDownloadTemplate() {
  const headers = ['নাম', 'রোল', 'লিঙ্গ', 'ক্লাস', 'শাখা', 'একাডেমিক গ্রুপ', 'সেশন', 'যোগাযোগ', 'গ্রুপের নাম', 'দায়িত্ব কোড'];
  const example = [
    'উদাহরণ শিক্ষার্থী',
    '১০১',
    'ছেলে',
    'নবম',
    'A',
    'বিজ্ঞান',
    '2023-24',
    '01xxxxxxxxx',
    'গ্রুপ আলফা',
    'team-leader',
  ];
  const rolesNote = `# দায়িত্ব কোডসমূহ: team-leader, time-keeper, reporter, resource-manager, peace-maker (খালি রাখা যাবে)`;
  const classNote = `# ক্লাস ও শাখা: Class Management থেকে তৈরি করা ক্লাস ও শাখার নাম লিখুন`;
  const csv = Papa.unparse([headers, example], { header: false });
  const fullCsv = rolesNote + '\n' + classNote + '\n' + csv;
  
  // Create blob with BOM for UTF-8
  const BOM = '\uFEFF';
  const csvContent = BOM + fullCsv;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Use modern download approach
  if (window.navigator && window.navigator.msSaveOrOpenBlob) {
    // IE11 support
    window.navigator.msSaveOrOpenBlob(blob, 'student_template.csv');
  } else {
    // Modern browsers
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'student_template.csv';
    link.style.display = 'none';
    
    // Add to DOM, click, and remove
    document.body.appendChild(link);
    link.click();
    
    // Cleanup after a delay
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 250);
  }
  
  uiManager.showToast('CSV টেমপ্লেট ডাউনলোড শুরু হয়েছে।', 'info');
}

function _handleFileSelect() {
  if (elements.csvFileInput.files.length > 0) {
    elements.csvFileName.textContent = `নির্বাচিত ফাইল: ${elements.csvFileInput.files[0].name}`;
  } else {
    elements.csvFileName.textContent = '';
  }
}

function _handleProcessImport() {
  // Permission check
  if (!permissionHelper?.canWrite()) {
    uiManager.showToast('আপনার CSV import করার অনুমতি নেই।', 'warning');
    return;
  }

  const file = elements.csvFileInput?.files[0];
  if (!file) {
    uiManager.showToast('অনুগ্রহ করে একটি CSV ফাইল নির্বাচন করুন।', 'warning');
    return;
  }

  uiManager.showLoading('CSV ফাইল প্রসেস করা হচ্ছে...');
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',
    transformHeader: (h) => helpers.ensureBengaliText(h).trim(),
    transform: (value) => helpers.ensureBengaliText(value),
    complete: async (results) => {
      const data = results.data;
      const errors = [];
      const newStudents = [];
      if (!data || data.length === 0) errors.push('CSV ফাইলটি খালি।');
      const requiredHeaders = ['নাম', 'রোল', 'লিঙ্গ', 'ক্লাস', 'শাখা', 'একাডেমিক গ্রুপ', 'সেশন'];
      const missingHeaders = requiredHeaders.filter((h) => !results.meta.fields.includes(h));
      if (missingHeaders.length > 0) errors.push(`আবশ্যক হেডার নেই: ${missingHeaders.join(', ')}`);

      if (errors.length > 0) {
        uiManager.hideLoading();
        uiManager.showToast(errors[0], 'error', 5000);
        return;
      }

      // Helper for normalizing text for comparison
      const normalizeText = (text) => (text || '').normalize('NFC').trim().toLowerCase();

      const groupsMap = new Map(stateManager.get('groups').map((g) => [normalizeText(g.name), g.id]));
      
      // --- Auto-Create Logic Start ---
      let classes = stateManager.get('classes');
      let classesMap = new Map(classes.map((c) => [normalizeText(c.name), c.id]));

      // 1. Identify and Create Missing Classes
      const newClasses = new Set();
      for (const row of data) {
        const cName = normalizeText(row['ক্লাস']);
        if (cName && !classesMap.has(cName)) newClasses.add(row['ক্লাস'].trim());
      }

      if (newClasses.size > 0) {
        if (confirm(`CSV ফাইলে ${newClasses.size} টি নতুন ক্লাস পাওয়া গেছে:\n${[...newClasses].join(', ')}\n\nএগুলো কি ডাটাবেসে যোগ করবেন?`)) {
          uiManager.showLoading('নতুন ক্লাস তৈরি করা হচ্ছে...');
          for (const name of newClasses) {
            await dataService.addDocument('classes', { name, createdAt: new Date().toISOString() });
          }
          classes = await dataService.loadClasses();
          stateManager.update({ classes });
          classesMap = new Map(classes.map((c) => [normalizeText(c.name), c.id]));
        } else {
          uiManager.hideLoading();
          return;
        }
      }

      // 2. Identify and Create Missing Sections
      let sections = stateManager.get('sections');
      // Key: ClassID_SectionName -> SectionID
      let sectionsMap = new Map(sections.map((s) => [`${s.classId}_${normalizeText(s.name)}`, s.id]));
      
      const newSections = new Map(); // Key: Composite, Value: Info
      for (const row of data) {
        const cName = normalizeText(row['ক্লাস']);
        const sName = normalizeText(row['শাখা']);
        if (cName && sName) {
          const classId = classesMap.get(cName);
          if (classId) {
            const key = `${classId}_${sName}`;
            if (!sectionsMap.has(key)) {
              newSections.set(key, { name: row['শাখা'].trim(), classId });
            }
          }
        }
      }

      if (newSections.size > 0) {
        if (confirm(`CSV ফাইলে ${newSections.size} টি নতুন শাখা পাওয়া গেছে।\nএগুলো কি ডাটাবেসে যোগ করবেন?`)) {
          uiManager.showLoading('নতুন শাখা তৈরি করা হচ্ছে...');
          for (const info of newSections.values()) {
            await dataService.addDocument('sections', { 
              name: info.name, 
              classId: info.classId, 
              createdAt: new Date().toISOString() 
            });
          }
          sections = await dataService.loadSections();
          stateManager.update({ sections });
          sectionsMap = new Map(sections.map((s) => [`${s.classId}_${normalizeText(s.name)}`, s.id]));
        } else {
          uiManager.hideLoading();
          return;
        }
      }
      // --- Auto-Create Logic End ---

      const existingStudents = stateManager.get('students');
      uiManager.showLoading('শিক্ষার্থী ডেটা যাচাই করা হচ্ছে...');

      // Use Promise.all for faster (parallel) DB checks
      const validationPromises = data.map(async (row, i) => {
        const lineNumber = i + 2;
        const name = row['নাম'];
        const roll = row['রোল'];
        const gender = row['লিঙ্গ'];
        const className = normalizeText(row['ক্লাস']);
        const sectionName = normalizeText(row['শাখা']);
        const academicGroup = row['একাডেমিক গ্রুপ'];
        const session = row['সেশন'];
        const contact = row['যোগাযোগ'] || '';
        const groupName = normalizeText(row['গ্রুপের নাম']);
        const roleCode = (row['দায়িত্ব কোড'] || '').toLowerCase();

        if (!name || !roll || !gender || !className || !sectionName || !academicGroup || !session) {
          return { error: `লাইন ${lineNumber}: আবশ্যক ফিল্ড খালি রয়েছে।` };
        }
        // Normalize gender for comparison
        const normalizedGender = gender.normalize('NFC');
        const validGenders = ['ছেলে', 'মেয়ে', 'মেয়ে']; // Includes both U+09DF and U+09AF+U+09BC variants
        
        if (!validGenders.includes(normalizedGender)) {
          return { error: `লাইন ${lineNumber}: লিঙ্গ (${gender}) অবশ্যই 'ছেলে' অথবা 'মেয়ে' হতে হবে।` };
        }
        
        // Validate class
        const classId = classesMap.get(className) || '';
        if (!classId) {
          const availableClasses = Array.from(classesMap.keys()).join(', ');
          return { error: `লাইন ${lineNumber}: "${row['ক্লাস']}" নামে ক্লাস পাওয়া যায়নি। (উপলব্ধ: ${availableClasses})` };
        }
        
        // Validate section
        const sectionKey = `${classId}_${sectionName}`;
        const sectionId = sectionsMap.get(sectionKey) || '';
        if (!sectionId) {
           // Helper to list available sections for this class
           const availableSections = sections
             .filter(s => s.classId === classId)
             .map(s => s.name)
             .join(', ');
          return { error: `লাইন ${lineNumber}: "${row['ক্লাস']}" ক্লাসের জন্য "${row['শাখা']}" শাখা পাওয়া যায়নি। (উপলব্ধ: ${availableSections})` };
        }
        
        const groupId = groupName ? groupsMap.get(groupName) || '' : '';
        if (groupName && !groupId) {
          // Limit available groups display as there might be many
          const availableGroups = Array.from(groupsMap.keys()).slice(0, 10).join(', ') + (groupsMap.size > 10 ? '...' : '');
          return { error: `লাইন ${lineNumber}: "${row['গ্রুপের নাম']}" নামে গ্রুপ পাওয়া যায়নি।` };
        }

        // Standardize gender for database consistency
        const finalGender = ['মেয়ে', 'মেয়ে'].includes(normalizedGender) ? 'মেয়ে' : 'ছেলে';
        
        const studentObj = { name, roll, gender: finalGender, classId, sectionId, groupId, contact, academicGroup, session, role: roleCode };

        // Check for existing student in local state (Update Mode)
        const existingStudent = existingStudents.find(s => 
            String(s.roll) === String(roll) && 
            normalizeText(s.academicGroup) === normalizeText(academicGroup)
        );

        if (existingStudent) {
             return { 
                 student: { ...studentObj, id: existingStudent.id },
                 isUpdate: true
             };
        } else {
             return { 
                 student: studentObj,
                 isUpdate: false
             };
        }
      });

      const resultsData = await Promise.all(validationPromises);

      // Check for duplicates *within* the CSV file
      const rollCheck = new Set();
      for (const item of resultsData) {
        if (item.student) {
          const key = `${item.student.roll}|${item.student.academicGroup}`;
          if (rollCheck.has(key)) {
            item.error = `লাইন (CSV): রোল ${item.student.roll} (${item.student.academicGroup}) ফাইলে ডুপ্লিকেট রয়েছে।`;
            delete item.student;
          }
          rollCheck.add(key);
        }
        if (item.error) errors.push(item.error);
        else if (item.student) {
            item.student.isUpdate = item.isUpdate;
            newStudents.push(item.student);
        }
      }
      // --- End Validation ---

      if (errors.length > 0) {
        uiManager.hideLoading();
        const shortError = errors.slice(0, 3).join('\n') + (errors.length > 3 ? '\n...' : '');
        uiManager.showToast(
          `CSV ইম্পোর্টে ${helpers.convertToBanglaNumber(errors.length)} টি ত্রুটি:\n${shortError}`,
          'error',
          10000
        );
        console.error('CSV Import Errors:', errors);
      } else if (newStudents.length > 0) {
        const toAdd = newStudents.filter(s => !s.isUpdate);
        const toUpdate = newStudents.filter(s => s.isUpdate);
        
        uiManager.showLoading(`প্রসেসিং: ${helpers.convertToBanglaNumber(toAdd.length)} নতুন, ${helpers.convertToBanglaNumber(toUpdate.length)} আপডেট...`);
        
        try {
          // Add new
          for (const s of toAdd) {
             const { isUpdate, ...data } = s;
             await dataService.addStudent(data);
          }
          // Update existing
          for (const s of toUpdate) {
             const { isUpdate, id, ...data } = s;
             await dataService.updateStudent(id, data);
          }
          
          await app.refreshAllData();
          uiManager.showToast(
            `সফল! ${helpers.convertToBanglaNumber(toAdd.length)} যোগ, ${helpers.convertToBanglaNumber(toUpdate.length)} আপডেট।`,
            'success'
          );
        } catch (error) {
          uiManager.showToast(`শিক্ষার্থী সেভ করতে সমস্যা: ${error.message}`, 'error');
        } finally {
          uiManager.hideLoading();
        }
      } else {
        uiManager.hideLoading();
        uiManager.showToast('CSV ফাইলে নতুন শিক্ষার্থী পাওয়া যায়নি।', 'info');
      }

      if (elements.csvFileInput) elements.csvFileInput.value = '';
      if (elements.csvFileName) elements.csvFileName.textContent = '';
    },
    error: (err) => {
      uiManager.hideLoading();
      uiManager.showToast(`CSV ফাইল পার্স করতে সমস্যা: ${err.message}`, 'error');
    },
  });
}

// --- Quick Add Functions ---

/**
 * Quick add class - mini modal
 * @private
 */
async function _handleQuickAddClass() {
  const contentHTML = `
    <div>
      <label class="label" for="quickClassName">ক্লাসের নাম *</label>
      <input id="quickClassName" type="text" class="form-input w-full" maxlength="50" placeholder="যেমন: নবম, দশম">
    </div>
    <div class="mt-3">
      <label class="label" for="quickClassCode">কোড</label>
      <input id="quickClassCode" type="text" class="form-input w-full" maxlength="20" placeholder="যেমন: IX, X">
    </div>
  `;
  
  uiManager.showEditModal('নতুন ক্লাস যোগ করুন', contentHTML, async () => {
    const name = document.getElementById('quickClassName')?.value.trim();
    const code = document.getElementById('quickClassCode')?.value.trim();
    
    if (!name) {
      uiManager.showToast('ক্লাসের নাম লিখুন।', 'warning');
      return;
    }
    
    uiManager.showLoading('ক্লাস যোগ করা হচ্ছে...');
    try {
      const newClassId = await dataService.addClass({ name, code });
      await app.refreshAllData();
      
      // Reload class dropdown
      await _populateClassDropdown();
      
      // Auto-select newly created class
      if (elements.studentClassInput) {
        elements.studentClassInput.value = newClassId;
      }
      
      uiManager.hideModal(uiManager.elements.editModal);
      uiManager.showToast('ক্লাস সফলভাবে যোগ করা হয়েছে।', 'success');
    } catch (error) {
      console.error('❌ Error adding class:', error);
      uiManager.showToast(`ক্লাস যোগ করতে সমস্যা: ${error.message}`, 'error');
    } finally {
      uiManager.hideLoading();
    }
  });
}

/**
 * Quick add section - mini modal
 * @private
 */
async function _handleQuickAddSection() {
  const contentHTML = `
    <div>
      <label class="label" for="quickSectionName">শাখার নাম *</label>
      <input id="quickSectionName" type="text" class="form-input w-full" maxlength="50" placeholder="যেমন: A, B, C">
    </div>
  `;
  
  uiManager.showEditModal('নতুন শাখা যোগ করুন', contentHTML, async () => {
    const name = document.getElementById('quickSectionName')?.value.trim();
    
    if (!name) {
      uiManager.showToast('শাখার নাম লিখুন।', 'warning');
      return;
    }
    
    uiManager.showLoading('শাখা যোগ করা হচ্ছে...');
    try {
      const newSectionId = await dataService.addSection({ name });
      await app.refreshAllData();
      
      // Reload section dropdown
      await _populateSectionDropdown();
      
      // Auto-select newly created section
      if (elements.studentSectionInput) {
        elements.studentSectionInput.value = newSectionId;
      }
      
      uiManager.hideModal(uiManager.elements.editModal);
      uiManager.showToast('শাখা সফলভাবে যোগ করা হয়েছে।', 'success');
    } catch (error) {
      console.error('❌ Error adding section:', error);
      uiManager.showToast(`শাখা যোগ করতে সমস্যা: ${error.message}`, 'error');
    } finally {
      uiManager.hideLoading();
    }
  });
}

/**
 * Populate class dropdown
 * @private
 */
async function _populateClassDropdown() {
  if (!elements.studentClassInput) return;
  
  const classes = stateManager.get('classes') || [];
  const options = classes.map(c => ({ value: c.id, text: helpers.ensureBengaliText(c.name) }))
    .sort((a, b) => a.text.localeCompare(b.text, 'bn'));
  
  uiManager.populateSelect(elements.studentClassInput, options, 'নির্বাচন করুন');
}

/**
 * Populate section dropdown
 * @param {string} [classId] - Optional class ID to filter sections
 * @private
 */
async function _populateSectionDropdown(classId = null) {
  if (!elements.studentSectionInput) return;
  
  let sections = stateManager.get('sections') || [];
  
  // Filter sections by class if classId is provided
  if (classId) {
    sections = sections.filter(s => s.classId === classId);
  }
  
  const options = sections.map(s => ({ value: s.id, text: helpers.ensureBengaliText(s.name) }))
    .sort((a, b) => a.text.localeCompare(b.text, 'bn'));
  
  // Clear current selection
  elements.studentSectionInput.value = '';
  
  if (sections.length === 0 && classId) {
    // No sections for this class
    uiManager.populateSelect(elements.studentSectionInput, [], 'এই ক্লাসের কোনো শাখা নেই');
  } else {
    uiManager.populateSelect(elements.studentSectionInput, options, 'নির্বাচন করুন');
  }
}

// --- Helper Functions ---
function _getRoleText(roleCode) {
  const roles = {
    'team-leader': 'টিম লিডার',
    'time-keeper': 'টাইম কিপার',
    reporter: 'রিপোর্টার',
    'resource-manager': 'রিসোর্স ম্যানেজার',
    'peace-maker': 'পিস মেকার',
  };
  return roles[roleCode] || roleCode || 'কোনোটি না'; // Handle empty/null
}

function _getGroupColorClasses(groups) {
  const palette = [
    {
      panelBorder: 'border-blue-300 dark:border-blue-700',
      sectionBg: 'bg-blue-50/80 dark:bg-blue-900/15',
      headerBg: 'from-blue-500 to-indigo-500',
      chipBg: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-800',
    },
    {
      panelBorder: 'border-emerald-300 dark:border-emerald-700',
      sectionBg: 'bg-emerald-50/80 dark:bg-emerald-900/15',
      headerBg: 'from-emerald-500 to-teal-500',
      chipBg:
        'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800',
    },
    {
      panelBorder: 'border-amber-300 dark:border-amber-700',
      sectionBg: 'bg-amber-50/80 dark:bg-amber-900/20',
      headerBg: 'from-amber-500 to-orange-500',
      chipBg:
        'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800',
    },
    {
      panelBorder: 'border-purple-300 dark:border-purple-700',
      sectionBg: 'bg-purple-50/80 dark:bg-purple-900/15',
      headerBg: 'from-violet-500 to-purple-600',
      chipBg:
        'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-100 dark:border-purple-800',
    },
    {
      panelBorder: 'border-rose-300 dark:border-rose-700',
      sectionBg: 'bg-rose-50/80 dark:bg-rose-900/15',
      headerBg: 'from-rose-500 to-pink-500',
      chipBg: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-800',
    },
    {
      panelBorder: 'border-sky-300 dark:border-sky-700',
      sectionBg: 'bg-sky-50/80 dark:bg-sky-900/15',
      headerBg: 'from-sky-500 to-cyan-500',
      chipBg: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-800',
    },
    {
      panelBorder: 'border-indigo-300 dark:border-indigo-700',
      sectionBg: 'bg-indigo-50/80 dark:bg-indigo-900/15',
      headerBg: 'from-indigo-500 to-blue-600',
      chipBg:
        'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-100 dark:border-indigo-800',
    },
    {
      panelBorder: 'border-lime-300 dark:border-lime-700',
      sectionBg: 'bg-lime-50/80 dark:bg-lime-900/15',
      headerBg: 'from-lime-500 to-green-500',
      chipBg: 'bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-900/40 dark:text-lime-100 dark:border-lime-800',
    },
  ];

  const fallback = {
    panelBorder: 'border-gray-200 dark:border-gray-700',
    sectionBg: 'bg-gray-50 dark:bg-gray-900/40',
    headerBg: 'from-slate-500 to-slate-600',
    chipBg: 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600',
  };

  const map = { __default: fallback };
  (groups || []).forEach((group, index) => {
    map[group.id] = palette[index % palette.length];
  });
  return map;
}
