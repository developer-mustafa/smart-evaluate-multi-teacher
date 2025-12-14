// js/components/student-filter.js
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { generateStudentListPDF } from '../utils/pdf-generator.js';

// Register the plugin
Chart.register(ChartDataLabels);

let stateManager, uiManager, dataService, helpers, app;
let currentFilteredStudents = []; // Store filtered students for printing

const elements = {
  page: null,
  container: null,
};

// --- Filter State ---
let activeFilters = {
  group: 'all',
  academicGroup: 'all',
  session: 'all',
  gender: 'all',
  role: 'all',
  assignment: 'all', // 'all' or specific task ID
  extra: [], // Array of selected extra filter IDs
};

const EXTRA_FILTERS = [
  { id: 'topic_none', text: 'এখনো এই টাস্ক পারিনা (-৫)', type: 'topic' },
  { id: 'topic_understood', text: 'শুধু বুঝেছি (+৫)', type: 'topic' },
  { id: 'topic_learned_well', text: 'ভালো করে শিখেছি (+১০)', type: 'topic' },
  { id: 'homework_done', text: 'সপ্তাহে প্রতিদিন বাড়ির কাজ করেছি (+৫)', type: 'option' },
  { id: 'attendance_regular', text: 'সাপ্তাহিক নিয়মিত উপস্থিতি (+১০)', type: 'option' },
];

export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  dataService = dependencies.services.dataService;
  helpers = dependencies.utils;
  app = dependencies.app;

  _cacheDOMElements();
  
  // Trigger data loading in background
  _ensureDataLoaded();

  console.log('✅ Student Filter component initialized.');
  return { render };
}

async function _ensureDataLoaded() {
  try {
      await Promise.all([
          dataService.loadStudents(),
          dataService.loadGroups(),
          dataService.loadEvaluations(),
          dataService.loadTasks()
      ]);
      console.log('✅ Student Filter data loaded.');
      // Re-render to show data that might have been missing (only if page is rendered)
      if (elements.container) {
        _applyFiltersAndRender();
      }
  } catch (error) {
      console.error('Failed to load data for Student Filter:', error);
  }
}

function _cacheDOMElements() {
  elements.page = document.getElementById('page-student-filter');
  if (elements.page) {
    elements.container = elements.page.querySelector('#studentFilterContainer');
  }
}

export function render() {
  if (!elements.page || !elements.container) return;
  console.log('Rendering Student Filter page...');
  
  // Professional Top-Bar Layout
  elements.container.innerHTML = `
    <div class="space-y-6">
      <!-- Top Filter Panel -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 transition-all duration-300 hover:shadow-md">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
          <h3 class="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
            ফিল্টার অপশন
          </h3>
          <div class="flex items-center gap-2 mt-2 md:mt-0">
             <button id="sfRefreshBtn" class="text-xs font-medium text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors flex items-center gap-1">
              <i class="fas fa-sync-alt"></i> রিফ্রেশ
            </button>
            <button id="sfResetBtn" class="text-xs font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors flex items-center gap-1">
              রিসেট
            </button>
          </div>
        </div>
        
        <!-- Primary Filters Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
          <!-- Group -->
          <div class="relative">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">গ্রুপ</label>
            <div class="relative">
               <select id="sfGroup" class="w-full form-select rounded-lg border-gray-200 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                <option value="all">সকল গ্রুপ</option>
              </select>
            </div>
          </div>

          <!-- Academic Group -->
          <div class="relative">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">একাডেমিক গ্রুপ</label>
            <div class="relative">
               <select id="sfAcademic" class="w-full form-select rounded-lg border-gray-200 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
                <option value="all">সকল</option>
              </select>
            </div>

          </div>

           <!-- Session -->
          <div class="relative">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">সেশন</label>
            <div class="relative">
               <select id="sfSession" class="w-full form-select rounded-lg border-gray-200 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all">
                <option value="all">সকল</option>
              </select>
            </div>
          </div>

          <!-- Gender -->
          <div class="relative">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">লিঙ্গ</label>
            <div class="relative">
               <select id="sfGender" class="w-full form-select rounded-lg border-gray-200 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 text-sm focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all">
                <option value="all">সকল</option>
                <option value="ছেলে">ছেলে</option>
                <option value="মেয়ে">মেয়ে</option>
              </select>
            </div>
          </div>

          <!-- Role -->
           <div class="relative">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">দায়িত্ব</label>
            <div class="relative">
               <select id="sfRole" class="w-full form-select rounded-lg border-gray-200 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all">
                <option value="all">সকল</option>
                <option value="team-leader">টিম লিডার</option>
                <option value="time-keeper">টাইম কিপার</option>
                <option value="reporter">রিপোর্টার</option>
                <option value="resource-manager">রিসোর্স ম্যানেজার</option>
                <option value="peace-maker">পিস মেকার</option>
              </select>
            </div>
          </div>

           <!-- Assignment (Target Assignment) -->
          <div class="relative">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">এসাইনমেন্ট</label>
             <div class="relative">
               <select id="sfAssignment" class="w-full form-select rounded-lg border-gray-200 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all">
                <option value="all">গড় ফলাফল (সকল)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Extra Filters (Chips Layout) -->
        <div class="pt-4 border-t border-gray-100 dark:border-gray-700">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">অতিরিক্ত মূল্যায়ন ফিল্টার</label>
          <div class="flex flex-wrap gap-2">
            ${EXTRA_FILTERS.map(f => `
              <label class="group relative cursor-pointer select-none">
                <input type="checkbox" value="${f.id}" class="peer sr-only sf-extra-check">
                <div class="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs font-medium transition-all peer-checked:bg-blue-50 peer-checked:text-blue-600 peer-checked:border-blue-200 dark:peer-checked:bg-blue-900/30 dark:peer-checked:text-blue-300 dark:peer-checked:border-blue-700/50 hover:bg-gray-100 dark:hover:bg-gray-700">
                  ${f.text}
                </div>
              </label>
            `).join('')}
             <label class="group relative cursor-pointer select-none">
                <input type="checkbox" value="unevaluated" class="peer sr-only sf-extra-check">
                <div class="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs font-medium transition-all peer-checked:bg-amber-50 peer-checked:text-amber-600 peer-checked:border-amber-200 dark:peer-checked:bg-amber-900/30 dark:peer-checked:text-amber-300 dark:peer-checked:border-amber-700/50 hover:bg-gray-100 dark:hover:bg-gray-700">
                  অমূল্যায়িত শিক্ষার্থী
                </div>
              </label>
             
              <label class="group relative cursor-pointer select-none">
                <input type="checkbox" value="absent_mcq" class="peer sr-only sf-extra-check">
                <div class="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs font-medium transition-all peer-checked:bg-rose-50 peer-checked:text-rose-600 peer-checked:border-rose-200 dark:peer-checked:bg-rose-900/30 dark:peer-checked:text-rose-300 dark:peer-checked:border-rose-700/50 hover:bg-gray-100 dark:hover:bg-gray-700">
                  MCQ নম্বর নেই
                </div>
              </label>
          </div>
        </div>
      </div>

      <!-- Main Content (Table & Chart) -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <div class="flex items-center gap-2">
              <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <i class="fas fa-list-ul"></i>
              </span>
              <h3 class="font-bold text-gray-800 dark:text-gray-200" id="sfResultCount">ফলাফল: ...</h3>
            </div>
            
             <!-- Color Legend (Header) -->
            <div id="sfChartLegend" class="hidden flex-wrap gap-2 sm:ml-2">
              <span class="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-600 shadow-sm">
                <span class="w-2 h-2 rounded-full bg-purple-400"></span> বিজ্ঞান
              </span>
              <span class="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-600 shadow-sm">
                <span class="w-2 h-2 rounded-full bg-orange-400"></span> মানবিক
              </span>
              <span class="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-600 shadow-sm">
                <span class="w-2 h-2 rounded-full bg-blue-400"></span> ব্যবসায়
              </span>
            </div>
          </div>
          
          <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
             <!-- View Toggle -->
            <div class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button id="sfViewTable" class="px-3 py-1.5 rounded-md text-xs font-bold bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white transition-all flex items-center gap-1.5">
                <i class="fas fa-table"></i> টেবিল
              </button>
              <button id="sfViewChart" class="px-3 py-1.5 rounded-md text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all flex items-center gap-1.5">
                <i class="fas fa-chart-bar"></i> চার্ট
              </button>
            </div>

            <button id="sfPrintBtn" class="btn btn-sm btn-primary shadow-sm flex items-center gap-2">
              <i class="fas fa-print"></i> প্রিন্ট লিস্ট
            </button>
          </div>
        </div>

        <!-- Table View -->
        <div id="sfTableContainer" class="overflow-x-auto transition-all duration-300">
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-900/30 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th class="px-6 py-3 font-semibold tracking-wider">#</th>
                <th class="px-6 py-3 font-semibold tracking-wider">নাম</th>
                <th class="px-6 py-3 font-semibold tracking-wider">রোল</th>
                <th class="px-6 py-3 font-semibold tracking-wider">লিঙ্গ</th>
                <th class="px-6 py-3 font-semibold tracking-wider">গ্রুপ</th>
                <th class="px-6 py-3 font-semibold tracking-wider">একাডেমিক গ্রুপ</th>
                <th class="px-6 py-3 font-semibold tracking-wider">সেশন</th>
                <th class="px-6 py-3 font-semibold tracking-wider">দায়িত্ব</th>
                <th class="px-6 py-3 font-semibold tracking-wider">যোগাযোগ</th>
                <th class="px-6 py-3 text-center font-semibold tracking-wider" id="sfScoreHeader">গড় ফলাফল</th>
              </tr>
            </thead>
            <tbody id="sfTableBody" class="divide-y divide-gray-100 dark:divide-gray-700/50">
              <!-- Rows will be injected here -->
            </tbody>
          </table>
        </div>

        <!-- Chart View -->
        <div id="sfChartContainer" class="hidden p-4 sm:p-6 w-full h-[500px] sm:h-[600px] bg-white dark:bg-gray-800 transition-all duration-300">
             <canvas id="sfChartCanvas"></canvas>
        </div>

        <div id="sfEmptyState" class="hidden py-12 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
          <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-full mb-3">
             <i class="fas fa-search text-3xl opacity-50"></i>
          </div>
          <p class="text-lg font-medium">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
          <p class="text-sm opacity-75">ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন</p>
        </div>
      </div>
    </div>
  `;

  _populateFilterOptions();
  _attachEventListeners();
  _applyFiltersAndRender();
}

function _populateFilterOptions() {
  const groups = stateManager.get('groups') || [];
  const students = stateManager.get('students') || [];
  const tasks = stateManager.get('tasks') || [];

  // Groups
  const groupSelect = document.getElementById('sfGroup');
  if (groupSelect) {
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      groupSelect.appendChild(opt);
    });
  }

  // Academic Groups (Unique)
  const academicSelect = document.getElementById('sfAcademic');
  if (academicSelect) {
    const academics = [...new Set(students.map(s => s.academicGroup).filter(Boolean))].sort();
    academics.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      academicSelect.appendChild(opt);
    });
  }

  // Sessions (Unique)
  const sessionSelect = document.getElementById('sfSession');
  if (sessionSelect) {
    const sessions = [...new Set(students.map(s => s.session).filter(Boolean))].sort();
    sessions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sessionSelect.appendChild(opt);
    });
  }

  // Assignments (Tasks)
  const assignSelect = document.getElementById('sfAssignment');
  if (assignSelect) {
    tasks.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    tasks.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      assignSelect.appendChild(opt);
    });
  }
}

function _attachEventListeners() {
  const container = elements.container;
  
  // View Toggle
  const btnTable = container.querySelector('#sfViewTable');
  const btnChart = container.querySelector('#sfViewChart');
  
  if (btnTable && btnChart) {
    btnTable.addEventListener('click', () => {
      activeFilters.viewMode = 'table';
      _updateViewToggleUI();
      _applyFiltersAndRender();
    });
    
    btnChart.addEventListener('click', () => {
      activeFilters.viewMode = 'chart';
      _updateViewToggleUI();
      _applyFiltersAndRender();
    });
  }

  // Selects
  ['sfGroup', 'sfAcademic', 'sfSession', 'sfGender', 'sfRole', 'sfAssignment'].forEach(id => {
    const el = container.querySelector(`#${id}`);
    if (el) {
      el.addEventListener('change', (e) => {
        const key = id.replace('sf', '');
        let stateKey = key.charAt(0).toLowerCase() + key.slice(1); // e.g. 'Group' -> 'group'
        
        // Fix for Academic Group key mismatch
        if (stateKey === 'academic') stateKey = 'academicGroup';

        activeFilters[stateKey] = e.target.value;
        _applyFiltersAndRender();
      });
    }
  });
  // Extra Filters (Checkboxes)
  const extraChecks = container.querySelectorAll('.sf-extra-check');
  extraChecks.forEach(chk => {
    chk.addEventListener('change', (e) => {
      if (e.target.checked) {
        activeFilters.extra.push(e.target.value);
      } else {
        activeFilters.extra = activeFilters.extra.filter(id => id !== e.target.value);
      }
      _applyFiltersAndRender();
    });
  });

  // Reset Button
  const resetBtn = container.querySelector('#sfResetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeFilters = {
        group: 'all',
        academicGroup: 'all',
        session: 'all',
        gender: 'all',
        role: 'all',
        assignment: 'all',
        extra: [],
        viewMode: activeFilters.viewMode || 'table' // Preserve view mode
      };
      
      // Reset UI controls
      ['sfGroup', 'sfAcademic', 'sfSession', 'sfGender', 'sfRole', 'sfAssignment'].forEach(id => {
        const el = container.querySelector(`#${id}`);
        if (el) el.value = 'all';
      });
      
      container.querySelectorAll('.sf-extra-check').forEach(chk => chk.checked = false);
      
      _applyFiltersAndRender();
    });
  }

  // Refresh Button
  const refreshBtn = container.querySelector('#sfRefreshBtn');
  if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
          _ensureDataLoaded();
      });
  }

  // Print Button
  const printBtn = container.querySelector('#sfPrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      if (currentFilteredStudents.length === 0) {
        uiManager.showToast('কোনো শিক্ষার্থী নেই প্রিন্ট করার জন্য', 'warning');
        return;
      }
      
      const evaluations = stateManager.get('evaluations') || [];
      const groups = stateManager.get('groups') || [];
      const tasks = stateManager.get('tasks') || [];
      
      const groupMap = new Map(groups.map(g => [g.id, g]));
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      
      // Prepare Extra Filter Map
      const extraMap = new Map(EXTRA_FILTERS.map(f => [f.id, f.text]));
      extraMap.set('unevaluated', 'অমূল্যায়িত শিক্ষার্থী');
      extraMap.set('absent_mcq', 'MCQ নম্বর নেই');

      generateStudentListPDF(currentFilteredStudents, activeFilters, evaluations, groupMap, extraMap, taskMap);
    });
  }
}

function _updateViewToggleUI() {
  const container = elements.container;
  const btnTable = container.querySelector('#sfViewTable');
  const btnChart = container.querySelector('#sfViewChart');
  const tableContainer = container.querySelector('#sfTableContainer');
  const chartContainer = container.querySelector('#sfChartContainer');
  const chartLegend = container.querySelector('#sfChartLegend');
  
  const isChart = activeFilters.viewMode === 'chart';
  
  // Update Buttons
  if (isChart) {
    btnTable.className = 'px-3 py-1.5 rounded-md text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all flex items-center gap-1.5';
    btnChart.className = 'px-3 py-1.5 rounded-md text-xs font-bold bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white transition-all flex items-center gap-1.5';
    
    tableContainer.classList.add('hidden');
    chartContainer.classList.remove('hidden');
    if (chartLegend) chartLegend.classList.remove('hidden');
    if (chartLegend) chartLegend.classList.add('flex');
  } else {
    btnTable.className = 'px-3 py-1.5 rounded-md text-xs font-bold bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white transition-all flex items-center gap-1.5';
    btnChart.className = 'px-3 py-1.5 rounded-md text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all flex items-center gap-1.5';
    
    tableContainer.classList.remove('hidden');
    chartContainer.classList.add('hidden');
    if (chartLegend) chartLegend.classList.add('hidden');
    if (chartLegend) chartLegend.classList.remove('flex');
  }
}

function _applyFiltersAndRender() {
  const students = stateManager.get('students') || [];
  const groups = stateManager.get('groups') || [];
  const evaluations = stateManager.get('evaluations') || [];
  const groupMap = new Map(groups.map(g => [g.id, g]));

  // 1. Filter
  const filtered = students.filter(s => {
    // Basic Filters
    if (activeFilters.group !== 'all' && s.groupId !== activeFilters.group) return false;
    if (activeFilters.academicGroup !== 'all' && (s.academicGroup || '').trim() !== activeFilters.academicGroup) return false;
    if (activeFilters.session !== 'all' && s.session !== activeFilters.session) return false;
    
    // Gender filter with Unicode normalization for Bengali text
    if (activeFilters.gender !== 'all') {
      const studentGender = (s.gender || '').trim().normalize('NFC');
      const filterGender = activeFilters.gender.trim().normalize('NFC');
      if (studentGender !== filterGender) return false;
    }
    
    if (activeFilters.role !== 'all' && s.role !== activeFilters.role) return false;

    // Flatten evaluations for this student
    // Evaluations are group-based, containing a 'scores' map
    const studentEvaluations = [];
    evaluations.forEach(evalDoc => {
        if (evalDoc.scores && evalDoc.scores[s.id]) {
            studentEvaluations.push({
                taskId: evalDoc.taskId,
                taskDate: evalDoc.taskDate,
                ...evalDoc.scores[s.id] // Contains totalScore, additionalCriteria, etc.
            });
        }
    });

    // Extra Filters
    if (activeFilters.extra.length > 0) {
      for (const filterId of activeFilters.extra) {
         if (filterId === 'unevaluated') {
             if (studentEvaluations.length > 0) return false;
         } else if (filterId === 'absent_task') {
             // Task Absent: Missing taskScore
             if (activeFilters.assignment !== 'all') {
                 const assignEval = studentEvaluations.find(e => e.taskId === activeFilters.assignment);
                 if (!assignEval || !assignEval.taskScore) return true; 
                 return false;
             } else {
                 if (studentEvaluations.length === 0) return true;
                 const hasMissing = studentEvaluations.some(e => !e.taskScore);
                 if (hasMissing) return true;
                 return false;
             }
         } else if (filterId === 'absent_mcq') {
             // MCQ Absent: Missing mcqScore
             if (activeFilters.assignment !== 'all') {
                 const assignEval = studentEvaluations.find(e => e.taskId === activeFilters.assignment);
                 if (!assignEval || !assignEval.mcqScore) return true; 
                 return false;
             } else {
                 if (studentEvaluations.length === 0) return true;
                 const hasMissing = studentEvaluations.some(e => !e.mcqScore);
                 if (hasMissing) return true;
                 return false;
             }
         } else {
             // Check for specific criteria in ANY evaluation
             const hasCriteria = studentEvaluations.some(e => {
                 const details = e.additionalCriteria || {};
                 
                 // Topic Check
                 if (filterId.startsWith('topic_')) {
                     return details.topic === filterId;
                 }
                 
                 // Homework Check
                 if (filterId === 'homework_done') {
                     return details.homework === true;
                 }
                 
                 // Attendance Check
                 if (filterId === 'attendance_regular') {
                     return details.attendance === true;
                 }

                 return false;
             });
             if (!hasCriteria) return false;
         }
      }
    }
    return true;
  });

  // Update global filtered list for print
  currentFilteredStudents = filtered;

  // 2. Render
  const tbody = elements.container.querySelector('#sfTableBody');
  const countEl = elements.container.querySelector('#sfResultCount');
  const emptyState = elements.container.querySelector('#sfEmptyState');
  const tableContainer = elements.container.querySelector('#sfTableContainer');
  const chartContainer = elements.container.querySelector('#sfChartContainer');

  if (countEl) countEl.textContent = `ফলাফল: ${helpers.convertToBanglaNumber(filtered.length)} জন`;

  if (filtered.length === 0) {
    if (tableContainer) tableContainer.classList.add('hidden');
    if (chartContainer) chartContainer.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  
  if (emptyState) emptyState.classList.add('hidden');

  // Handle View Mode
  if (activeFilters.viewMode === 'chart') {
      if (tableContainer) tableContainer.classList.add('hidden');
      if (chartContainer) chartContainer.classList.remove('hidden');
      _renderChart(filtered, evaluations);
      return; // Skip table rendering
  } else {
      if (tableContainer) tableContainer.classList.remove('hidden');
      if (chartContainer) chartContainer.classList.add('hidden');
      // Continue to table rendering...
  }

  if (tbody) tbody.innerHTML = '';

    // Update Header for Specific Assignment
    const thead = elements.container.querySelector('thead tr');
    let specificTh = thead.querySelector('#sfSpecificScoreHeader');
    
    if (activeFilters.assignment !== 'all') {
        if (!specificTh) {
            specificTh = document.createElement('th');
            specificTh.id = 'sfSpecificScoreHeader';
            specificTh.className = 'px-6 py-3 text-center font-semibold tracking-wider text-blue-600 dark:text-blue-400 whitespace-nowrap';
            specificTh.textContent = 'এসাইনমেন্ট নম্বর';
            thead.appendChild(specificTh);
        }
    } else {
        if (specificTh) specificTh.remove();
    }

    filtered.forEach((s, index) => {
      const tr = document.createElement('tr');
      tr.className = 'bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer';
      
      const groupName = groupMap.get(s.groupId)?.name || '-';
      
      // Calculate Average & Specific Score
      const studentEvaluations = [];
      evaluations.forEach(evalDoc => {
          if (evalDoc.scores && evalDoc.scores[s.id]) {
              studentEvaluations.push({
                  taskId: evalDoc.taskId,
                  ...evalDoc.scores[s.id]
              });
          }
      });

      const totalScore = studentEvaluations.reduce((sum, e) => sum + (e.totalScore || 0), 0);
      const avg = studentEvaluations.length ? (totalScore / studentEvaluations.length).toFixed(1) : 0;
      const avgDisplay = studentEvaluations.length ? helpers.convertToBanglaNumber(avg) : '-';
      
      // Calculate Specific Score
      let specificDisplay = '-';
      let specificClass = 'text-gray-500 dark:text-gray-400';
      
      if (activeFilters.assignment !== 'all') {
          const assignEval = studentEvaluations.find(e => e.taskId === activeFilters.assignment);
          if (assignEval) {
              specificDisplay = helpers.convertToBanglaNumber(assignEval.totalScore);
              specificClass = 'font-bold text-blue-600 dark:text-blue-400';
          }
      }

      // Gender Display Logic with Color Badge
      let genderDisplay = '-';
      const gender = (s.gender || '').trim();
      if (gender === 'ছেলে' || gender.toLowerCase() === 'male') {
        genderDisplay = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">ছেলে</span>';
      } else if (gender === 'মেয়ে' || gender.toLowerCase() === 'female') {
        genderDisplay = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300">মেয়ে</span>';
      } else if (gender) {
        genderDisplay = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">${gender}</span>`;
      }

      tr.innerHTML = `
        <td class="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">${helpers.convertToBanglaNumber(index + 1)}</td>
        <td class="px-6 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">${s.name}</td>
        <td class="px-6 py-3">${helpers.convertToBanglaNumber(s.roll)}</td>
        <td class="px-6 py-3">${genderDisplay}</td>
        <td class="px-6 py-3 whitespace-nowrap">${groupName}</td>
        <td class="px-6 py-3 whitespace-nowrap">${_renderAcademicBadge(s.academicGroup)}</td>
        <td class="px-6 py-3">${s.session || '-'}</td>
        <td class="px-6 py-3 whitespace-nowrap">${_renderRoleBadge(s.role)}</td>
        <td class="px-6 py-3 text-xs text-gray-500 dark:text-gray-400">${s.contact || '-'}</td>
        <td class="px-6 py-3 text-center font-medium">${avgDisplay}</td>
        ${activeFilters.assignment !== 'all' ? `<td class="px-6 py-3 text-center ${specificClass}">${specificDisplay}</td>` : ''}
      `;
      
      // Add click event to open student details modal
      tr.addEventListener('click', () => {
        if (typeof window !== 'undefined' && typeof window.openStudentModalById === 'function') {
          window.openStudentModalById(s.id);
        } else {
          console.warn('Student modal function not available');
        }
      });
      
      tbody.appendChild(tr);
    });
}

let sfChartInstance = null;

function _renderChart(students, evaluations) {
    const ctx = document.getElementById('sfChartCanvas');
    if (!ctx) return;

    // Prepare Data
    const chartData = students.map(s => {
        // Calculate Score
        const studentEvaluations = [];
        evaluations.forEach(evalDoc => {
            if (evalDoc.scores && evalDoc.scores[s.id]) {
                studentEvaluations.push({
                    taskId: evalDoc.taskId,
                    ...evalDoc.scores[s.id]
                });
            }
        });

        let score = 0;
        if (activeFilters.assignment !== 'all') {
             const assignEval = studentEvaluations.find(e => e.taskId === activeFilters.assignment);
             score = assignEval ? (Number(assignEval.totalScore) || 0) : 0;
        } else {
             const totalScore = studentEvaluations.reduce((sum, e) => sum + (Number(e.totalScore) || 0), 0);
             score = studentEvaluations.length ? (totalScore / studentEvaluations.length) : 0;
        }

        return {
            name: s.name,
            roll: s.roll,
            academicGroup: s.academicGroup,
            score: Number(score.toFixed(1))
        };
    });

    // Sort by Score Descending (Ranking)
    chartData.sort((a, b) => b.score - a.score);

    const labels = chartData.map(d => d.name); // Just name for cleaner look, or `${d.name} (${d.roll})`
    const dataPoints = chartData.map(d => d.score);
    const backgroundColors = chartData.map(d => _getAcademicColor(d.academicGroup));

    if (sfChartInstance) {
        sfChartInstance.destroy();
    }

    sfChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: activeFilters.assignment !== 'all' ? 'এসাইনমেন্ট নম্বর' : 'গড় ফলাফল',
                data: dataPoints,
                backgroundColor: backgroundColors,
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'x', // Vertical bars
            plugins: {
                legend: {
                    display: false // Hide legend as colors are dynamic per bar
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const d = chartData[context.dataIndex];
                            return `${d.name} (${d.roll}) - ${helpers.convertToBanglaNumber(d.score)}`;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: (value) => helpers.convertToBanglaNumber(value),
                    font: {
                        weight: 'bold',
                        size: 11
                    },
                    color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#6b7280' // theme-aware: gray-200 in dark, gray-500 in light
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        borderDash: [5, 5]
                    },
                    ticks: {
                        color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#6b7280',
                        font: {
                            family: "'Noto Sans Bengali', sans-serif"
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        autoSkip: false,
                        maxRotation: 90,
                        minRotation: 45,
                        color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#6b7280',
                        font: {
                            size: 10,
                            family: "'Noto Sans Bengali', sans-serif"
                        }
                    }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const student = students.find(s => s.name === chartData[index].name && s.roll === chartData[index].roll); // Match back to student
                    if (student && typeof window !== 'undefined' && typeof window.openStudentModalById === 'function') {
                        window.openStudentModalById(student.id);
                    }
                }
            }
        }
    });
}

function _getAcademicColor(group) {
    const g = (group || '').toString().trim().toLowerCase();
    if (/science|বিজ্ঞান/.test(g)) return 'rgba(168, 85, 247, 0.7)'; // Purple
    if (/arts|মানবিক/.test(g)) return 'rgba(249, 115, 22, 0.7)'; // Orange
    if (/commerce|ব্যবসা|কমার্স/.test(g)) return 'rgba(59, 130, 246, 0.7)'; // Blue
    if (/vocational|ভোকেশনাল/.test(g)) return 'rgba(6, 182, 212, 0.7)'; // Cyan
    return 'rgba(107, 114, 128, 0.7)'; // Gray
}

function _renderAcademicBadge(group) {
    if (!group) return '-';
    const colors = {
        'Science': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        'Business Studies': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        'Humanities': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    };
    // Default fallback
    let cls = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    
    // Simple matching
    if (group.includes('Science') || group.includes('বিজ্ঞান')) cls = colors['Science'];
    else if (group.includes('Business') || group.includes('ব্যবসায়')) cls = colors['Business Studies'];
    else if (group.includes('Humanities') || group.includes('মানবিক')) cls = colors['Humanities'];

    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}">${group}</span>`;
}

function _renderRoleBadge(role) {
    if (!role) return '-';
    const map = {
        'team-leader': { label: 'টিম লিডার', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
        'time-keeper': { label: 'টাইম কিপার', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
        'reporter': { label: 'রিপোর্টার', cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
        'resource-manager': { label: 'রিসোর্স ম্যানেজার', cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
        'peace-maker': { label: 'পিস মেকার', cls: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' }
    };
    const info = map[role] || { label: role, cls: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${info.cls}">${info.label}</span>`;
}
