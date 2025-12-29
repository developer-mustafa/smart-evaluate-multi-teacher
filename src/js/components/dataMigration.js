// js/components/dataMigration.js
// Data Migration Tool - Hybrid approach for updating legacy data

let stateManager;
let uiManager;
let dataService;

const elements = {};
const migrationState = {
  issues: [],
  approved: [],
  skipped: [],
  scanning: false,
  migrating: false,
  progress: 0
};

export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  dataService = dependencies.services.dataService;

  console.log('✅ Data Migration component initialized.');
  return { render };
}

export function render() {
  console.log('🚀 Data Migration render called');
  try {
    const page = document.getElementById('page-data-migration');
    if (!page) {
      console.error('❌ Page element #page-data-migration not found!');
      return;
    }

    console.log('📄 Found page element, setting innerHTML...');
    page.innerHTML = getHTML();
    
    console.log('🧩 Caching elements...');
    _cacheElements();
    
    console.log('🎧 Attaching listeners...');
    _attachListeners();
    
    // Ensure page is visible
    page.classList.remove('hidden');
    
    console.log('📊 Data Migration Tool rendered successfully.');
  } catch (error) {
    console.error('❌ Error rendering Data Migration Tool:', error);
    const page = document.getElementById('page-data-migration');
    if (page) {
      page.innerHTML = `<div class="p-4 text-red-600">Error rendering tool: ${error.message}</div>`;
    }
  }
}

function getHTML() {
  return `
    <div class="max-w-7xl mx-auto p-6 space-y-6">
      <!-- Header -->
      <div class="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 rounded-2xl p-6 text-white shadow-lg">
        <div class="flex items-center gap-3 mb-2">
          <i class="fas fa-database text-3xl"></i>
          <h1 class="text-2xl font-bold">ডেটা মাইগ্রেশন টুল</h1>
        </div>
        <p class="text-indigo-100 dark:text-indigo-200">পুরাতন ডেটা আপডেট করুন - ক্লাস, শাখা ও বিষয় যুক্ত করুন</p>
      </div>

      <!-- Status Overview -->
      <div id="statusOverview" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Will be populated dynamically -->
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap gap-3">
        <button id="btnScanDatabase" class="btn-primary flex items-center gap-2">
          <i class="fas fa-search"></i>
          <span>ডেটাবেজ স্ক্যান করুন</span>
        </button>
        <button id="btnStartMigration" class="btn-success flex items-center gap-2 hidden">
          <i class="fas fa-play"></i>
          <span>মাইগ্রেশন শুরু করুন</span>
        </button>
        <button id="btnRollback" class="btn-danger flex items-center gap-2 hidden">
          <i class="fas fa-undo"></i>
          <span>রোলব্যাক করুন</span>
        </button>
      </div>

      <!-- Progress Bar -->
      <div id="progressContainer" class="hidden">
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300">প্রগতি</span>
            <span id="progressText" class="text-sm font-medium text-indigo-600 dark:text-indigo-400">0%</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div id="progressBar" class="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
        </div>
      </div>

      <!-- Issues List -->
      <div id="issuesContainer" class="hidden">
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden">
          <!-- Header with action buttons -->
          <div class="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-200">সমস্যা তালিকা</h2>
              <div class="flex flex-wrap gap-2">
                <button id="btnApproveAll" class="text-xs px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium">
                  ✓ সব অনুমোদন
                </button>
                <button id="btnSkipAll" class="text-xs px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200">
                  ✗ সব বাদ
                </button>
                <button id="btnResetAll" class="text-xs px-3 py-1.5 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">
                  ↺ রিসেট
                </button>
              </div>
            </div>
          </div>
          
          <!-- Bulk Selection Toolbar -->
          <div class="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800">
            <p class="text-xs text-indigo-700 dark:text-indigo-300 mb-2 font-medium">
              <i class="fas fa-magic mr-1"></i> সবার জন্য একসাথে সিলেক্ট করুন:
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex items-center gap-2">
                <label class="text-xs text-slate-600 dark:text-slate-400">ক্লাস:</label>
                <select id="bulkClassSelect" class="text-sm px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  <option value="">নির্বাচন করুন</option>
                </select>
              </div>
              <div class="flex items-center gap-2">
                <label class="text-xs text-slate-600 dark:text-slate-400">শাখা:</label>
                <select id="bulkSectionSelect" class="text-sm px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  <option value="">নির্বাচন করুন</option>
                </select>
              </div>
              <div class="flex items-center gap-2">
                <label class="text-xs text-slate-600 dark:text-slate-400">বিষয়:</label>
                <select id="bulkSubjectSelect" class="text-sm px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  <option value="">নির্বাচন করুন</option>
                </select>
              </div>
              <button id="btnApplyBulk" class="text-sm px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                <i class="fas fa-check-double mr-1"></i> সবার জন্য প্রয়োগ
              </button>
            </div>
          </div>
          
          <div id="issuesList" class="divide-y divide-slate-200 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
            <!-- Issues will be populated here -->
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div id="emptyState" class="text-center py-12">
        <i class="fas fa-info-circle text-6xl text-slate-300 dark:text-slate-600 mb-4"></i>
        <p class="text-slate-500 dark:text-slate-400">ডেটাবেজ স্ক্যান করুন সমস্যা খুঁজে পেতে</p>
      </div>
    </div>
  `;
}

function _cacheElements() {
  elements.statusOverview = document.getElementById('statusOverview');
  elements.btnScanDatabase = document.getElementById('btnScanDatabase');
  elements.btnStartMigration = document.getElementById('btnStartMigration');
  elements.btnRollback = document.getElementById('btnRollback');
  elements.btnApproveAll = document.getElementById('btnApproveAll');
  elements.btnSkipAll = document.getElementById('btnSkipAll');
  elements.btnResetAll = document.getElementById('btnResetAll');
  elements.bulkClassSelect = document.getElementById('bulkClassSelect');
  elements.bulkSectionSelect = document.getElementById('bulkSectionSelect');
  elements.bulkSubjectSelect = document.getElementById('bulkSubjectSelect');
  elements.btnApplyBulk = document.getElementById('btnApplyBulk');
  elements.progressContainer = document.getElementById('progressContainer');
  elements.progressBar = document.getElementById('progressBar');
  elements.progressText = document.getElementById('progressText');
  elements.issuesContainer = document.getElementById('issuesContainer');
  elements.issuesList = document.getElementById('issuesList');
  elements.emptyState = document.getElementById('emptyState');
}

function _attachListeners() {
  elements.btnScanDatabase?.addEventListener('click', _handleScan);
  elements.btnStartMigration?.addEventListener('click', _handleStartMigration);
  elements.btnRollback?.addEventListener('click', _handleRollback);
  elements.btnApproveAll?.addEventListener('click', _handleApproveAll);
  elements.btnSkipAll?.addEventListener('click', _handleSkipAll);
  elements.btnResetAll?.addEventListener('click', _handleResetAll);
  elements.btnApplyBulk?.addEventListener('click', _handleApplyBulk);
}

async function _handleScan() {
  if (migrationState.scanning) return;
  
  migrationState.scanning = true;
  elements.btnScanDatabase.disabled = true;
  elements.btnScanDatabase.innerHTML = '<i class="fas fa-spinner fa-spin"></i> স্ক্যান করা হচ্ছে...';
  
  try {
    await _scanDatabase();
    _renderStatusOverview();
    _renderIssuesList();
    
    if (migrationState.issues.length > 0) {
      elements.emptyState.classList.add('hidden');
      elements.issuesContainer.classList.remove('hidden');
      elements.btnStartMigration.classList.remove('hidden');
      _populateBulkSelects(); // Populate bulk selection dropdowns
    } else {
      uiManager.showToast('কোনো সমস্যা পাওয়া যায়নি! সব ডেটা আপডেট করা আছে।', 'success');
    }
  } catch (error) {
    console.error('Scan error:', error);
    uiManager.showToast('স্ক্যান করতে ত্রুটি হয়েছে: ' + error.message, 'error');
  } finally {
    migrationState.scanning = false;
    elements.btnScanDatabase.disabled = false;
    elements.btnScanDatabase.innerHTML = '<i class="fas fa-search"></i> পুনরায় স্ক্যান করুন';
  }
}

async function _scanDatabase() {
  console.log('🔍 Scanning database for migration issues...');
  
  const evaluations = stateManager.get('evaluations') || [];
  const tasks = stateManager.get('tasks') || [];
  const groups = stateManager.get('groups') || [];
  const subjects = stateManager.get('subjects') || [];
  
  migrationState.issues = [];
  
  // Debug: Log data counts and sample structures
  console.log('📊 Scan data counts:', { 
    evaluations: evaluations.length, 
    tasks: tasks.length, 
    groups: groups.length, 
    subjects: subjects.length 
  });
  if (subjects.length > 0) {
    console.log('📊 Sample subject:', subjects[0]);
    console.log('📊 Subject classId check:', subjects.map(s => ({ name: s.name, classId: s.classId, sectionId: s.sectionId })));
  }
  
  // Debug: Log first evaluation to see structure
  if (evaluations.length > 0) {
    console.log('🔍 Sample evaluation structure:', evaluations[0]);
    console.log('🔍 Evaluation keys:', Object.keys(evaluations[0]));
  }
  
  // Scan evaluations for missing classId/sectionId
  // NOTE: Evaluations are linked to GROUPS, not directly to students!
  // Class/section should be fetched from the GROUP, not student
  for (const evaluation of evaluations) {
    if (!evaluation.classId || !evaluation.sectionId) {
      // Find the group this evaluation belongs to
      const group = groups.find(g => g.id === evaluation.groupId);
      
      const issue = {
        id: `eval-${evaluation.id}`,
        type: 'evaluation',
        documentId: evaluation.id,
        missing: [],
        current: evaluation,
        suggested: {},
        source: 'group-data',
        status: 'pending',
        confidence: 0
      };
      
      if (!evaluation.classId) issue.missing.push('classId');
      if (!evaluation.sectionId) issue.missing.push('sectionId');
      
      if (group) {
        // Get class/section from the GROUP
        const groupClassId = group.classId || group.class_id || group.class;
        const groupSectionId = group.sectionId || group.section_id || group.section;
        
        if (groupClassId && !evaluation.classId) {
          issue.suggested.classId = groupClassId;
          issue.confidence += 0.5;
        }
        if (groupSectionId && !evaluation.sectionId) {
          issue.suggested.sectionId = groupSectionId;
          issue.confidence += 0.5;
        }
        issue.groupName = group.name || evaluation.groupName || 'Unknown Group';
        
        // Debug log if group has no class/section
        if (!groupClassId && !groupSectionId) {
          console.log('⚠️ Group has no class/section:', { 
            groupId: group.id, 
            groupName: group.name,
            groupFields: Object.keys(group) 
          });
        }
      } else {
        issue.confidence = 0;
        issue.error = 'Group not found';
        issue.groupName = evaluation.groupName || 'Unknown';
        console.log('⚠️ Group not found for evaluation:', evaluation.groupId);
      }
      
      migrationState.issues.push(issue);
    }
  }
  
  // Scan tasks for missing subjectId
  for (const task of tasks) {
    if (!task.subjectId) {
      const issue = {
        id: `task-${task.id}`,
        type: 'task',
        documentId: task.id,
        missing: ['subjectId'],
        current: task,
        suggested: {},
        source: 'name-analysis',
        status: 'pending',
        confidence: 0
      };
      
      // Try to suggest subject based on task name
      const suggestedSubject = _suggestSubjectFromName(task.name, subjects);
      if (suggestedSubject) {
        issue.suggested.subjectId = suggestedSubject.id;
        issue.suggested.subjectName = suggestedSubject.name;
        issue.confidence = 0.6; // Medium confidence
      }
      
      migrationState.issues.push(issue);
    }
  }
  
  // Scan GROUPS for missing classId/sectionId
  for (const group of groups) {
    if (!group.classId || !group.sectionId) {
      const issue = {
        id: `group-${group.id}`,
        type: 'group',
        documentId: group.id,
        missing: [],
        current: group,
        suggested: {},
        source: 'manual-input',
        status: 'pending',
        confidence: 0,
        groupName: group.name || 'Unknown Group'
      };
      
      if (!group.classId) issue.missing.push('classId');
      if (!group.sectionId) issue.missing.push('sectionId');
      
      migrationState.issues.push(issue);
    }
  }
  
  // Scan SUBJECTS for missing classId/sectionId (only show if MISSING)
  for (const subject of subjects) {
    // Skip subjects that already have BOTH classId AND sectionId
    if (subject.classId && subject.sectionId) {
      continue;
    }
    
    const issue = {
      id: `subject-${subject.id}`,
      type: 'subject',
      documentId: subject.id,
      missing: [],
      current: subject,
      suggested: {
        classId: subject.classId || '',
        sectionId: subject.sectionId || ''
      },
      source: 'manual-input',
      status: 'pending',
      confidence: 0,
      subjectName: subject.name || 'Unknown Subject'
    };
    
    if (!subject.classId) issue.missing.push('classId');
    if (!subject.sectionId) issue.missing.push('sectionId');
    
    migrationState.issues.push(issue);
  }
  
  console.log(`✅ Scan complete. Found ${migrationState.issues.length} issues.`);
}

function _suggestSubjectFromName(taskName, subjects) {
  if (!taskName) return null;
  
  const nameLower = taskName.toLowerCase();
  
  // Simple keyword matching
  for (const subject of subjects) {
    const subjectLower = subject.name.toLowerCase();
    if (nameLower.includes(subjectLower) || subjectLower.includes(nameLower)) {
      return subject;
    }
  }
  
  return null;
}

function _calculateConfidence(issue) {
  let confidence = 0;
  
  if (issue.type === 'evaluation' || issue.type === 'group' || issue.type === 'subject') {
    if (issue.suggested.classId) confidence += 0.5;
    if (issue.suggested.sectionId) confidence += 0.5;
  } else if (issue.type === 'task') {
    if (issue.suggested.subjectId) confidence = 1.0;
  }
  
  return confidence;
}

function _renderStatusOverview() {
  const totalIssues = migrationState.issues.length;
  const evaluationIssues = migrationState.issues.filter(i => i.type === 'evaluation').length;
  const taskIssues = migrationState.issues.filter(i => i.type === 'task').length;
  const groupIssues = migrationState.issues.filter(i => i.type === 'group').length;
  const subjectIssues = migrationState.issues.filter(i => i.type === 'subject').length;
  
  elements.statusOverview.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <i class="fas fa-clipboard-list text-indigo-600 dark:text-indigo-400"></i>
        </div>
        <div>
          <p class="text-2xl font-bold text-slate-800 dark:text-slate-200">${totalIssues}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">মোট সমস্যা</p>
        </div>
      </div>
    </div>
    
    <div class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <i class="fas fa-star text-amber-600 dark:text-amber-400"></i>
        </div>
        <div>
          <p class="text-2xl font-bold text-slate-800 dark:text-slate-200">${evaluationIssues}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">মূল্যায়ন</p>
        </div>
      </div>
    </div>
    
    <div class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <i class="fas fa-tasks text-emerald-600 dark:text-emerald-400"></i>
        </div>
        <div>
          <p class="text-2xl font-bold text-slate-800 dark:text-slate-200">${taskIssues}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">টাস্ক</p>
        </div>
      </div>
    </div>
    
    <div class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <i class="fas fa-users text-blue-600 dark:text-blue-400"></i>
        </div>
        <div>
          <p class="text-2xl font-bold text-slate-800 dark:text-slate-200">${groupIssues}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">গ্রুপ</p>
        </div>
      </div>
    </div>
    
    <div class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <i class="fas fa-book text-purple-600 dark:text-purple-400"></i>
        </div>
        <div>
          <p class="text-2xl font-bold text-slate-800 dark:text-slate-200">${subjectIssues}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">বিষয়</p>
        </div>
      </div>
    </div>
  `;
}

function _renderIssuesList() {
  if (migrationState.issues.length === 0) {
    elements.issuesList.innerHTML = '<p class="p-4 text-center text-slate-500">কোনো সমস্যা নেই</p>';
    return;
  }
  
  elements.issuesList.innerHTML = migrationState.issues.map(issue => _renderIssueCard(issue)).join('');
  
  // Attach listeners to issue action buttons
  elements.issuesList.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.currentTarget.dataset.action;
      const issueId = e.currentTarget.dataset.issueId;
      _handleIssueAction(action, issueId);
    });
  });
  
  // Attach listeners to dropdown selectors
  elements.issuesList.querySelectorAll('select[data-issue-id]').forEach(select => {
    select.addEventListener('change', (e) => {
      const issueId = e.target.dataset.issueId;
      const field = e.target.dataset.field;
      const value = e.target.value;
      
      // Find the issue and update its suggested value
      const issue = migrationState.issues.find(i => i.id === issueId);
      if (issue) {
        issue.suggested[field] = value || null;
        issue.confidence = _calculateConfidence(issue);
        console.log(`📝 Updated ${issueId}.suggested.${field} = ${value}`);
        
        // Cascading: If classId changed, filter section dropdown for this issue
        if (field === 'classId') {
          _filterIssueSectionDropdown(issueId, value);
        }
      }
    });
  });
}

function _renderIssueCard(issue) {
  const confidenceStars = '⭐'.repeat(Math.ceil(issue.confidence * 3));
  const confidenceColor = issue.confidence >= 0.9 ? 'text-green-600' : issue.confidence >= 0.7 ? 'text-yellow-600' : 'text-red-600';
  
  const isApproved = migrationState.approved.includes(issue.id);
  const isSkipped = migrationState.skipped.includes(issue.id);
  
  let statusBadge = '';
  if (isApproved) {
    statusBadge = '<span class="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">✓ অনুমোদিত</span>';
  } else if (isSkipped) {
    statusBadge = '<span class="text-xs px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">✗ বাদ দেওয়া</span>';
  }
  
  const classes = stateManager.get('classes') || [];
  const sections = stateManager.get('sections') || [];
  const subjects = stateManager.get('subjects') || [];
  
  // Build dropdown options based on issue type
  let selectionHTML = '';
  
  // Class/Section dropdown for evaluation, group, subject types
  if (issue.type === 'evaluation' || issue.type === 'group' || issue.type === 'subject') {
    const classOptions = classes.map(c => 
      `<option value="${c.id}" ${issue.suggested.classId === c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');
    
    const sectionOptions = sections.map(s => 
      `<option value="${s.id}" ${issue.suggested.sectionId === s.id ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    
    selectionHTML = `
      <div class="flex flex-wrap gap-2 mt-2">
        <div class="flex items-center gap-1">
          <label class="text-xs text-slate-500 dark:text-slate-400">ক্লাস:</label>
          <select data-issue-id="${issue.id}" data-field="classId" 
            class="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
            <option value="">নির্বাচন করুন</option>
            ${classOptions}
          </select>
        </div>
        <div class="flex items-center gap-1">
          <label class="text-xs text-slate-500 dark:text-slate-400">শাখা:</label>
          <select data-issue-id="${issue.id}" data-field="sectionId" 
            class="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
            <option value="">নির্বাচন করুন</option>
            ${sectionOptions}
          </select>
        </div>
      </div>
    `;
  } else if (issue.type === 'task') {
    // Subject dropdown for tasks
    const subjectOptions = subjects.map(s => 
      `<option value="${s.id}" ${issue.suggested.subjectId === s.id ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    
    selectionHTML = `
      <div class="flex items-center gap-2 mt-2">
        <label class="text-xs text-slate-500 dark:text-slate-400">বিষয়:</label>
        <select data-issue-id="${issue.id}" data-field="subjectId" 
          class="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
          <option value="">নির্বাচন করুন</option>
          ${subjectOptions}
        </select>
      </div>
    `;
  }
  
  // Determine badge color and label based on type
  const typeConfig = {
    evaluation: { bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'মূল্যায়ন' },
    task: { bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'টাস্ক' },
    group: { bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'গ্রুপ' },
    subject: { bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', label: 'বিষয়' }
  };
  const typeInfo = typeConfig[issue.type] || typeConfig.evaluation;
  
  // Determine display name based on type
  let displayName = '';
  if (issue.type === 'evaluation') {
    displayName = `গ্রুপ: ${issue.groupName || 'Unknown'}`;
  } else if (issue.type === 'task') {
    displayName = `টাস্ক: ${issue.current.name || 'Unnamed'}`;
  } else if (issue.type === 'group') {
    displayName = `গ্রুপ: ${issue.groupName || issue.current.name || 'Unknown'}`;
  } else if (issue.type === 'subject') {
    displayName = `বিষয়: ${issue.subjectName || issue.current.name || 'Unknown'}`;
  }
  
  return `
    <div class="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-200 dark:border-slate-700 ${isApproved || isSkipped ? 'opacity-60' : ''}">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs px-2 py-1 rounded ${typeInfo.bg}">
              ${typeInfo.label}
            </span>
            <span class="text-xs ${confidenceColor}">${confidenceStars || '⚪'}</span>
            ${statusBadge}
          </div>
          
          <p class="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
            ${displayName}
          </p>
          
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-1">
            অনুপস্থিত: <span class="text-red-500">${issue.missing.join(', ')}</span>
          </p>
          
          ${selectionHTML}
        </div>
        
        <div class="flex flex-col gap-2">
          ${!isApproved && !isSkipped ? `
            <button data-action="approve" data-issue-id="${issue.id}" class="px-3 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 font-medium">
              ✓ অনুমোদন
            </button>
            <button data-action="skip" data-issue-id="${issue.id}" class="px-3 py-1.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50">
              ✗ বাদ
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function _handleIssueAction(action, issueId) {
  if (action === 'approve') {
    if (!migrationState.approved.includes(issueId)) {
      migrationState.approved.push(issueId);
      migrationState.skipped = migrationState.skipped.filter(id => id !== issueId);
    }
  } else if (action === 'skip') {
    if (!migrationState.skipped.includes(issueId)) {
      migrationState.skipped.push(issueId);
      migrationState.approved = migrationState.approved.filter(id => id !== issueId);
    }
  }
  
  _renderIssuesList();
}

function _handleApproveAll() {
  migrationState.approved = migrationState.issues.map(i => i.id);
  migrationState.skipped = [];
  _renderIssuesList();
}

function _handleSkipAll() {
  migrationState.skipped = migrationState.issues.map(i => i.id);
  migrationState.approved = [];
  _renderIssuesList();
}

function _handleResetAll() {
  // Reset all selections
  migrationState.approved = [];
  migrationState.skipped = [];
  
  // Reset all suggestions to empty
  migrationState.issues.forEach(issue => {
    issue.suggested = {};
    issue.confidence = 0;
  });
  
  // Reset bulk select dropdowns
  if (elements.bulkClassSelect) elements.bulkClassSelect.value = '';
  if (elements.bulkSectionSelect) elements.bulkSectionSelect.value = '';
  if (elements.bulkSubjectSelect) elements.bulkSubjectSelect.value = '';
  
  _renderIssuesList();
  uiManager.showToast('সব সিলেকশন রিসেট করা হয়েছে', 'info');
}

function _handleApplyBulk() {
  const bulkClassId = elements.bulkClassSelect?.value || null;
  const bulkSectionId = elements.bulkSectionSelect?.value || null;
  const bulkSubjectId = elements.bulkSubjectSelect?.value || null;
  
  if (!bulkClassId && !bulkSectionId && !bulkSubjectId) {
    uiManager.showToast('অনুগ্রহ করে কমপক্ষে একটি মান সিলেক্ট করুন', 'warning');
    return;
  }
  
  let updatedCount = 0;
  
  migrationState.issues.forEach(issue => {
    if (issue.type === 'evaluation') {
      if (bulkClassId && issue.missing.includes('classId')) {
        issue.suggested.classId = bulkClassId;
        updatedCount++;
      }
      if (bulkSectionId && issue.missing.includes('sectionId')) {
        issue.suggested.sectionId = bulkSectionId;
        updatedCount++;
      }
    } else if (issue.type === 'task') {
      if (bulkSubjectId && issue.missing.includes('subjectId')) {
        issue.suggested.subjectId = bulkSubjectId;
        updatedCount++;
      }
    }
    
    // Recalculate confidence
    issue.confidence = _calculateConfidence(issue);
  });
  
  _renderIssuesList();
  uiManager.showToast(`${updatedCount}টি ফিল্ড আপডেট করা হয়েছে`, 'success');
}

function _populateBulkSelects() {
  const classes = stateManager.get('classes') || [];
  const sections = stateManager.get('sections') || [];
  const subjects = stateManager.get('subjects') || [];
  
  // Populate class dropdown
  if (elements.bulkClassSelect) {
    const classOptions = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    elements.bulkClassSelect.innerHTML = `<option value="">ক্লাস নির্বাচন</option>${classOptions}`;
    
    // Add change listener for cascading filter
    elements.bulkClassSelect.removeEventListener('change', _handleBulkClassChange);
    elements.bulkClassSelect.addEventListener('change', _handleBulkClassChange);
  }
  
  // Initially populate all sections and subjects
  _updateBulkSectionOptions();
  _updateBulkSubjectOptions();
}

function _handleBulkClassChange() {
  _updateBulkSectionOptions();
  _updateBulkSubjectOptions();
}

function _updateBulkSectionOptions() {
  const sections = stateManager.get('sections') || [];
  const selectedClassId = elements.bulkClassSelect?.value || '';
  
  if (!elements.bulkSectionSelect) return;
  
  let filteredSections = sections;
  
  // Filter sections by classId if a class is selected
  if (selectedClassId) {
    filteredSections = sections.filter(s => 
      s.classId === selectedClassId || 
      s.class_id === selectedClassId ||
      s.class === selectedClassId
    );
  }
  
  // Remove duplicates by name
  const uniqueSections = [];
  const seenNames = new Set();
  filteredSections.forEach(s => {
    if (!seenNames.has(s.name)) {
      seenNames.add(s.name);
      uniqueSections.push(s);
    }
  });
  
  const sectionOptions = uniqueSections.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  elements.bulkSectionSelect.innerHTML = `<option value="">শাখা নির্বাচন</option>${sectionOptions}`;
}

function _updateBulkSubjectOptions() {
  const subjects = stateManager.get('subjects') || [];
  const selectedClassId = elements.bulkClassSelect?.value || '';
  
  if (!elements.bulkSubjectSelect) return;
  
  let filteredSubjects = subjects;
  
  // Filter subjects by classId if a class is selected
  if (selectedClassId) {
    filteredSubjects = subjects.filter(s => 
      s.classId === selectedClassId || 
      s.class_id === selectedClassId ||
      s.class === selectedClassId ||
      !s.classId // Include subjects without classId (general subjects)
    );
  }
  
  // Remove duplicates by name
  const uniqueSubjects = [];
  const seenNames = new Set();
  filteredSubjects.forEach(s => {
    if (!seenNames.has(s.name)) {
      seenNames.add(s.name);
      uniqueSubjects.push(s);
    }
  });
  
  const subjectOptions = uniqueSubjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  elements.bulkSubjectSelect.innerHTML = `<option value="">বিষয় নির্বাচন</option>${subjectOptions}`;
}

// Cascading filter: Update section dropdown for a specific issue based on selected classId
function _filterIssueSectionDropdown(issueId, selectedClassId) {
  const sections = stateManager.get('sections') || [];
  const sectionSelect = elements.issuesList.querySelector(
    `select[data-issue-id="${issueId}"][data-field="sectionId"]`
  );
  
  if (!sectionSelect) return;
  
  // Get current selected value to preserve it if still valid
  const currentValue = sectionSelect.value;
  const issue = migrationState.issues.find(i => i.id === issueId);
  
  // Filter sections by classId
  let filteredSections = sections;
  if (selectedClassId) {
    filteredSections = sections.filter(s => 
      s.classId === selectedClassId || 
      s.class_id === selectedClassId ||
      s.class === selectedClassId
    );
  }
  
  // Generate options
  const options = filteredSections.map(s => 
    `<option value="${s.id}" ${currentValue === s.id ? 'selected' : ''}>${s.name}</option>`
  ).join('');
  
  sectionSelect.innerHTML = `<option value="">নির্বাচন করুন</option>${options}`;
  
  // Update issue suggested value if current value is not in filtered list
  const isCurrentValueValid = filteredSections.some(s => s.id === currentValue);
  if (!isCurrentValueValid && issue) {
    issue.suggested.sectionId = null;
    sectionSelect.value = '';
  }
  
  console.log(`🔗 Filtered sections for ${issueId}: ${filteredSections.length} options`);
}

async function _handleStartMigration() {
  const approvedCount = migrationState.approved.length;
  
  if (approvedCount === 0) {
    uiManager.showToast('কোনো পরিবর্তন অনুমোদন করা হয়নি।', 'warning');
    return;
  }
  
  const confirmed = await _showConfirmDialog(
    'মাইগ্রেশন নিশ্চিত করুন',
    `আপনি ${approvedCount}টি পরিবর্তন আপডেট করতে চলেছেন। এটি ডেটাবেজ আপডেট করবে। নিশ্চিত?`
  );
  
  if (!confirmed) return;
  
  await _executeMigration();
}

async function _executeMigration() {
  migrationState.migrating = true;
  elements.progressContainer.classList.remove('hidden');
  elements.btnStartMigration.disabled = true;
  
  const approvedIssues = migrationState.issues.filter(i => migrationState.approved.includes(i.id));
  const total = approvedIssues.length;
  let completed = 0;
  
  try {
    for (const issue of approvedIssues) {
      await _updateDocument(issue);
      completed++;
      
      const progress = Math.round((completed / total) * 100);
      elements.progressBar.style.width = `${progress}%`;
      elements.progressText.textContent = `${progress}%`;
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    uiManager.showToast(`✅ ${completed}টি ডেটা সফলভাবে আপডেট হয়েছে!`, 'success');
    
    // Update local stateManager with migrated values
    const subjects = stateManager.get('subjects') || [];
    for (const issue of approvedIssues) {
      if (issue.type === 'subject') {
        const subjectIndex = subjects.findIndex(s => s.id === issue.documentId);
        if (subjectIndex !== -1) {
          if (issue.suggested.classId) subjects[subjectIndex].classId = issue.suggested.classId;
          if (issue.suggested.sectionId) subjects[subjectIndex].sectionId = issue.suggested.sectionId;
        }
      }
    }
    stateManager.set('subjects', subjects);
    
    // Reset and re-scan
    setTimeout(() => {
      migrationState.approved = [];
      migrationState.skipped = [];
      _handleScan();
    }, 1000);
    
  } catch (error) {
    console.error('Migration error:', error);
    uiManager.showToast('মাইগ্রেশন ত্রুটি: ' + error.message, 'error');
  } finally {
    migrationState.migrating = false;
    elements.btnStartMigration.disabled = false;
    setTimeout(() => {
      elements.progressContainer.classList.add('hidden');
      elements.progressBar.style.width = '0%';
      elements.progressText.textContent = '0%';
    }, 2000);
  }
}

async function _updateDocument(issue) {
  const updates = {};
  
  if (issue.suggested.classId) updates.classId = issue.suggested.classId;
  if (issue.suggested.sectionId) updates.sectionId = issue.suggested.sectionId;
  if (issue.suggested.subjectId) updates.subjectId = issue.suggested.subjectId;
  
  console.log(`Updating ${issue.type}/${issue.documentId}:`, updates);
  
  // Use correct dataService methods based on issue type
  if (issue.type === 'evaluation') {
    await dataService.updateEvaluation(issue.documentId, updates);
  } else if (issue.type === 'task') {
    await dataService.updateTask(issue.documentId, updates);
  } else if (issue.type === 'group') {
    await dataService.updateGroup(issue.documentId, updates);
  } else if (issue.type === 'subject') {
    await dataService.updateSubject(issue.documentId, updates);
  }
}

function _showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    const confirmed = confirm(`${title}\n\n${message}`);
    resolve(confirmed);
  });
}

function _handleRollback() {
  uiManager.showNotification('রোলব্যাক ফিচার শীঘ্রই আসছে...', 'info');
}

export default { init, render };
