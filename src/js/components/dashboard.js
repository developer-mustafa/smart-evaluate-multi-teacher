// js/components/dashboard.js
// নির্ভরতা (Dependencies)
let stateManager, uiManager, helpers, app;

// Cached DOM Elements
const elements = {};

const DEFAULT_ASSIGNMENT_HOUR = 11;
const DEFAULT_ASSIGNMENT_MINUTE = 55;
const DEFAULT_ASSIGNMENT_SECOND = 0;
const MIN_EVALUATIONS_FOR_RANKING = 1;
let currentFilterValue = 'latest'; // Persist filter state
const KNOWN_TASK_TIME_KEYS = [
  'time',
  'scheduledTime',
  'scheduleTime',
  'assignmentTime',
  'startTime',
  'startAt',
  'timeSlot',
  'slotTime',
  'meetingTime',
];

/**
 * Initializes the Dashboard component.
 */
export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  helpers = dependencies.utils;
  app = dependencies.app;

  _cacheDOMElements(); // Cache only the main page element
  console.log('✅ Dashboard component initialized.');

  return {
    render,
  };
}

/**
 * Renders the Dashboard page content based on current state.
 */
export function render() {
  console.log('Rendering Dashboard...');
  if (!elements.page) {
    console.error('❌ Dashboard render failed: Page element (#page-dashboard) not found.');
    return;
  }

  uiManager.clearContainer(elements.page);
  elements.page.innerHTML =
    '  <div class="placeholder-content"><i class="fas fa-spinner fa-spin mr-2"></i> ড্যাশবোর্ড ডেটা লোড হচ্ছে...</div>';

  try {
    // Multi-teacher support: Use filtered data based on user role
    const currentUserType = stateManager.get('currentUserData')?.type;
    const activeContext = stateManager.get('activeContext') || {};
    let groups, students, tasks, evaluations;
    
    if (currentUserType === 'teacher') {
      // Teachers see only their assigned data
      groups = stateManager.getFilteredData('groups');
      students = stateManager.getFilteredData('students');
      tasks = stateManager.getFilteredData('tasks');
      evaluations = stateManager.getFilteredData('evaluations');
      console.log('📚 Teacher mode: Using filtered data');
    } else {
      // Admin/Super-admin: Apply activeContext filters if set
      const state = stateManager.getState();
      groups = state.groups || [];
      students = state.students || [];
      tasks = state.tasks || [];
      evaluations = state.evaluations || [];
      
      // Apply admin filters based on activeContext
      if (activeContext.classId || activeContext.sectionId || activeContext.subjectId) {
        console.log('🔧 Admin mode: Applying activeContext filters:', activeContext);
        
        // Get lookup data for name-based matching
        const allSections = stateManager.get('sections') || [];
        const allSubjects = stateManager.get('subjects') || [];
        
        // Get selected section/subject names
        const selectedSection = allSections.find(s => s.id === activeContext.sectionId);
        const selectedSubject = allSubjects.find(s => s.id === activeContext.subjectId);
        const selectedSectionName = selectedSection?.name?.trim() || '';
        const selectedSubjectName = selectedSubject?.name?.trim() || '';
        
        // Filter students by class (direct ID match)
        if (activeContext.classId) {
          students = students.filter(s => s.classId === activeContext.classId);
        }
        
        // Filter students by section (name-based matching)
        if (activeContext.sectionId && selectedSectionName) {
          students = students.filter(s => {
            if (!s.sectionId) return false;
            const studentSection = allSections.find(sec => sec.id === s.sectionId);
            return studentSection?.name?.trim() === selectedSectionName;
          });
        }
        
        // Filter tasks by subject (name-based matching)
        if (activeContext.subjectId && selectedSubjectName) {
          tasks = tasks.filter(t => {
            if (!t.subjectId) return false;
            const taskSubject = allSubjects.find(sub => sub.id === t.subjectId);
            return taskSubject?.name?.trim() === selectedSubjectName;
          });
        }
        
        // Filter groups to only those containing filtered students
        if (activeContext.classId || activeContext.sectionId) {
          const filteredStudentGroupIds = new Set(students.filter(s => s.groupId).map(s => s.groupId));
          groups = groups.filter(g => filteredStudentGroupIds.has(g.id));
        }
        
        // Filter evaluations to only those for filtered tasks
        if (activeContext.subjectId) {
          const filteredTaskIds = new Set(tasks.map(t => t.id));
          evaluations = evaluations.filter(e => filteredTaskIds.has(e.taskId));
        }
        
        console.log('📊 Filtered data:', {
          groups: groups.length,
          students: students.length,
          tasks: tasks.length,
          evaluations: evaluations.length
        });
      }
    }
    if (!groups || !students || !tasks || !evaluations) {
      uiManager.displayEmptyMessage(elements.page, 'ডেটা এখনো লোড হচ্ছে...');
      return;
    }

    const stats = _calculateStats(groups, students, tasks, evaluations);

    // Re-create the inner HTML structure
    elements.page.innerHTML = _getDashboardHTMLStructure();

    // Re-cache elements *within* the newly created structure
    _cacheInnerDOMElements();

    // Render statistics into the cached elements
    _renderStats(stats);

    // Render dynamic lists
    _renderTopGroups(stats.groupPerformanceData);
    _renderAcademicGroups(stats.academicGroupStats);
    _renderGroupsRanking(stats.groupPerformanceData, stats.groupRankingMeta);

    // Populate Assignment Filter
    _populateAssignmentFilter(tasks);
    
    // Setup Dashboard Filters (Admin) and Teacher Info
    _setupDashboardFilters();

    console.log('✅ Dashboard rendered successfully.');
  } catch (error) {
    console.error('❌ Error rendering dashboard:', error);
    if (elements.page) {
      uiManager.displayEmptyMessage(elements.page, `ড্যাশবোর্ড লোড করতে ত্রুটি হয়েছে: ${error.message}`);
    }
  }
}

/**
 * Returns the static HTML structure for the dashboard content.
 * @private
 */
function _getDashboardHTMLStructure() {
  return `
    <style>
      @keyframes glowOrbit {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .glow-ring {
        position: relative;
        isolation: isolate;
      }
      .glow-ring::before,
      .glow-ring::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        pointer-events: none;
      }
      .glow-ring::before {
        background: conic-gradient(from 0deg,
          rgba(255,180,0,0) 0deg,
          rgba(255,190,0,0.2) 180deg,
          rgba(255,200,0,0.9) 300deg,
          rgba(255,215,0,1) 340deg,
          rgba(255,180,0,0) 360deg);
        mask: radial-gradient(circle, transparent 65%, black 72%);
        -webkit-mask: radial-gradient(circle, transparent 65%, black 72%);
        box-shadow: 0 0 40px rgba(255,180,0,0.7), 0 0 80px rgba(255,200,0,0.5);
        animation: glowOrbit 3s linear infinite;
      }
      .glow-ring::after {
        background: conic-gradient(from 0deg,
          rgba(255,160,0,0) 0deg,
          rgba(255,180,0,0.3) 240deg,
          rgba(255,200,0,0.9) 320deg,
          rgba(255,160,0,0) 360deg);
        mask: radial-gradient(circle, transparent 55%, black 68%);
        -webkit-mask: radial-gradient(circle, transparent 55%, black 68%);
        filter: blur(12px);
        opacity: 1;
        animation: glowOrbit 5s linear infinite;
      }
    </style>
    <div class="max-w-7xl mx-auto space-y-2">
     

    <section id="dashboard-hero" class="relative overflow-hidden rounded-3xl border border-slate-300/60
  bg-gradient-to-br from-white via-slate-50 to-slate-200
  text-slate-900 shadow-[0_4px_10px_rgba(0,0,0,0.10),0_10px_28px_rgba(255,255,255,0.65)]
  hover:shadow-[0_8px_18px_rgba(0,0,0,0.14),0_14px_34px_rgba(255,255,255,0.75)]
  transition-all duration-500 ease-out
  dark:border-slate-700/60 dark:bg-gradient-to-br dark:from-slate-800 dark:via-slate-900 dark:to-black
  dark:text-slate-100 dark:shadow-[inset_0_2px_4px_rgba(255,255,255,0.05),0_6px_18px_rgba(0,0,0,0.60),0_0_28px_rgba(255,255,255,0.10)]
  dark:hover:shadow-[inset_0_3px_6px_rgba(255,255,255,0.08),0_10px_24px_rgba(0,0,0,0.75),0_0_36px_rgba(255,255,255,0.14)]">

  <!-- subtle radial aura -->
  <div aria-hidden class="absolute inset-0 opacity-30 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.35),transparent_60%)]"></div>

  <div class="relative p-2 sm:p-3 space-y-2">

    <!-- Card (hero row) -->
    <section class="relative overflow-hidden rounded-3xl border
      border-slate-300/70 ring-1 ring-white/40 backdrop-blur supports-[backdrop-filter]:bg-white/70
      bg-gradient-to-br from-amber-50 via-rose-50 to-sky-50
      shadow-[0_6px_16px_rgba(0,0,0,0.10),0_0_30px_rgba(255,255,255,0.55)]
      hover:shadow-[0_10px_24px_rgba(0,0,0,0.14),0_0_36px_rgba(255,255,255,0.65)]
      transition-all duration-500 ease-out
      dark:border-slate-700/70 dark:bg-gradient-to-br dark:from-slate-800 dark:via-slate-900 dark:to-slate-950
      dark:text-slate-100 dark:shadow-[inset_0_2px_4px_rgba(255,255,255,0.06),0_10px_26px_rgba(0,0,0,0.70),0_0_34px_rgba(255,255,255,0.10)]
      dark:hover:shadow-[inset_0_3px_6px_rgba(255,255,255,0.08),0_14px_30px_rgba(0,0,0,0.78),0_0_40px_rgba(255,255,255,0.14)]">

      <!-- conic aura -->
      <div aria-hidden class="pointer-events-none absolute -inset-px rounded-[24px] opacity-[0.10] blur-2xl"
           style="background: conic-gradient(#fde68a, #f0abfc, #93c5fd, #fde68a)"></div>

      <div class="relative p-2 sm:p-3">
        <div class="flex flex-col items-center justify-between gap-2 md:flex-row">

          <!-- Left: title & icon -->
          <div class="flex w-full items-center gap-3 md:w-auto justify-center md:justify-start">
            
            <p class="text-2xl font-black tracking-tight text-slate-900 dark:text-white text-center md:text-left">
              স্মার্ট ইভ্যালুয়েট সিস্টেম
            </p>
             <!-- Assignment Filter -->
           
          </div>

          <!-- Score chips -->
          <div class="grid w-full grid-cols-2 gap-2 text-[0.9rem] font-semibold sm:w-auto sm:grid-cols-3 md:grid-cols-4">
            <span class="relative rounded-2xl px-4 py-1.5
              text-emerald-900 bg-gradient-to-b from-emerald-50 via-emerald-200 to-emerald-500
              ring-2 ring-emerald-300/80
              shadow-[inset_0_1px_3px_rgba(255,255,255,0.9),0_4px_8px_rgba(0,0,0,0.15),0_10px_18px_rgba(0,0,0,0.20)]
              transition-all duration-300
              dark:text-emerald-100 dark:from-emerald-700 dark:via-emerald-800 dark:to-emerald-900 dark:ring-emerald-600/40
              dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),0_6px_12px_rgba(0,0,0,0.75)]">টাস্ক স্কোর</span>

            <span class="relative rounded-2xl px-4 py-1.5
              text-sky-900 bg-gradient-to-b from-sky-50 via-sky-200 to-sky-500
              ring-2 ring-sky-300/80
              shadow-[inset_0_1px_3px_rgba(255,255,255,0.9),0_4px_8px_rgba(0,0,0,0.15),0_10px_18px_rgba(0,0,0,0.20)]
              transition-all duration-300
              dark:text-sky-100 dark:from-sky-700 dark:via-sky-800 dark:to-sky-900 dark:ring-sky-600/40
              dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),0_6px_12px_rgba(0,0,0,0.75)]">টিম স্কোর</span>

            <span class="relative rounded-2xl px-4 py-1.5
              text-rose-900 bg-gradient-to-b from-rose-50 via-rose-200 to-rose-500
              ring-2 ring-rose-300/80
              shadow-[inset_0_1px_3px_rgba(255,255,255,0.9),0_4px_8px_rgba(0,0,0,0.15),0_10px_18px_rgba(0,0,0,0.20)]
              transition-all duration-300
              dark:text-rose-100 dark:from-rose-700 dark:via-rose-800 dark:to-rose-900 dark:ring-rose-600/40
              dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),0_6px_12px_rgba(0,0,0,0.75)]">অতিরিক্ত স্কোর</span>

            <span class="relative rounded-2xl px-4 py-1.5
              text-amber-900 bg-gradient-to-b from-amber-50 via-amber-200 to-amber-500
              ring-2 ring-amber-300/80
              shadow-[inset_0_1px_3px_rgba(255,255,255,0.9),0_4px_8px_rgba(0,0,0,0.15),0_10px_18px_rgba(0,0,0,0.20)]
              transition-all duration-300
              dark:text-amber-100 dark:from-amber-700 dark:via-amber-800 dark:to-amber-900 dark:ring-amber-700/40
              dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),0_6px_12px_rgba(0,0,0,0.75)]">MCQ স্কোর</span>
          </div>

          

          <!-- Right: image preview -->
          <div class="w-full md:w-auto">
            <div class="glow-ring relative mx-auto h-28 w-28 sm:h-32 sm:w-32">
              <div class="absolute inset-[10px] overflow-hidden rounded-full border-2 border-amber-200/60 bg-white
                shadow-[0_10px_25px_rgba(0,0,0,0.25),0_0_35px_rgba(255,214,155,0.7)]
                dark:bg-slate-900 dark:shadow-[0_12px_28px_rgba(0,0,0,0.65),0_0_35px_rgba(255,214,155,0.10)]">
                <img src="images/smart.png" alt="Evaluation summary visual"
                     class="h-full w-full object-cover object-center" loading="lazy" decoding="async" />
              </div>
            </div>
          </div>

          

        </div>
         <div class="flex flex-wrap gap-2 items-center mt-2">
             <div class="relative">
                <select id="dashboardAssignmentFilter" 
                  class="appearance-none bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 
                  text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg py-1 pl-2 pr-6 
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer backdrop-blur-sm transition-colors hover:bg-white/80 dark:hover:bg-slate-800/80">
                  <option value="latest">সর্বশেষ এসাইনমেন্ট</option>
                </select>
                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500 dark:text-slate-400">
                  <i class="fas fa-chevron-down text-[10px]"></i>
                </div>
            </div>

            <!-- Teacher Filters (Hidden by default) -->
            <div id="teacherFiltersContainer" class="hidden flex flex-wrap gap-2 items-center">
                <!-- Teacher Info Card -->
                <div id="teacherInfoCard" class="hidden flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 border border-indigo-200/60 dark:border-indigo-700/50 shadow-sm">
                    <i class="fas fa-chalkboard-teacher text-indigo-600 dark:text-indigo-300"></i>
                    <div class="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                        <span id="teacherNameDisplay">শিক্ষক</span>
                        <span class="text-indigo-400 dark:text-indigo-500 mx-1">·</span>
                        <span id="teacherAssignmentDisplay" class="text-indigo-700 dark:text-indigo-300"></span>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2 items-center">
                    <select id="dashboardClassFilter" class="appearance-none bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg py-1.5 px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer backdrop-blur-sm transition-colors hover:bg-white/80 dark:hover:bg-slate-800/80 min-w-[120px]">
                        <option value="">সকল ক্লাস</option>
                    </select>
                    <select id="dashboardSectionFilter" class="appearance-none bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg py-1.5 px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer backdrop-blur-sm transition-colors hover:bg-white/80 dark:hover:bg-slate-800/80 min-w-[120px]">
                        <option value="">সকল শাখা</option>
                    </select>
                    <select id="dashboardSubjectFilter" class="appearance-none bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg py-1.5 px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer backdrop-blur-sm transition-colors hover:bg-white/80 dark:hover:bg-slate-800/80 min-w-[120px]">
                        <option value="">সকল বিষয়</option>
                    </select>
                </div>
            </div>
         </div>
      </div>
    </section>

    <!-- Two-column content -->
    <div class="grid gap-3 lg:grid-cols-2 items-stretch">

      <!-- Students & Groups -->
      <article class="rounded-3xl border border-slate-300/70 bg-gradient-to-br from-white via-slate-50 to-slate-100 
        text-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.10),0_0_24px_rgba(255,255,255,0.5)]
        backdrop-blur dark:border-slate-700/70 dark:bg-gradient-to-br dark:from-slate-800 dark:via-slate-900 dark:to-black 
        dark:text-white dark:shadow-[inset_0_2px_4px_rgba(255,255,255,0.06),0_12px_32px_rgba(0,0,0,0.7)] h-full p-2">

        <div class="space-y-2">
          <div class="flex items-center justify-center text-xs font-semibold text-slate-800 dark:text-white/80">
            <span class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-slate-900 
              ring-1 ring-slate-200 shadow-sm dark:bg-white/10 dark:text-white">
              <i class="fas fa-people-group text-indigo-600 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"></i>
              <span id="assignmentStatusTitle">সর্বশেষ এসাইনমেন্ট ফলাফল প্রদান তথ্য</span>
            </span>
           
          </div>
           <!-- Evaluation progress -->
        <div class="relative rounded-2xl border border-blue-300/70
            bg-gradient-to-br from-white via-blue-50 to-emerald-50
            shadow-[inset_0_1px_2px_rgba(255,255,255,0.9),0_8px_18px_rgba(0,0,0,0.08)]
            p-1 mb-2
            dark:border-blue-400/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950
            dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_10px_24px_rgba(0,0,0,0.55)]">

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-center">
            <!-- Col 1: Title chip -->
            <div class="min-w-0">
              <span class="inline-flex items-center gap-2 rounded-full
                           px-3 py-1 text-[0.85rem] font-semibold
                           bg-white/90 text-slate-900 ring-1 ring-white/70
                           shadow-[0_1px_2px_rgba(0,0,0,0.14)] backdrop-blur
                           dark:bg-white/10 dark:text-white dark:ring-white/15">
                <i class="fas fa-chart-simple text-indigo-600 dark:text-indigo-300 text-sm"></i>
                <span class="truncate" lang="bn">মূল্যায়ন প্রদানের অগ্রগতি</span>
              </span>
            </div>

            <!-- Col 2: Progress bar -->
            <div class="w-full">
              <div class="battery w-full">
                <div class="battery-shell relative w-full h-full">
                  <div id="progressBar" class="battery-liquid h-full" style="width: 0%"></div>
                  <span id="progressBarLabel" class="battery-label absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-900 dark:text-white z-10 drop-shadow-md">0%</span>
                </div>
               
              </div>
            </div>
          </div>
        </div>

          <div class="grid gap-3 md:grid-cols-2">
            <!-- শিক্ষার্থী -->
            <div class="rounded-2xl border border-emerald-300/70 bg-gradient-to-br from-white via-emerald-50 to-emerald-100/70 
              shadow-[0_6px_16px_rgba(16,185,129,0.18)] px-4 py-2
              dark:border-emerald-300/30 dark:from-emerald-900/40 dark:via-slate-900 dark:to-emerald-900/10">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-bold text-emerald-900 dark:text-emerald-200">শিক্ষার্থী</p>
                  <p class="text-xs text-emerald-700 dark:text-emerald-300/90">বর্তমান অগ্রগতি</p>
                </div>
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 
                  shadow-[0_1px_2px_rgba(0,0,0,0.2)] dark:bg-emerald-500/20 dark:text-emerald-200">
                  <i class="fas fa-user-graduate"></i>
                </span>
              </div>

              <div class="mt-3 space-y-2 text-sm font-semibold text-slate-900 dark:text-white">
                <div class="flex items-center justify-between"><span>মূল্যায়িত</span><span><span id="latestAssignmentEvaluated">-</span> জন</span></div>
                <div class="flex items-center justify-between"><span>অবশিষ্ট</span><span><span id="latestAssignmentPending">-</span> জন</span></div>
                <div class="flex items-center justify-between"><span>মোট</span><span><span id="latestAssignmentStudentTotal">-</span> জন</span></div>
              </div>
            </div>

            <!-- গ্রুপ -->
            <div class="rounded-2xl border border-sky-300/70 bg-gradient-to-br from-white via-sky-50 to-sky-100/70 
              shadow-[0_6px_16px_rgba(14,165,233,0.18)] px-4 py-4
              dark:border-sky-300/30 dark:from-sky-900/40 dark:via-slate-900 dark:to-sky-900/10">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-bold text-sky-900 dark:text-sky-100">গ্রুপ</p>
                  <p class="text-xs text-sky-700 dark:text-sky-200/80">বর্তমান অগ্রগতি</p>
                </div>
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-600 
                  shadow-[0_1px_2px_rgba(0,0,0,0.2)] dark:bg-sky-500/20 dark:text-sky-200">
                  <i class="fas fa-layer-group"></i>
                </span>
              </div>
              <div class="mt-3 space-y-2 text-sm font-semibold text-slate-900 dark:text-white">
                <div class="flex items-center justify-between"><span>মূল্যায়িত</span><span><span id="latestAssignmentGroupEvaluated">-</span> টি</span></div>
                <div class="flex items-center justify-between"><span>অবশিষ্ট</span><span><span id="latestAssignmentGroupPending">-</span> টি</span></div>
                <div class="flex items-center justify-between"><span>মোট</span><span><span id="latestAssignmentGroupTotal">-</span> টি</span></div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <!-- Latest assignment + progress -->
      <article class="relative rounded-3xl border border-slate-300/70 
        bg-gradient-to-br from-blue-50 via-sky-100 to-emerald-50 
        text-slate-900 shadow-[0_10px_25px_rgba(0,0,0,0.08),0_0_35px_rgba(255,255,255,0.6)] 
        backdrop-blur p-3 sm:p-4 transition-all duration-500 
        dark:border-slate-700/70 dark:bg-gradient-to-br dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 
        dark:text-white dark:shadow-[inset_0_2px_4px_rgba(255,255,255,0.06),0_12px_32px_rgba(0,0,0,0.7)] h-full">

       

        <!-- Header -->
        <div class="mb-2 sm:mb-3 ">
          <p class="text-xs font-bold text-slate-700 dark:text-white/60" lang="bn" >
            <span id="latestAssignmentLabel">সর্বশেষ এসাইনমেন্ট</span>    <span class="text-xs text-slate-700 dark:text-white/60">
            অনুষ্ঠিত: <span id="latestAssignmentUpdated">-</span>
          </span>
          </p>
          <p id="latestTaskTitle"
            class="mt-1 max-w-[28rem]  font-bold text-slate-900 dark:text-white text-sm sm:text-lg"
            title="-">-</p>
        </div>

       

        <!-- Content: 3-column on sm+ -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Average -->
          <div class="flex flex-col items-center justify-center gap-2 sm:gap-3">
            <div class="relative h-24 w-24 sm:h-26 sm:w-26 rounded-full border border-emerald-300/60 
              bg-emerald-50 dark:bg-slate-800
              shadow-[0_6px_16px_rgba(16,185,129,0.25)] 
              dark:border-emerald-300/30 flex items-center justify-center"
              id="latestAssignmentCircle">
              <div class="absolute inset-3 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                <p id="latestAssignmentAverage" class="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">-</p>
              </div>
            </div>
            <p id="latestAssignmentAverageLabelText" class="text-[0.8rem] sm:text-sm font-bold text-emerald-800 dark:text-white/80 text-center">
              সর্বশেষ এসাইনমেন্ট গড়
            </p>
          </div>

          <!-- Overall -->
          <div class="flex flex-col items-center justify-center gap-2 sm:gap-3">
            <div class="relative h-24 w-24 sm:h-26 sm:w-26 rounded-full border border-sky-300/60 
              bg-sky-50 dark:bg-slate-800
              shadow-[0_6px_16px_rgba(14,165,233,0.25)] 
              dark:border-sky-300/30 flex items-center justify-center"
              id="overallProgressCircle">
              <div class="absolute inset-3 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                <p id="overallProgress" class="text-2xl sm:text-3xl font-bold text-sky-600 dark:text-sky-400">-</p>
              </div>
            </div>
            <p class="text-[0.8rem] sm:text-sm font-bold text-sky-800 dark:text-white/80 text-center">
              সামগ্রিক ‍উন্নতি
            </p>
          </div>
        </div>
      </article>

    </div>
  </div>
</section>

      <section id="dashboard-stats" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <article class="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-gray-700/70 dark:bg-gray-900/70">
          <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent"></div>
          <div class="relative flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">ড্যাশবোর্ড স্টেট</p>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white">মোট গ্রুপ</h3>
              <p class="mt-4 text-3xl font-bold text-gray-900 dark:text-white" id="totalGroups">-</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">সক্রিয় সব গ্রুপ সংখ্যা</p>
            </div>
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
              <i class="fas fa-layer-group text-lg"></i>
            </span>
          </div>
        </article>

        <article class="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-gray-700/70 dark:bg-gray-900/70">
          <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent"></div>
          <div class="relative flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">মোট শিক্ষার্থী</p>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white">মোট শিক্ষার্থী</h3>
              <p class="mt-4 text-3xl font-bold text-gray-900 dark:text-white" id="totalStudents">-</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">সিস্টেমে নিবন্ধিত সব সদস্য</p>
            </div>
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <i class="fas fa-user-graduate text-lg"></i>
            </span>
          </div>
        </article>

        <article class="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-gray-700/70 dark:bg-gray-900/70">
          <div class="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent"></div>
          <div class="relative flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">একাডেমিক কভারেজ</p>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white">একাডেমিক গ্রুপ</h3>
              <p class="mt-4 text-3xl font-bold text-gray-900 dark:text-white" id="totalAcademicGroups">-</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">বিজ্ঞান · মানবিক · ব্যবসায়</p>
            </div>
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
              <i class="fas fa-university text-lg"></i>
            </span>
          </div>
        </article>

        <article class="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-gray-700/70 dark:bg-gray-900/70">
          <div class="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent"></div>
          <div class="relative flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">দায়িত্ব বন্টন</p>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white">দায়িত্ব বাকি</h3>
              <p class="mt-4 text-3xl font-bold text-gray-900 dark:text-white" id="pendingRoles">-</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">যাদের ভূমিকা নির্ধারণ হয়নি</p>
            </div>
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <i class="fas fa-user-clock text-lg"></i>
            </span>
          </div>
        </article>

        <article class="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-gray-700/70 dark:bg-gray-900/70">
          <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent"></div>
          <div class="relative flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">জেন্ডার অন্তর্ভুক্তি</p>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white">ছেলে সদস্য</h3>
              <p class="mt-4 text-3xl font-bold text-gray-900 dark:text-white" id="maleStudents">-</p>
              <div class="mt-1 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-300">
                <i class="fas fa-male"></i>
                <span id="malePercentage">-</span>
              </div>
            </div>
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-300">
              <i class="fas fa-venus-mars text-lg"></i>
            </span>
          </div>
        </article>

        <article class="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-gray-700/70 dark:bg-gray-900/70">
          <div class="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-transparent to-transparent"></div>
          <div class="relative flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">জেন্ডার অন্তর্ভুক্তি</p>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white">মেয়ে সদস্য</h3>
              <p class="mt-4 text-3xl font-bold text-gray-900 dark:text-white" id="femaleStudents">-</p>
              <div class="mt-1 inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                <i class="fas fa-female"></i>
                <span id="femalePercentage">-</span>
              </div>
            </div>
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-300">
              <i class="fas fa-user-friends text-lg"></i>
            </span>
          </div>
        </article>

        <article class="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-gray-700/70 dark:bg-gray-900/70">
          <div class="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-transparent"></div>
          <div class="relative flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">টাস্ক ম্যানেজমেন্ট</p>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white">মোট এসাইনমেন্ট</h3>
              <p class="mt-4 text-3xl font-bold text-gray-900 dark:text-white" id="totalTasks">-</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">নির্ধারিত সব মূল্যায়ন টাস্ক</p>
            </div>
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-300">
              <i class="fas fa-tasks text-lg"></i>
            </span>
          </div>
        </article>

        <article class="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-gray-700/70 dark:bg-gray-900/70">
          <div class="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-transparent"></div>
          <div class="relative flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">মূল্যায়ন কভারেজ</p>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white">বাকি মূল্যায়ন</h3>
              <p class="mt-4 text-3xl font-bold text-gray-900 dark:text-white" id="pendingEvaluations">-</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">যেগুলো এখনো সম্পন্ন হয়নি</p>
            </div>
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 text-red-600 dark:text-red-300">
              <i class="fas fa-hourglass-half text-lg"></i>
            </span>
          </div>
        </article>
      </section>

      <section id="dashboard-top-groups" class="relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-sm transition hover:shadow-lg dark:border-gray-700/70 dark:bg-gray-900/70">
        <div class="border-b border-gray-200/60 px-6 py-4 dark:border-gray-800/80">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">এলিট গ্রুপ</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">গড় মূল্যায়ন স্কোরে শীর্ষে থাকা দলগুলোকে এক নজরে দেখুন।</p>
            </div>
            <span class="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-300">
              <i class="fas fa-trophy"></i> Elite Group
            </span>
          </div>
        </div>
        <div id="topGroupsContainer" class="p-6"></div>
      </section>

      <section id="dashboard-academic-stats" class="relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-sm transition hover:shadow-lg dark:border-gray-700/70 dark:bg-gray-900/70">
        <div class="border-b border-gray-200/60 px-6 py-4 dark:border-gray-800/80">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">একাডেমিক গ্রুপ পারফরম্যান্স</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">শাখাভিত্তিক গ্রুপ স্কোর ও অংশগ্রহণের প্রবণতা</p>
            </div>
            <span class="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
              <i class="fas fa-chart-bar"></i> ট্রেন্ডস
            </span>
          </div>
        </div>
        <div id="academicGroupStatsList" class="p-6"></div>
      </section>

      <section id="dashboard-ranking" class="relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-sm transition hover:shadow-lg dark:border-gray-700/70 dark:bg-gray-900/70">
        <div class="border-b border-gray-200/60 px-6 py-4 dark:border-gray-800/80">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">গ্রুপ র‍্যাঙ্কিং · গড় নম্বরের ভিত্তিতে</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">গড় স্কোর, সদস্য সংখ্যা, মূল্যায়িত সদস্য এবং টাস্ক কভারেজ</p>
            </div>
            <span class="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-300">
              <i class="fas fa-star"></i> ডেটা ইনসাইট
            </span>
          </div>
        </div>
        <div id="groupsRankingList" class="p-6 space-y-4"></div>
      </section>
    </div>
  `;
}

function _normalizeTimestamp(value) {
  if (!value) return 0;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (typeof value === 'object') {
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value.toDate === 'function') {
      try {
        return value.toDate().getTime();
      } catch {
        return 0;
      }
    }
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function _getTaskScheduleTimestamp(task) {
  if (!task) return 0;
  const candidates = [
    task.date,
    task.scheduleDate,
    task.startDate,
    task.dueDate,
    task.deadline,
    task.assignmentDate,
    task.assignmentDay,
    task.createdAt,
    task.updatedAt,
  ];
  let baseTimestamp = 0;
  for (const candidate of candidates) {
    const ts = _normalizeTimestamp(candidate);
    if (ts) {
      baseTimestamp = ts;
      break;
    }
  }
  if (!baseTimestamp) return 0;

  const explicitTime = _extractTaskTime(task);
  const dateObj = new Date(baseTimestamp);

  if (explicitTime) {
    dateObj.setHours(explicitTime.hour, explicitTime.minute, 0, 0);
  } else if (
    dateObj.getHours() === 0 &&
    dateObj.getMinutes() === 0 &&
    dateObj.getSeconds() === 0 &&
    dateObj.getMilliseconds() === 0
  ) {
    dateObj.setHours(DEFAULT_ASSIGNMENT_HOUR, DEFAULT_ASSIGNMENT_MINUTE, DEFAULT_ASSIGNMENT_SECOND, 0);
  }
  return dateObj.getTime();
}

function _extractTaskTime(task) {
  if (!task) return null;

  // numeric hour/minute fields
  const hourCandidates = ['timeHour', 'hour', 'startHour'];
  const minuteCandidates = ['timeMinute', 'minute', 'startMinute'];
  const hourValue = hourCandidates
    .map((key) => (typeof task[key] === 'number' ? task[key] : parseInt(task[key], 10)))
    .find((val) => Number.isFinite(val));
  const minuteValue = minuteCandidates
    .map((key) => (typeof task[key] === 'number' ? task[key] : parseInt(task[key], 10)))
    .find((val) => Number.isFinite(val));
  if (Number.isFinite(hourValue) && hourValue >= 0 && hourValue <= 23) {
    const minute = Number.isFinite(minuteValue) && minuteValue >= 0 && minuteValue <= 59 ? minuteValue : 0;
    return { hour: hourValue, minute };
  }

  for (const key of KNOWN_TASK_TIME_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(task, key)) continue;
    const parsed = _parseTimeString(task[key]);
    if (parsed) return parsed;
  }
  return null;
}

function _parseTimeString(rawValue) {
  if (!rawValue) return null;
  const raw = String(rawValue).trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  const timeMatch = normalized.match(/(\d{1,2})(?::(\d{1,2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (!timeMatch) return null;

  let hour = parseInt(timeMatch[1], 10);
  let minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const meridiem = timeMatch[3];
  if (meridiem) {
    const isPM = meridiem.includes('p');
    const isAM = meridiem.includes('a');
    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;
  }
  hour = Math.min(Math.max(hour, 0), 23);
  minute = Math.min(Math.max(minute, 0), 59);
  return { hour, minute };
}

function _findLatestTaskMeta(tasks = []) {
  let latest = null;
  tasks.forEach((task) => {
    if (!task) return;
    const ts = _getTaskScheduleTimestamp(task);
    if (!ts) return;
    if (!latest || ts > latest.ts) {
      const id = task.id ?? task.uid ?? task.key ?? task.slug ?? null;
      const timeParts = _extractTaskTime(task);
      latest = { task, id, ts, timeParts };
    }
  });
  return latest;
}

function _formatTimeFromParts(parts) {
  if (!parts) return null;
  try {
    const date = new Date();
    date.setHours(parts.hour, parts.minute ?? 0, 0, 0);
    return new Intl.DateTimeFormat('bn-BD', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  } catch {
    return null;
  }
}

function _formatDateTime(value) {
  const normalized = _normalizeTimestamp(value);
  if (!normalized) return '-';
  try {
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return '-';
    if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0) {
      date.setHours(DEFAULT_ASSIGNMENT_HOUR, DEFAULT_ASSIGNMENT_MINUTE, DEFAULT_ASSIGNMENT_SECOND, 0);
    }
    return new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return '-';
  }
}

function _formatDateOnly(timestamp) {
  if (!timestamp) return '-';
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium' }).format(date);
  } catch {
    return '-';
  }
}

function _formatTimeOnly(value) {
  const normalized = _normalizeTimestamp(value);
  if (!normalized) return '-';
  try {
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return '-';
    if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0) {
      date.setHours(DEFAULT_ASSIGNMENT_HOUR, DEFAULT_ASSIGNMENT_MINUTE, DEFAULT_ASSIGNMENT_SECOND, 0);
    }
    return new Intl.DateTimeFormat('bn-BD', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  } catch {
    return '-';
  }
}

/** Caches the main page element. */
function _cacheDOMElements() {
  elements.page = document.getElementById('page-dashboard');
  if (!elements.page) console.error('❌ Dashboard init failed: #page-dashboard not found!');
}

/** Caches elements *inside* the dashboard page structure. */
function _cacheInnerDOMElements() {
  if (!elements.page) return;
  const idsToCache = [
    'totalGroups',
    'totalStudents',
    'totalAcademicGroups',
    'pendingRoles',
    'maleStudents',
    'malePercentage',
    'femaleStudents',
    'femalePercentage',
    'totalTasks',
    'pendingEvaluations',
    'progressBar',
    'progressBarLabel',
    'overallProgress',
    'overallProgressCircle',
    'latestAssignmentAverage',
    'latestAssignmentAverageLabelText',
    'latestAssignmentCircle',
    'latestTaskTitle',
    'latestAssignmentUpdated',
    'latestAssignmentEvaluated',
    'latestAssignmentPending',
    'latestAssignmentStudentTotal',
    'latestAssignmentGroupEvaluated',
    'latestAssignmentGroupPending',
    'latestAssignmentGroupTotal',
    'topGroupsContainer',
    'academicGroupStatsList',
    'groupsRankingList',
    'dashboardAssignmentFilter', // Cache the filter
    'assignmentStatusTitle',
    'latestAssignmentLabel',
  ];
  idsToCache.forEach((id) => {
    elements[id] = elements.page.querySelector(`#${id}`);
    if (!elements[id]) console.warn(`Dashboard: Element #${id} not found.`);
  });
}

// --- Filter Logic ---

function _populateAssignmentFilter(tasks) {
  if (!elements.dashboardAssignmentFilter) return;

  // Clear existing options except the first one
  while (elements.dashboardAssignmentFilter.options.length > 1) {
    elements.dashboardAssignmentFilter.remove(1);
  }

  // Sort tasks by date (newest first)
  const sortedTasks = [...tasks].sort((a, b) => {
    const tsA = _getTaskScheduleTimestamp(a);
    const tsB = _getTaskScheduleTimestamp(b);
    return tsB - tsA;
  });

  // Add Global Rank Option
  const globalOption = document.createElement('option');
  globalOption.value = 'global_rank';
  globalOption.textContent = 'সকল এসাইনমেন্ট ভিত্তিক গ্লোবাল রেঙ্ক';
  elements.dashboardAssignmentFilter.appendChild(globalOption);

  sortedTasks.forEach(task => {
    const option = document.createElement('option');
    option.value = task.id;
    option.textContent = task.name;
    elements.dashboardAssignmentFilter.appendChild(option);
  });

  // Restore persisted value OR check for forced assignment
  const dashboardConfig = stateManager.getDashboardConfig();
  
  if (dashboardConfig.isForced && dashboardConfig.forceAssignmentId) {
      // Force the selection
      elements.dashboardAssignmentFilter.value = dashboardConfig.forceAssignmentId;
      elements.dashboardAssignmentFilter.disabled = true; 
      console.log('🔒 Dashboard forced to assignment:', dashboardConfig.forceAssignmentId);
      _updateDashboardForTask(dashboardConfig.forceAssignmentId);
  } else {
      elements.dashboardAssignmentFilter.disabled = false;
      elements.dashboardAssignmentFilter.value = currentFilterValue;
      _updateDashboardForTask(currentFilterValue);
  }

  // Attach listener
  elements.dashboardAssignmentFilter.addEventListener('change', (e) => {
    currentFilterValue = e.target.value; 
    _updateDashboardForTask(e.target.value);
  });
}

function _updateDashboardForTask(taskId) {
  console.log('🔄 Filter changed to:', taskId);
  
  // Get base data
  const state = stateManager.getState();
  let { groups, students, tasks, evaluations } = state;
  
  // Apply filtering based on user type and activeContext
  const currentUserType = stateManager.get('currentUserData')?.type;
  const activeContext = stateManager.get('activeContext') || {};
  
  // Apply admin filters based on activeContext (same logic as render function)
  if (currentUserType !== 'teacher' && (activeContext.classId || activeContext.sectionId || activeContext.subjectId)) {
    console.log('🔧 Admin filter: Applying activeContext to task view:', activeContext);
    
    // Get lookup data for name-based matching
    const allSections = stateManager.get('sections') || [];
    const allSubjects = stateManager.get('subjects') || [];
    
    // Get selected section/subject names
    const selectedSection = allSections.find(s => s.id === activeContext.sectionId);
    const selectedSubject = allSubjects.find(s => s.id === activeContext.subjectId);
    const selectedSectionName = selectedSection?.name?.trim() || '';
    const selectedSubjectName = selectedSubject?.name?.trim() || '';
    
    // Filter students by class (direct ID match)
    if (activeContext.classId) {
      students = students.filter(s => s.classId === activeContext.classId);
    }
    
    // Filter students by section (name-based matching)
    if (activeContext.sectionId && selectedSectionName) {
      students = students.filter(s => {
        if (!s.sectionId) return false;
        const studentSection = allSections.find(sec => sec.id === s.sectionId);
        return studentSection?.name?.trim() === selectedSectionName;
      });
    }
    
    // Filter tasks by subject (name-based matching)
    if (activeContext.subjectId && selectedSubjectName) {
      tasks = tasks.filter(t => {
        if (!t.subjectId) return false;
        const taskSubject = allSubjects.find(sub => sub.id === t.subjectId);
        return taskSubject?.name?.trim() === selectedSubjectName;
      });
    }
    
    // Filter groups to only those containing filtered students
    if (activeContext.classId || activeContext.sectionId) {
      const filteredStudentGroupIds = new Set(students.filter(s => s.groupId).map(s => s.groupId));
      groups = groups.filter(g => filteredStudentGroupIds.has(g.id));
    }
    
    // Filter evaluations to only those for filtered tasks
    if (activeContext.subjectId) {
      const filteredTaskIds = new Set(tasks.map(t => t.id));
      evaluations = evaluations.filter(e => filteredTaskIds.has(e.taskId));
    }
  }
  
  let targetTask = null;
  let summary = null;
  let filteredEvaluations = evaluations;

  if (taskId === 'global_rank') {
      // --- Global Rank Logic ---
      
      // Filter tasks and evaluations for teachers based on assigned subjects
      const currentUserType = stateManager.get('currentUserData')?.type;
      const currentTeacher = stateManager.get('currentTeacher');
      let filteredTasks = tasks;
      let filteredEvaluations = evaluations;
      
      if (currentUserType === 'teacher' && currentTeacher) {
          const assignedSubjects = currentTeacher.assignedSubjects || [];
          console.log('👨‍🏫 Teacher Global Rank: Filtering by assigned subjects:', assignedSubjects);
          
          // Filter tasks to only include those from assigned subjects
          filteredTasks = tasks.filter(t => t.subjectId && assignedSubjects.includes(t.subjectId));
          console.log('📊 Filtered tasks from', tasks.length, 'to', filteredTasks.length);
          
          // Filter evaluations to only include those for the filtered tasks
          const filteredTaskIds = new Set(filteredTasks.map(t => t.id));
          filteredEvaluations = evaluations.filter(e => filteredTaskIds.has(e.taskId));
          console.log('📊 Filtered evaluations from', evaluations.length, 'to', filteredEvaluations.length);
      }
      
      // 1. Calculate Stats using filtered evaluations and tasks
      const stats = _calculateStats(groups, students, filteredTasks, filteredEvaluations);
      
      // 2. Render Rankings (This is the core request)
      _renderTopGroups(stats.groupPerformanceData);
      _renderAcademicGroups(stats.academicGroupStats);
      _renderGroupsRanking(stats.groupPerformanceData, stats.groupRankingMeta);

      // 3. Update Titles & Labels
      if (elements.latestTaskTitle) {
          if (currentUserType === 'teacher') {
              elements.latestTaskTitle.textContent = 'সামগ্রিক পারফরম্যান্স (আমার এসাইনমেন্ট)';
              elements.latestTaskTitle.title = 'আমার নির্ধারিত বিষয়ের সকল এসাইনমেন্টের গড় ফলাফলের ভিত্তিতে';
          } else {
              elements.latestTaskTitle.textContent = 'সামগ্রিক পারফরম্যান্স (সকল এসাইনমেন্ট)';
              elements.latestTaskTitle.title = 'সকল এসাইনমেন্টের গড় ফলাফলের ভিত্তিতে';
          }
      }
      
      if (elements.assignmentStatusTitle) {
          elements.assignmentStatusTitle.textContent = 'গ্লোবাল পারফরম্যান্স স্ট্যাটাস';
      }
      if (elements.latestAssignmentLabel) {
          elements.latestAssignmentLabel.textContent = 'গ্লোবাল';
      }

      if (elements.latestAssignmentUpdated) {
          elements.latestAssignmentUpdated.textContent = 'হালনাগাদ';
      }

      // 4. Calculate Global Aggregate Data for Cards (using filtered data)
      // Total possible student-evaluations = Students * Filtered Tasks
      const totalPossibleEvaluations = students.length * filteredTasks.length;
      
      // Actual evaluations count (from filtered evaluations)
      let totalEvaluatedCount = 0;
      filteredEvaluations.forEach(e => {
          if (e.scores) totalEvaluatedCount += Object.keys(e.scores).length;
      });

      const globalAverage = stats.overallAssignmentAverage || 0;
      const progressPercent = totalPossibleEvaluations > 0 ? Math.round((totalEvaluatedCount / totalPossibleEvaluations) * 100) : 0;

      // 5. Update Progress Bar
      if (elements.progressBar) {
          void elements.progressBar.offsetHeight;
          setTimeout(() => {
              elements.progressBar.style.setProperty('width', `${progressPercent}%`, 'important');
          }, 50);
      }
      if (elements.progressBarLabel) {
          elements.progressBarLabel.textContent = `${helpers.convertToBanglaNumber(progressPercent)}%`;
      }

      // 6. Update Stats Cards (using filtered data)
      if (elements.latestAssignmentEvaluated) elements.latestAssignmentEvaluated.textContent = helpers.convertToBanglaNumber(totalEvaluatedCount);
      if (elements.latestAssignmentPending) elements.latestAssignmentPending.textContent = helpers.convertToBanglaNumber(totalPossibleEvaluations - totalEvaluatedCount);
      if (elements.latestAssignmentStudentTotal) elements.latestAssignmentStudentTotal.textContent = helpers.convertToBanglaNumber(totalPossibleEvaluations);

      // Group Stats (Evaluated = Groups * Filtered Tasks)
      const totalPossibleGroupEvaluations = groups.length * filteredTasks.length;
      let totalGroupEvaluatedCount = 0;
      // We can count unique group-task pairs in filtered evaluations
      const groupTaskPairs = new Set();
      filteredEvaluations.forEach(e => {
          if (e.groupId && e.taskId) groupTaskPairs.add(`${e.groupId}_${e.taskId}`);
      });
      totalGroupEvaluatedCount = groupTaskPairs.size;

      if (elements.latestAssignmentGroupEvaluated) elements.latestAssignmentGroupEvaluated.textContent = helpers.convertToBanglaNumber(totalGroupEvaluatedCount);
      if (elements.latestAssignmentGroupPending) elements.latestAssignmentGroupPending.textContent = helpers.convertToBanglaNumber(totalPossibleGroupEvaluations - totalGroupEvaluatedCount);
      if (elements.latestAssignmentGroupTotal) elements.latestAssignmentGroupTotal.textContent = helpers.convertToBanglaNumber(totalPossibleGroupEvaluations);

      // Average
      // Average
      
      // 1. Global Average for "Overall Progress"
      if (elements.overallProgress) elements.overallProgress.textContent = helpers.convertToBanglaNumber(globalAverage.toFixed(1));

      // 2. Latest Assignment Average for "Latest Assignment Average" Card
      // 2. Latest Assignment Average for "Latest Assignment Average" Card
      // We need to find the latest assignment that has evaluations to show meaningful data
      const sortedTasks = [...filteredTasks].sort((a, b) => _getTaskScheduleTimestamp(b) - _getTaskScheduleTimestamp(a));
      
      // Find the first task that has evaluations
      let targetTask = sortedTasks.find(t => filteredEvaluations.some(e => String(e.taskId) === String(t.id)));
      
      // Fallback to the absolute latest task if no evaluations found for any task
      if (!targetTask) {
          targetTask = sortedTasks[0];
      }

      let latestAvg = 0;
      if (targetTask) {
          const latestTaskEvals = filteredEvaluations.filter(e => String(e.taskId) === String(targetTask.id));
          const latestTaskStats = _calculateAssignmentAverageStats([targetTask], latestTaskEvals);
          latestAvg = latestTaskStats.assignmentAverageMap.get(String(targetTask.id)) || 0;
          
          // Update the Title and Date for the Latest Assignment Card
          if (elements.latestTaskTitle) {
              elements.latestTaskTitle.textContent = targetTask.title || targetTask.name || 'অজ্ঞাত এসাইনমেন্ট';
              elements.latestTaskTitle.title = targetTask.title || targetTask.name || '';
          }
          if (elements.latestAssignmentUpdated) {
              const ts = _getTaskScheduleTimestamp(targetTask);
              elements.latestAssignmentUpdated.textContent = ts ? _formatDateOnly(ts) : '-';
          }
      } else {
           if (elements.latestTaskTitle) elements.latestTaskTitle.textContent = '-';
           if (elements.latestAssignmentUpdated) elements.latestAssignmentUpdated.textContent = '-';
      }
      
      if (elements.latestAssignmentAverage) elements.latestAssignmentAverage.textContent = helpers.convertToBanglaNumber(latestAvg.toFixed(1));

      // Update Label for Global Rank
      if (elements.latestAssignmentAverageLabelText) {
          elements.latestAssignmentAverageLabelText.textContent = 'সর্বশেষ এসাইনমেন্ট গড়';
      }

      return; // Exit early for global rank
  }

  if (taskId === 'latest') {
    // Find the latest task first
    const fullStats = _calculateStats(groups, students, tasks, evaluations);
    const latestSummary = fullStats.latestAssignmentSummary;
    
    if (latestSummary && latestSummary.taskId) {
        targetTask = tasks.find(t => t.id === latestSummary.taskId);
        if (targetTask) {
            // Filter evaluations for the latest task
            filteredEvaluations = evaluations.filter(e => String(e.taskId) === String(targetTask.id));
            
            // Calculate stats based ONLY on this latest task's evaluations
            const stats = _calculateStats(groups, students, tasks, filteredEvaluations);
            summary = stats.latestAssignmentSummary;
            
            // Re-render dynamic sections with filtered stats
            _renderTopGroups(stats.groupPerformanceData);
            _renderAcademicGroups(stats.academicGroupStats);
            _renderGroupsRanking(stats.groupPerformanceData, stats.groupRankingMeta);

            // Update Label for Latest Task
            if (elements.latestAssignmentAverageLabelText) {
                elements.latestAssignmentAverageLabelText.textContent = 'সর্বশেষ এসাইনমেন্ট গড়';
            }
        }
    } else {
        // Fallback if no latest task found (e.g. no data)
        _renderTopGroups([]);
        _renderAcademicGroups({});
        _renderGroupsRanking([], null);
    }
  } else {
    // Filter for specific task
    targetTask = tasks.find(t => String(t.id) === String(taskId));
    if (targetTask) {
       filteredEvaluations = evaluations.filter(e => String(e.taskId) === String(targetTask.id));
       
       // Calculate stats based ONLY on this task's evaluations
       const stats = _calculateStats(groups, students, tasks, filteredEvaluations);
       summary = stats.latestAssignmentSummary; // This will effectively be the summary for the target task

       // Re-render dynamic sections with filtered stats
       _renderTopGroups(stats.groupPerformanceData);
       _renderAcademicGroups(stats.academicGroupStats);
       _renderGroupsRanking(stats.groupPerformanceData, stats.groupRankingMeta);

       // Update Label for Specific Task
       if (elements.latestAssignmentAverageLabelText) {
           elements.latestAssignmentAverageLabelText.textContent = 'এসাইনমেন্ট গড়';
       }
    }
  }

  if (!targetTask) return;

  // Fallback summary if calculation returns null (e.g. no timestamp or no evaluations)
  if (!summary) {
      // Count how many groups have evaluations for this specific task
      const evaluatedGroupIdsForTask = new Set();
      filteredEvaluations.forEach(e => {
          if (e.groupId) evaluatedGroupIdsForTask.add(e.groupId);
      });
      
      // Count evaluated students for this task
      let evaluatedStudentCount = 0;
      filteredEvaluations.forEach(e => {
          if (e.scores) evaluatedStudentCount += Object.keys(e.scores).length;
      });
      
      summary = {
          taskId: targetTask.id,
          taskTitle: targetTask.name,
          evaluated: evaluatedStudentCount,
          total: students.length,
          groupsEvaluated: evaluatedGroupIdsForTask.size,
          groupTotal: groups.length,
      };
  }

  // Update UI Elements
  if (elements.latestTaskTitle) elements.latestTaskTitle.textContent = targetTask.name;
  if (elements.latestTaskTitle) elements.latestTaskTitle.title = targetTask.name;
  
  // Update Status Title
  if (elements.assignmentStatusTitle) {
      if (taskId === 'latest') {
          elements.assignmentStatusTitle.textContent = 'সর্বশেষ এসাইনমেন্ট ফলাফল প্রদান তথ্য';
          if (elements.latestAssignmentLabel) elements.latestAssignmentLabel.textContent = 'সর্বশেষ এসাইনমেন্ট';
      } else {
          // Check if forced
          const config = stateManager.getDashboardConfig();
          const isForced = config.isForced && String(config.forceAssignmentId) === String(taskId);
          
          elements.assignmentStatusTitle.innerHTML = isForced 
            ? 'এসাইনমেন্ট ফলাফল প্রদান তথ্য <span class="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">ম্যানুয়াল ফোর্স</span>'
            : 'এসাইনমেন্ট ফলাফল প্রদান তথ্য';
            
          if (elements.latestAssignmentLabel) elements.latestAssignmentLabel.textContent = 'এসাইনমেন্ট';
      }
  }

  if (elements.latestAssignmentUpdated) {
    const ts = _getTaskScheduleTimestamp(targetTask);
    elements.latestAssignmentUpdated.textContent = _formatDateTime(ts);
  }

  // Update Progress Bar
  // Switch to Student-based progress as it's more reliable (Group stats might be 0 if groupId is missing)
  const totalEvaluationsNeeded = summary.total !== undefined ? summary.total : (summary.totalStudentCount || students.length);
  const evaluatedCount = summary.evaluated !== undefined ? summary.evaluated : (summary.evaluatedStudentCount || 0);
  
  const progressPercent = totalEvaluationsNeeded > 0 ? Math.round((evaluatedCount / totalEvaluationsNeeded) * 100) : 0;
  
  console.log('📊 Progress Update (Student-based):', { 
      task: targetTask.name, 
      evaluated: evaluatedCount, 
      total: totalEvaluationsNeeded, 
      percent: progressPercent 
  });

  if (elements.progressBar) {
      // Force a reflow before setting width
      void elements.progressBar.offsetHeight;
      
      // Use setTimeout to ensure DOM is ready and transition triggers
      setTimeout(() => {
          elements.progressBar.style.setProperty('width', `${progressPercent}%`, 'important');
      }, 50);
  }
  if (elements.progressBarLabel) {
      elements.progressBarLabel.textContent = `${helpers.convertToBanglaNumber(progressPercent)}%`;
  }

  // Update Student Stats
  // FIX: Use 'evaluated' and 'total' keys as returned by _calculateLatestAssignmentSummary
  const evaluatedStudentCount = summary.evaluated !== undefined ? summary.evaluated : (summary.evaluatedStudentCount || 0);
  const totalStudentCount = summary.total !== undefined ? summary.total : (summary.totalStudentCount || 0);
  
  if (elements.latestAssignmentEvaluated) elements.latestAssignmentEvaluated.textContent = helpers.convertToBanglaNumber(evaluatedStudentCount);
  if (elements.latestAssignmentPending) elements.latestAssignmentPending.textContent = helpers.convertToBanglaNumber(totalStudentCount - evaluatedStudentCount);
  if (elements.latestAssignmentStudentTotal) elements.latestAssignmentStudentTotal.textContent = helpers.convertToBanglaNumber(totalStudentCount);

  // Update Group Stats
  // FIX: Use 'groupsEvaluated' and 'groupTotal' keys as returned by _calculateLatestAssignmentSummary
  const evaluatedGroupCount = summary.groupsEvaluated !== undefined ? summary.groupsEvaluated : (summary.evaluatedGroupCount || 0);
  const totalGroupCount = summary.groupTotal !== undefined ? summary.groupTotal : groups.length; 
  
  if (elements.latestAssignmentGroupEvaluated) elements.latestAssignmentGroupEvaluated.textContent = helpers.convertToBanglaNumber(evaluatedGroupCount);
  if (elements.latestAssignmentGroupPending) elements.latestAssignmentGroupPending.textContent = helpers.convertToBanglaNumber(totalGroupCount - evaluatedGroupCount);
  if (elements.latestAssignmentGroupTotal) elements.latestAssignmentGroupTotal.textContent = helpers.convertToBanglaNumber(totalGroupCount);

  // Update Average & Overall
  // Note: For specific assignment, "Overall Progress" might just be that assignment's average or kept as global. 
  // The user request implies seeing data for *that* assignment.
  // Let's calculate the average for this specific assignment.
  
  const assignmentAverageStats = _calculateAssignmentAverageStats([targetTask], filteredEvaluations);
  const avg = assignmentAverageStats.assignmentAverageMap.get(String(targetTask.id)) || 0;
  
  if (elements.latestAssignmentAverage) elements.latestAssignmentAverage.textContent = helpers.convertToBanglaNumber(avg.toFixed(1));
  
  // Calculate Global Average for "Overall Progress" (Always Global)
  const globalStatsForOverall = _calculateAssignmentAverageStats(tasks, evaluations);
  const globalAverage = globalStatsForOverall.overallAverage || 0;

  if (elements.overallProgress) elements.overallProgress.textContent = helpers.convertToBanglaNumber(globalAverage.toFixed(1));

}

// --- Calculation Logic ---
function _calculateStats(groups = [], students = [], tasks = [], evaluations = []) {
  const totalGroups = groups.length;
  const totalStudents = students.length;
  const totalTasks = tasks.length;
  const { male: maleStudents, female: femaleStudents } = _calculateGenderBuckets(students);
  const malePercentage = totalStudents > 0 ? (maleStudents / totalStudents) * 100 : 0;
  const femalePercentage = totalStudents > 0 ? (femaleStudents / totalStudents) * 100 : 0;
  const academicGroups = new Set(students.map((s) => s.academicGroup).filter(Boolean));
  const totalAcademicGroups = academicGroups.size;
  const pendingRoles = students.filter((s) => !s.role || s.role === '').length;

  const groupPerformanceData = _calculateGroupPerformance(groups, students, evaluations, tasks);
  const groupRankingMeta = _calculateLeaderboardRankingMeta(groups, students, evaluations);
  const validGroupPerformances = groupPerformanceData.filter((g) => g.evalCount > 0);
  const totalOverallScore = validGroupPerformances.reduce((acc, group) => acc + group.averageScore, 0);
  const groupOverallProgress =
    validGroupPerformances.length > 0 ? totalOverallScore / validGroupPerformances.length : 0;

  const completedEvaluationIds = new Set(evaluations.map((e) => `${e.taskId}_${e.groupId}`));
  let pendingEvaluations = 0;
  if (tasks.length > 0 && groups.length > 0) {
    for (const task of tasks) {
      for (const group of groups) {
        if (!completedEvaluationIds.has(`${task.id}_${group.id}`)) pendingEvaluations++;
      }
    }
  }
  const academicGroupStats = _calculateAcademicGroupStats(students, groupPerformanceData);
  const latestAssignmentSummary = _calculateLatestAssignmentSummary(groups, students, tasks, evaluations);
  const assignmentAverageStats = _calculateAssignmentAverageStats(tasks, evaluations);
  const assignmentSummaries = assignmentAverageStats.assignmentSummaries;
  const hasAssignmentAverage = assignmentSummaries.length > 0;
  const overallAssignmentAverage = hasAssignmentAverage ? assignmentAverageStats.overallAverage : 0;
  const overallProgress = hasAssignmentAverage ? overallAssignmentAverage : groupOverallProgress;
  const assignmentOverview = _buildAssignmentOverview(tasks, latestAssignmentSummary);
  const latestAssignmentAverage =
    latestAssignmentSummary?.taskId && assignmentAverageStats.assignmentAverageMap
      ? assignmentAverageStats.assignmentAverageMap.get(String(latestAssignmentSummary.taskId)) ?? null
      : null;
  return {
    totalGroups,
    totalStudents,
    totalTasks,
    maleStudents,
    femaleStudents,
    malePercentage,
    femalePercentage,
    totalAcademicGroups,
    pendingRoles,
    pendingEvaluations,
    overallProgress,
    overallAssignmentAverage,
    latestAssignmentAverage,
    assignmentSummaries,
    groupPerformanceData,
    groupRankingMeta,
    academicGroupStats,
    latestAssignmentSummary,
    assignmentOverview,
  };
}

function _calculateGenderBuckets(students = []) {
  return students.reduce(
    (acc, student) => {
      const detected = _normalizeGender(student.gender);
      if (detected === 'male') acc.male++;
      else if (detected === 'female') acc.female++;
      return acc;
    },
    { male: 0, female: 0 }
  );
}

function _normalizeGender(value) {
  const raw = (value || '').toString().trim();
  if (!raw) return '';
  const normalized = raw.normalize('NFC').toLowerCase().replace(/\s+/g, '');
  const banglaAligned = normalized.replace(/য়/g, 'য়');
  if (
    banglaAligned.includes('ছেলে') ||
    normalized.includes('male') ||
    normalized.includes('boy') ||
    normalized === 'm'
  ) {
    return 'male';
  }
  if (
    banglaAligned.includes('মেয়ে') ||
    normalized.includes('female') ||
    normalized.includes('girl') ||
    normalized === 'f'
  ) {
    return 'female';
  }
  return '';
}

function _calculateGroupPerformance(groups, students, evaluations, tasks) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));

  return groups
    .map((group) => {
      const groupStudents = students.filter((s) => s.groupId === group.id);
      const groupEvals = evaluations.filter((e) => e.groupId === group.id);
      
      let totalScoreSum = 0;
      let totalMaxScoreSum = 0;
      let validEvalsCount = 0;
      
      const evaluatedMemberIds = new Set();
      const taskIds = new Set();
      let latestEvalMeta = { ts: 0, avgPct: null, participants: null, participationRate: null };
      
      groupEvals.forEach((evaluation) => {
        const participantCount = evaluation?.scores ? Object.keys(evaluation.scores).length : 0;
        
        // Calculate total score and max score for this evaluation
        let evalTotalScore = 0;
        let evalStudentCount = 0;
        if (evaluation?.scores) {
           Object.values(evaluation.scores).forEach(scoreData => {
               evalTotalScore += parseFloat(scoreData.totalScore) || 0;
               evalStudentCount++;
           });
        }
        
        const task = taskMap.get(evaluation.taskId);
        const maxScorePerStudent = parseFloat(task?.maxScore) || parseFloat(evaluation.maxPossibleScore) || 100;
        const evalMaxScore = maxScorePerStudent * evalStudentCount;

        if (evalStudentCount > 0 && maxScorePerStudent > 0) {
            totalScoreSum += evalTotalScore;
            totalMaxScoreSum += evalMaxScore;
            validEvalsCount++;
        }

        // Calculate Average Percent for Latest Eval Meta (keep as is for display if needed, or update)
        const evalAvgPct = _getEvaluationAveragePercent(evaluation, taskMap);

        if (evaluation?.scores) {
          Object.keys(evaluation.scores).forEach((studentId) => {
            if (studentId) evaluatedMemberIds.add(studentId);
          });
        }
        if (evaluation?.taskId) taskIds.add(evaluation.taskId);

        const evalTs =
          _normalizeTimestamp(evaluation.taskDate) ||
          _normalizeTimestamp(evaluation.updatedAt) ||
          _normalizeTimestamp(evaluation.createdAt);
        if (evalTs && evalTs >= (latestEvalMeta.ts || 0)) {
          const partRate =
            groupStudents.length > 0 ? Math.min(100, (participantCount / groupStudents.length) * 100) : 0;
          latestEvalMeta = {
            ts: evalTs,
            avgPct: typeof evalAvgPct === 'number' ? evalAvgPct : latestEvalMeta.avgPct,
            participants: participantCount,
            participationRate: partRate,
          };
        }
      });

      // Weighted Average Calculation
      const averageScore = totalMaxScoreSum > 0 ? (totalScoreSum / totalMaxScoreSum) * 100 : 0;
      
      const evaluatedMembers = evaluatedMemberIds.size;
      const taskCount = taskIds.size;
      const participationRate =
        groupStudents.length > 0 ? Math.min(100, (evaluatedMembers / groupStudents.length) * 100) : 0;
      return {
        group,
        groupName: group.name,
        studentCount: groupStudents.length,
        averageScore: averageScore,
        evalCount: validEvalsCount,
        evaluatedMembers,
        taskCount,
        participationRate,
        latestAverageScore: latestEvalMeta.avgPct,
        latestParticipantCount: latestEvalMeta.participants,
        latestParticipationRate: latestEvalMeta.participationRate,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);
}

function _calculateLeaderboardRankingMeta(groups = [], students = [], evaluations = []) {
  if (!Array.isArray(groups) || !Array.isArray(students) || !Array.isArray(evaluations)) {
    return { list: [], map: new Map() };
  }

  const studentToGroup = new Map(students.map((student) => [String(student.id), _normalizeGroupId(student.groupId)]));
  const groupSize = {};
  students.forEach((student) => {
    const gid = _normalizeGroupId(student.groupId);
    groupSize[gid] = (groupSize[gid] || 0) + 1;
  });

  const groupAgg = {};
  evaluations.forEach((evaluation) => {
    const maxScore = parseFloat(evaluation.maxPossibleScore) || 60;
    const ts =
      _normalizeTimestamp(evaluation.taskDate) ||
      _normalizeTimestamp(evaluation.updatedAt) ||
      _normalizeTimestamp(evaluation.createdAt);
    const scores = evaluation.scores || {};
    const countedGroups = new Set();
    Object.entries(scores).forEach(([rawStudentId, scoreData]) => {
      const sid = rawStudentId != null ? String(rawStudentId) : '';
      const gid = studentToGroup.get(sid) || '__none';
      const normalizedGroupId = _normalizeGroupId(gid);
      if (!groupAgg[normalizedGroupId]) {
        groupAgg[normalizedGroupId] = {
          evalCount: 0,
          totalScore: 0,
          maxScoreSum: 0,
          latestMs: null,
          participants: new Set(),
        };
      }
      const rec = groupAgg[normalizedGroupId];
      if (!countedGroups.has(normalizedGroupId)) {
        rec.evalCount += 1;
        countedGroups.add(normalizedGroupId);
      }
      
      const currentMaxScore = maxScore > 0 ? maxScore : 100;
      const currentTotalScore = parseFloat(scoreData?.totalScore) || 0;

      rec.totalScore += currentTotalScore;
      rec.maxScoreSum += currentMaxScore;
      
      rec.participants.add(sid);
      if (ts) rec.latestMs = rec.latestMs ? Math.max(rec.latestMs, ts) : ts;
    });
  });

  const ranked = Object.entries(groupAgg)
    .map(([gid, agg]) => {
      if (agg.evalCount < MIN_EVALUATIONS_FOR_RANKING) return null;
      
      // Use Weighted Average: Total Score / Total Max Score
      const efficiency = agg.maxScoreSum > 0 ? (agg.totalScore / agg.maxScoreSum) * 100 : 0;
      
      const size = groupSize[gid] || 0;
      const participantsCount = agg.participants.size;
      return {
        groupId: gid,
        efficiency,
        evalCount: agg.evalCount,
        totalScore: agg.totalScore,
        maxScoreSum: agg.maxScoreSum,
        latestEvaluationMs: agg.latestMs || 0,
        participantsCount,
        groupSize: size,
        remainingCount: Math.max(0, size - participantsCount),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
      if (b.evalCount !== a.evalCount) return b.evalCount - a.evalCount;
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return (b.latestEvaluationMs || 0) - (a.latestEvaluationMs || 0);
    });

  ranked.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return {
    list: ranked,
    map: new Map(ranked.map((entry) => [entry.groupId, entry])),
  };
}

function _normalizeGroupId(value) {
  if (value === null || value === undefined || value === '') return '__none';
  return String(value);
}

function _getEvaluationAveragePercent(evaluation, taskMap) {
  if (!evaluation) return null;
  const avgEvalScorePercent = parseFloat(evaluation.groupAverageScore);
  if (!Number.isNaN(avgEvalScorePercent)) return avgEvalScorePercent;

  if (!evaluation.scores) return null;
  const task = taskMap.get(String(evaluation.taskId));
  const maxScore = parseFloat(task?.maxScore) || parseFloat(evaluation.maxPossibleScore) || 100;
  if (!(maxScore > 0)) return null;

  let evalScoreSum = 0;
  let studentCountInEval = 0;
  Object.values(evaluation.scores).forEach((scoreData) => {
    evalScoreSum += parseFloat(scoreData.totalScore) || 0;
    studentCountInEval++;
  });
  if (studentCountInEval === 0) return null;
  return (evalScoreSum / studentCountInEval / maxScore) * 100;
}

function _calculateLatestAssignmentSummary(groups = [], students = [], tasks = [], evaluations = []) {
  const fallbackTaskMeta = _findLatestTaskMeta(tasks);
  if (!evaluations.length && !fallbackTaskMeta) return null;

  const groupStudentCounts = new Map(groups.map((group) => [group.id, 0]));
  students.forEach((student) => {
    const gid = student.groupId;
    if (!gid) return;
    if (!groupStudentCounts.has(gid)) groupStudentCounts.set(gid, 0);
    groupStudentCounts.set(gid, groupStudentCounts.get(gid) + 1);
  });

  let latestEvaluation = null;
  evaluations.forEach((evaluation) => {
    const ts =
      _normalizeTimestamp(evaluation.taskDate) ||
      _normalizeTimestamp(evaluation.updatedAt) ||
      _normalizeTimestamp(evaluation.createdAt);
    if (!latestEvaluation || ts > latestEvaluation.ts) {
      latestEvaluation = { ts, taskId: evaluation.taskId };
    }
  });

  const latestTaskId = latestEvaluation?.taskId || fallbackTaskMeta?.id;
  if (!latestTaskId) return null;
  const taskInfo = tasks.find((task) => task.id === latestTaskId) || fallbackTaskMeta?.task || null;
  const taskTitle =
    taskInfo?.title ||
    taskInfo?.name ||
    fallbackTaskMeta?.task?.title ||
    fallbackTaskMeta?.task?.name ||
    'সর্বশেষ অ্যাসাইনমেন্ট';

  const scheduledTs = _getTaskScheduleTimestamp(taskInfo) || fallbackTaskMeta?.ts || 0;
  const scheduledTimeParts = _extractTaskTime(taskInfo) || fallbackTaskMeta?.timeParts || null;
  const scheduledTimeDisplay = _formatTimeFromParts(scheduledTimeParts);

  const assignmentGroupIds = new Set();

  let hasExplicitAssignmentMeta = false;

  const groupCandidateKeys = [
    'assignedGroupIds',

    'targetGroupIds',

    'groupIds',

    'assignedGroups',

    'groups',

    'targets',

    'selectedGroups',

    'participantGroups',

    'assignmentTargets',
  ];

  const pushGroupCandidate = (candidate, fromExplicitSource = false, depth = 0) => {
    if (candidate === undefined || candidate === null || depth > 6) return;

    if (Array.isArray(candidate)) {
      candidate.forEach((value) => pushGroupCandidate(value, fromExplicitSource, depth + 1));

      return;
    }

    if (typeof candidate === 'object') {
      if ('id' in candidate || 'groupId' in candidate || 'value' in candidate) {
        pushGroupCandidate(candidate.id ?? candidate.groupId ?? candidate.value, fromExplicitSource, depth + 1);

        return;
      }

      if (candidate.group) {
        pushGroupCandidate(candidate.group.id ?? candidate.group.groupId, fromExplicitSource, depth + 1);

        return;
      }

      Object.values(candidate).forEach((value) => pushGroupCandidate(value, fromExplicitSource, depth + 1));

      return;
    }

    const normalized = typeof candidate === 'string' ? candidate.trim() : candidate;

    if (normalized !== undefined && normalized !== null && normalized !== '') {
      assignmentGroupIds.add(normalized);

      if (fromExplicitSource) hasExplicitAssignmentMeta = true;
    }
  };

  if (taskInfo) {
    if (taskInfo.assignToAllGroups || taskInfo.assignmentScope === 'all' || taskInfo.targetScope === 'all') {
      groups.forEach((group) => pushGroupCandidate(group.id, true));
    }

    groupCandidateKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(taskInfo, key)) {
        pushGroupCandidate(taskInfo[key], true);
      }
    });
  }

  const evalsForTask = evaluations.filter((evaluation) => evaluation.taskId === latestTaskId);

  const evaluatedGroupIds = new Set();

  let evaluatedStudents = 0;

  evalsForTask.forEach((evaluation) => {
    if (evaluation.groupId) {
      evaluatedGroupIds.add(evaluation.groupId);

      pushGroupCandidate(evaluation.groupId, false);
    }

    const participantCount = evaluation?.scores
      ? Object.keys(evaluation.scores).length
      : Number(evaluation.participantCount) || 0;

    evaluatedStudents += participantCount;
  });

  if (!assignmentGroupIds.size || !hasExplicitAssignmentMeta) {
    groups.forEach((group) => {
      if (group?.id !== undefined && group?.id !== null) assignmentGroupIds.add(group.id);
    });
  }

  let totalEligible = 0;

  assignmentGroupIds.forEach((groupId) => {
    totalEligible += groupStudentCounts.get(groupId) || 0;
  });

  if (totalEligible === 0) {
    totalEligible = students.length;
  }

  if (totalEligible === 0) totalEligible = evaluatedStudents;

  evaluatedStudents = Math.min(evaluatedStudents, totalEligible);

  const pendingStudents = Math.max(totalEligible - evaluatedStudents, 0);

  const completionPercent = totalEligible > 0 ? Math.min(100, (evaluatedStudents / totalEligible) * 100) : 0;

  const groupTotal = assignmentGroupIds.size || groups.length || evaluatedGroupIds.size;

  const groupsEvaluated = evaluatedGroupIds.size;

  const groupsPending = Math.max((groupTotal || 0) - groupsEvaluated, 0);

  return {
    taskId: latestTaskId,
    taskTitle,
    evaluated: evaluatedStudents,
    pending: pendingStudents,
    total: totalEligible,
    completionPercent,
    lastUpdated: latestEvaluation?.ts || scheduledTs || Date.now(),
    scheduledTimeDisplay,
    groupTotal,
    groupsEvaluated,
    groupsPending,
  };
}

function _calculateAssignmentAverageStats(tasks = [], evaluations = []) {
  if (!evaluations.length) {
    return { assignmentSummaries: [], overallAverage: 0, assignmentAverageMap: new Map() };
  }
  // Use String keys for robust matching
  const taskMap = new Map(tasks.map((task) => [String(task.id), task]));
  const aggregates = new Map();

  evaluations.forEach((evaluation) => {
    if (!evaluation.taskId) return;
    const taskIdStr = String(evaluation.taskId);
    
    const avgPct = _getEvaluationAveragePercent(evaluation, taskMap);
    if (typeof avgPct !== 'number' || Number.isNaN(avgPct)) return;
    
    if (!aggregates.has(taskIdStr)) {
      aggregates.set(taskIdStr, { total: 0, count: 0 });
    }
    const agg = aggregates.get(taskIdStr);
    agg.total += avgPct;
    agg.count++;
  });

  const assignmentSummaries = [];
  const assignmentAverageMap = new Map();
  aggregates.forEach((bucket, taskId) => {
    if (!bucket.count) return;
    const taskInfo = taskMap.get(taskId);
    const averagePercent = bucket.total / bucket.count;
    assignmentSummaries.push({
      taskId,
      taskTitle: taskInfo?.title || taskInfo?.name || 'অজ্ঞাত এসাইনমেন্ট',
      averagePercent,
      evaluationCount: bucket.count,
    });
    assignmentAverageMap.set(taskId, averagePercent);
  });

  const overallAverage = assignmentSummaries.length
    ? assignmentSummaries.reduce((sum, summary) => sum + summary.averagePercent, 0) / assignmentSummaries.length
    : 0;

  return { assignmentSummaries, overallAverage, assignmentAverageMap };
}

function _buildAssignmentOverview(tasks = [], latestAssignmentSummary = null) {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  const latestTaskId = latestAssignmentSummary?.taskId || null;
  return tasks
    .map((task) => {
      const timestamp = _getTaskScheduleTimestamp(task);
      const title = task.title || task.name || 'অনির্ধারিত এসাইনমেন্ট';
      const identifier = task.id ?? task.uid ?? task.key ?? `${title}-${timestamp || Date.now()}`;
      return {
        id: identifier,
        title,
        timestamp,
        dateLabel: timestamp ? _formatDateOnly(timestamp) : 'তারিখ নির্ধারিত নয়',
      };
    })
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 6)
    .map((item, index) => {
      const isLatest = latestTaskId ? item.id === latestTaskId : index === 0;
      return {
        ...item,
        index: index + 1,
        isLatest,
        relativeLabel: _getRelativeDayLabel(item.timestamp),
      };
    });
}

function _getRelativeDayLabel(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((dateOnly - todayOnly) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'আজ';
  const absDiff = Math.abs(diffDays);
  const formatted =
    helpers?.convertToBanglaNumber && typeof helpers.convertToBanglaNumber === 'function'
      ? helpers.convertToBanglaNumber(String(absDiff))
      : String(absDiff);
  return diffDays > 0 ? `${formatted} দিন বাকি` : `${formatted} দিন আগে`;
}

function _calculateAcademicGroupStats(students, groupPerformanceData) {
  const stats = {};
  const groupPerfMap = new Map(groupPerformanceData.map((gp) => [gp.group.id, gp.averageScore]));
  students.forEach((student) => {
    const ag = student.academicGroup;
    const groupId = student.groupId;
    if (!ag || !groupId) return;
    if (!stats[ag]) {
      stats[ag] = { totalStudents: 0, scoreSum: 0, groupCount: 0, processedGroups: new Set() };
    }
    stats[ag].totalStudents++;
    if (groupPerfMap.has(groupId) && !stats[ag].processedGroups.has(groupId) && groupPerfMap.get(groupId) > 0) {
      stats[ag].scoreSum += groupPerfMap.get(groupId);
      stats[ag].groupCount++;
      stats[ag].processedGroups.add(groupId);
    }
  });
  Object.keys(stats).forEach((ag) => {
    const data = stats[ag];
    data.averageScore = data.groupCount > 0 ? data.scoreSum / data.groupCount : 0;
  });
  return stats;
}

// --- DOM Rendering Functions ---
/** Renders the calculated statistics into the DOM elements. */
function _renderStats(stats) {
  const setText = (element, value) => {
    if (element) element.textContent = value ?? '-';
  };
  const formatNum = (num, decimals = 0) => {
    if (typeof num !== 'number' || isNaN(num)) return '-';
    return helpers.convertToBanglaNumber(num.toFixed(decimals));
  };
  setText(elements.totalGroups, formatNum(stats.totalGroups));
  setText(elements.totalStudents, formatNum(stats.totalStudents));
  setText(elements.totalAcademicGroups, formatNum(stats.totalAcademicGroups));
  setText(elements.pendingRoles, formatNum(stats.pendingRoles));
  setText(elements.maleStudents, formatNum(stats.maleStudents));
  setText(elements.malePercentage, `${formatNum(stats.malePercentage, 0)}%`);
  setText(elements.femaleStudents, formatNum(stats.femaleStudents));
  setText(elements.femalePercentage, `${formatNum(stats.femalePercentage, 0)}%`);
  setText(elements.totalTasks, formatNum(stats.totalTasks));
  setText(elements.pendingEvaluations, formatNum(stats.pendingEvaluations));

  const latestSummary = stats.latestAssignmentSummary || null;
  const latestCompletion = latestSummary ? Math.min(100, Math.max(0, Number(latestSummary.completionPercent) || 0)) : 0;
  const latestEvaluated = latestSummary ? formatNum(latestSummary.evaluated) : '-';
  const latestPending = latestSummary ? formatNum(latestSummary.pending) : '-';
  const latestTotal = latestSummary ? formatNum(latestSummary.total) : '-';
  const latestGroupsEvaluated = latestSummary ? formatNum(latestSummary.groupsEvaluated) : '-';
  const latestGroupsPending = latestSummary ? formatNum(latestSummary.groupsPending) : '-';
  const latestGroupTotal = latestSummary ? formatNum(latestSummary.groupTotal) : '-';
  const latestDateLabel = latestSummary ? _formatDateOnly(latestSummary.lastUpdated) : '-';
  let latestTimeLabel = latestSummary ? _formatTimeOnly(latestSummary.lastUpdated) : '-';
  if (latestTimeLabel === '-' && latestSummary?.scheduledTimeDisplay) {
    latestTimeLabel = latestSummary.scheduledTimeDisplay;
  }
  const latestComposite =
    latestDateLabel === '-' && latestTimeLabel === '-' ? '-' : `: ${latestDateLabel} | সময়: ${latestTimeLabel}`;

  if (elements.latestTaskTitle) {
    const title = latestSummary?.taskTitle || 'সর্বশেষ এসাইনমেন্ট';
    setText(elements.latestTaskTitle, title);
    elements.latestTaskTitle.setAttribute('title', title);
  }
  if (elements.latestAssignmentUpdated) {
    setText(elements.latestAssignmentUpdated, latestComposite);
  }
  if (elements.latestAssignmentEvaluated) setText(elements.latestAssignmentEvaluated, latestEvaluated);
  if (elements.latestAssignmentPending) setText(elements.latestAssignmentPending, latestPending);
  if (elements.latestAssignmentStudentTotal) setText(elements.latestAssignmentStudentTotal, latestTotal);
  if (elements.latestAssignmentGroupEvaluated) setText(elements.latestAssignmentGroupEvaluated, latestGroupsEvaluated);
  if (elements.latestAssignmentGroupPending) setText(elements.latestAssignmentGroupPending, latestGroupsPending);
  if (elements.latestAssignmentGroupTotal) setText(elements.latestAssignmentGroupTotal, latestGroupTotal);

  const hasAssignmentAverageData =
    Array.isArray(stats.assignmentSummaries) &&
    stats.assignmentSummaries.length > 0 &&
    typeof stats.overallAssignmentAverage === 'number' &&
    !Number.isNaN(stats.overallAssignmentAverage);
  const latestAssignmentAverageValue =
    typeof stats.latestAssignmentAverage === 'number' && !isNaN(stats.latestAssignmentAverage)
      ? Math.min(100, Math.max(0, stats.latestAssignmentAverage))
      : null;
  const overallImprovementSource = hasAssignmentAverageData ? stats.overallAssignmentAverage : stats.overallProgress;
  const progressValue =
    typeof overallImprovementSource === 'number' && !isNaN(overallImprovementSource)
      ? Math.min(100, Math.max(0, overallImprovementSource))
      : 0;
  setText(elements.overallProgress, `${formatNum(progressValue, 0)}%`);
  if (elements.latestAssignmentAverage) {
    if (latestAssignmentAverageValue !== null) {
      setText(elements.latestAssignmentAverage, `${formatNum(latestAssignmentAverageValue, 0)}%`);
    } else {
      elements.latestAssignmentAverage.textContent = '-';
    }
  }

  if (elements.overallProgressCircle) {
    const progressDeg = (progressValue / 100) * 360;
    // Fixed Sky Palette for Overall Progress
    const skySolid = '#0ea5e9'; 
    const skySoft = 'rgba(14,165,233,0.1)';
    elements.overallProgressCircle.style.background = `conic-gradient(${skySolid} ${progressDeg}deg, ${skySoft} ${progressDeg}deg)`;
    elements.overallProgressCircle.style.boxShadow = `0 0 20px rgba(14,165,233,0.3)`;
  }
  if (elements.overallProgress) {
    // elements.overallProgress.style.color = circlePalette.solid; // Keep text color consistent with theme
  }
  if (elements.latestAssignmentCircle && latestAssignmentAverageValue !== null) {
    const latestDeg = (latestAssignmentAverageValue / 100) * 360;
    // Fixed Emerald Palette for Latest Assignment
    const emeraldSolid = '#10b981';
    const emeraldSoft = 'rgba(16,185,129,0.1)';
    elements.latestAssignmentCircle.style.background = `conic-gradient(${emeraldSolid} ${latestDeg}deg, ${emeraldSoft} ${latestDeg}deg)`;
    elements.latestAssignmentCircle.style.boxShadow = `0 0 20px rgba(16,185,129,0.3)`;
    
    if (elements.latestAssignmentAverage) {
      // elements.latestAssignmentAverage.style.color = latestCirclePalette.solid; // Keep text color consistent with theme
    }
  }

  if (elements.progressBar) {
    const bar = elements.progressBar;
    const barPalette = _getScorePalette(latestCompletion);
    const target = Math.max(0, Math.min(100, latestCompletion));
    const prev = Number(bar.dataset.prevWidth || 0);

    // keep original layout classes; only add animation helpers
    bar.classList.add('battery-liquid', 'shadow-lg');
    bar.style.setProperty('--fill', barPalette.solid);
    bar.style.boxShadow = `0 8px 20px ${barPalette.shadow}`;
    bar.style.transition = 'width 900ms cubic-bezier(0.4, 0, 0.2, 1)';

    if (prev !== target) {
      bar.style.width = `${prev}%`;
      // force a reflow so the transition runs when width updates
      void bar.offsetWidth;
      requestAnimationFrame(() => {
        bar.style.width = `${target}%`;
      });
    } else {
      bar.style.width = `${target}%`;
    }

    bar.dataset.prevWidth = String(target);
  }
  if (elements.progressBarLabel) {
    const labelValue = `${formatNum(latestCompletion, 0)}%`;
    elements.progressBarLabel.textContent = labelValue;
    const anchorRight = latestCompletion >= 20;
    elements.progressBarLabel.style.right = anchorRight ? '8px' : 'auto';
    elements.progressBarLabel.style.left = anchorRight ? 'auto' : '8px';
    elements.progressBarLabel.style.color = 'rgba(255,255,255,0.92)';
    elements.progressBarLabel.style.minWidth = '32px';
    elements.progressBarLabel.style.textAlign = anchorRight ? 'right' : 'left';
  }

  _renderAssignmentOverview(stats.assignmentOverview || [], latestSummary);
}

function _renderAssignmentOverview(overviewItems = [], latestSummary = null) {
  if (!elements.assignmentOverviewList) return;
  const formatBanglaNumber = (value) =>
    helpers?.convertToBanglaNumber && typeof helpers.convertToBanglaNumber === 'function'
      ? helpers.convertToBanglaNumber(String(value))
      : String(value);

  if (!overviewItems.length) {
    elements.assignmentOverviewList.innerHTML =
      '<div class="py-4 text-sm text-gray-500 dark:text-gray-400">কোন এসাইনমেন্ট তথ্য পাওয়া যায়নি।</div>';
  } else {
    const rows = overviewItems
      .map((item) => {
        const serial = formatBanglaNumber(item.index);
        const latestBadge = item.isLatest
          ? '<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-600 dark:text-emerald-300"><i class="fas fa-bolt text-[0.6rem]"></i> সর্বশেষ</span>'
          : '';
        const relative = item.relativeLabel
          ? `<p class="text-xs text-gray-500 dark:text-gray-400">${_escapeHtml(item.relativeLabel)}</p>`
          : '';
        const safeTitle = _escapeHtml(item.title);
        return `
          <div class="flex items-center justify-between gap-4 py-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-sm font-semibold text-indigo-600 dark:text-indigo-300">${serial}</span>
              <div class="min-w-0 space-y-1">
                <p class="text-sm font-semibold text-gray-900 dark:text-white truncate" title="${safeTitle}">${safeTitle}</p>
                ${latestBadge}
              </div>
            </div>
            <div class="text-right">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-200">${_escapeHtml(item.dateLabel)}</p>
              ${relative}
            </div>
          </div>
        `;
      })
      .join('');
    elements.assignmentOverviewList.innerHTML = rows;
  }

  const latestItem = overviewItems.find((item) => item.isLatest) || overviewItems[0];
  if (elements.assignmentOverviewLatestTitle) {
    const title = latestSummary?.taskTitle || latestItem?.title || '-';
    elements.assignmentOverviewLatestTitle.textContent = title || '-';
    elements.assignmentOverviewLatestTitle.setAttribute('title', title || '-');
  }
  if (elements.assignmentOverviewLatestDate) {
    let dateLabel = '-';
    if (latestSummary?.lastUpdated) {
      dateLabel = _formatDateTime(latestSummary.lastUpdated);
    } else if (latestItem?.timestamp) {
      dateLabel = latestItem.dateLabel || '-';
    }
    elements.assignmentOverviewLatestDate.textContent = dateLabel;
  }
}

function _renderTopGroups(groupData) {
  if (!elements.topGroupsContainer) return;
  uiManager.clearContainer(elements.topGroupsContainer);
  const top3 = groupData.filter((g) => g.evalCount > 0).slice(0, 3);
  if (top3.length === 0) {
    uiManager.displayEmptyMessage(elements.topGroupsContainer, 'শীর্ষ গ্রুপ গণনা করার ডেটা নেই।');
    return;
  }
  const formatLatestStats = (data = {}) => {
    const avgValue =
      typeof data.latestAverageScore === 'number' && !Number.isNaN(data.latestAverageScore)
        ? helpers.convertToBanglaNumber(data.latestAverageScore.toFixed(1))
        : '-';
    const participantValue =
      typeof data.latestParticipantCount === 'number' && data.latestParticipantCount !== null
        ? helpers.convertToBanglaNumber(String(data.latestParticipantCount))
        : '-';
    const participationValue =
      typeof data.latestParticipationRate === 'number' && !Number.isNaN(data.latestParticipationRate)
        ? helpers.convertToBanglaNumber(String(Math.round(data.latestParticipationRate)))
        : '-';

    return {
      avg: avgValue === '-' ? '-' : `${avgValue}%`,
      participants: participantValue === '-' ? '-' : `${participantValue} জন`,
      rate: participationValue === '-' ? '-' : `${participationValue}%`,
    };
  };

  const buildLatestMetricsSection = (stats) => `
    <div class="elite-latest-metrics">
      <div class="elite-metrics-title">
        <span class="elite-metrics-icon">
          <i class="fas fa-chart-line"></i>
        </span>
        <p class="elite-metrics-headline">সর্বশেষ এসাইনমেন্ট ফলাফল তথ্য</p>
      </div>
      <div class="elite-metrics-chips">
        <div class="elite-metric-chip">
          <span class="elite-metric-label">ফলাফল</span>
          <span class="elite-metric-value">${stats.avg}</span>
        </div>
        <div class="elite-metric-chip">
          <span class="elite-metric-label">অংশগ্রহণ</span>
          <span class="elite-metric-value">${stats.participants}</span>
        </div>
        <div class="elite-metric-chip">
          <span class="elite-metric-label">অংশগ্রহণের হার</span>
          <span class="elite-metric-value">${stats.rate}</span>
        </div>
      </div>
    </div>
  `;

  const podiumLabels = ['১ম স্থান', '২য় স্থান', '৩য় স্থান'];
  const podiumClasses = [
    'elite-podium-card relative rounded-3xl bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 text-white p-5 md:p-6 shadow-2xl ring-4 ring-yellow-300/60 dark:ring-yellow-400/50 order-1 md:order-2 cursor-pointer',
    'elite-podium-card relative rounded-3xl bg-gradient-to-br from-gray-100 via-gray-200 to-slate-200 dark:from-slate-600 dark:via-slate-500 dark:to-slate-600 text-gray-900 dark:text-gray-100 p-5 shadow-2xl ring-2 ring-slate-300/60 dark:ring-slate-400/40 order-2 md:order-1 cursor-pointer',
    'elite-podium-card relative rounded-3xl bg-gradient-to-br from-amber-200 via-orange-300 to-amber-400 dark:from-amber-700 dark:via-orange-600 dark:to-amber-700 text-gray-900 dark:text-white p-5 shadow-2xl ring-2 ring-amber-300/60 dark:ring-amber-500/50 order-3 md:order-3 cursor-pointer',
  ];
  const rankIcons = [
    '<i class="fa-solid fa-crown text-amber-400 dark:text-amber-200"></i>',
    '<i class="fa-solid fa-medal text-slate-700 dark:text-slate-200"></i>',
    '<i class="fa-solid fa-award text-amber-700 dark:text-amber-200"></i>',
  ];

  const nameFontConfig = [
    { max: 34, min: 16 }, // allow first card to shrink further to avoid overflow
    { max: 30, min: 14 }, // allow second card to shrink more on laptop widths
    { max: 28, min: 15 },
  ];

  const fitEliteNames = () => {
    if (
      !elements.topGroupsContainer ||
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame !== 'function'
    )
      return;
    window.requestAnimationFrame(() => {
      const names = elements.topGroupsContainer.querySelectorAll('.elite-card-name');
      names.forEach((el) => {
        const computed = window.getComputedStyle(el);
        const maxFont = parseFloat(el.dataset.maxFont || '') || parseFloat(computed.fontSize) || 22;
        const minFont = parseFloat(el.dataset.minFont || '') || Math.max(12, maxFont * 0.65);
        let currentSize = maxFont;
        el.style.fontSize = `${currentSize}px`;
        let safety = 0;
        while (currentSize > minFont && el.scrollWidth > el.clientWidth && safety < 25) {
          currentSize -= 0.5;
          el.style.fontSize = `${Math.max(currentSize, minFont)}px`;
          safety += 1;
        }
      });
    });
  };

  const buildPodiumCard = (data, index) => {
    if (!data) return '';
    const avgScore = typeof data.averageScore === 'number' ? data.averageScore : 0;
    const scoreValue = helpers.convertToBanglaNumber(avgScore.toFixed(1));
    const memberCount = typeof data.studentCount === 'number' ? data.studentCount : 0;
    const members = helpers.convertToBanglaNumber(memberCount);
    const latestStats = formatLatestStats(data);
    const metricsMarkup = buildLatestMetricsSection(latestStats);
    const groupName = _formatLabel(data.groupName);
    const fontConfig = nameFontConfig[index] || nameFontConfig[nameFontConfig.length - 1];
    const nameClass =
      index === 0
        ? 'elite-card-name elite-name-xl font-semibold text-white'
        : 'elite-card-name elite-name-lg font-semibold text-gray-900 dark:text-white';
    const memberLineClass = index === 0 ? 'text-white/85' : 'text-gray-800/80 dark:text-white/80';
    const placeText = podiumLabels[index] || helpers.convertToBanglaRank(index + 1);
    const articleClass = podiumClasses[index] || podiumClasses[podiumClasses.length - 1];
    const rankIcon = rankIcons[index] || '<i class="fa-solid fa-trophy text-amber-700 dark:text-amber-200"></i>';
    return `
        <article class="${articleClass}" data-group-id="${
      data.group?.id
    }" role="button" tabindex="0" aria-pressed="false">
          <span class="elite-rank-chip">
            <span class="elite-rank-icon">${rankIcon}</span>
            <span class="elite-rank-title">${placeText}</span>
          </span>
          <div class="elite-card-inner">
            <div class="elite-score-stack">
              <span class="elite-score-value">${scoreValue}%</span>
              <span class="elite-score-label">মোট গড় স্কোর</span>
            </div>
            <div class="elite-card-body ${index === 0 ? 'space-y-1.5' : 'space-y-1'}">
              <div class="${nameClass}" title="${groupName}" data-max-font="${fontConfig.max}" data-min-font="${
      fontConfig.min
    }">${groupName}</div>
              <div class="${memberLineClass} text-xs sm:text-sm font-medium">
                <span>সদস্য:</span>
                <span>${members}</span>
              </div>
            </div>
            ${metricsMarkup}
          </div>
        </article>
      `;
  };

  const cards = top3.map((data, index) => buildPodiumCard(data, index)).join('');

  const topGroupColumns = ['grid', 'grid-cols-1', 'gap-6'];
  if (top3.length >= 2) topGroupColumns.push('sm:grid-cols-2');
  if (top3.length >= 3) topGroupColumns.push('md:grid-cols-3');

  elements.topGroupsContainer.innerHTML = `
    <div class="${topGroupColumns.join(' ')}">
      ${cards}
    </div>
  `;
  fitEliteNames();

  // Make elite group cards open the same group detail modal
  if (elements.topGroupsContainer && typeof window !== 'undefined' && typeof window.openGroupModalById === 'function') {
    uiManager.addListener(elements.topGroupsContainer, 'click', (e) => {
      const card = e.target.closest('[data-group-id]');
      if (!card) return;
      const gid = card.getAttribute('data-group-id');
      if (gid) {
        try {
          window.openGroupModalById(gid);
        } catch (err) {
          console.warn('Elite group modal open failed:', err);
        }
      }
    });
  }

  const topGroupsSection = elements.topGroupsContainer.closest('section');
  if (topGroupsSection) {
    const headerTitle = topGroupsSection.querySelector('h3');
    if (headerTitle) headerTitle.textContent = 'এলিট গ্রুপ';

    const headerSubtitle = topGroupsSection.querySelector('p.text-xs');
    if (headerSubtitle) {
      headerSubtitle.textContent = 'গড় মূল্যায়ন স্কোরে শীর্ষে থাকা দলগুলোকে এক নজরে দেখুন।';
    }

    const headerBadge = topGroupsSection.querySelector('span.bg-indigo-500\\/10');
    if (headerBadge) {
      const icon = headerBadge.querySelector('i');
      const iconHTML = icon ? icon.outerHTML : '';
      headerBadge.innerHTML = `${iconHTML} Elite Group`;
    }
  }
}

/** Renders academic group stats */
function _renderAcademicGroups(academicStats) {
  if (!elements.academicGroupStatsList) return;
  uiManager.clearContainer(elements.academicGroupStatsList);
  const sortedAG = Object.entries(academicStats)
    .filter(([, data]) => data.groupCount > 0)
    .sort(([, a], [, b]) => b.averageScore - a.averageScore);
  if (sortedAG.length === 0) {
    uiManager.displayEmptyMessage(elements.academicGroupStatsList, 'একাডেমিক গ্রুপের তথ্য নেই।');
    return;
  }
  const topThree = sortedAG.slice(0, 3);
  const cards = topThree
    .map(([name, data]) => {
      const avgScore = data.averageScore;
      const palette = _getScorePalette(avgScore);
      const progress = Math.min(100, Math.round(avgScore));
      const avgText = helpers.convertToBanglaNumber(avgScore.toFixed(1));
      const totalStudents = helpers.convertToBanglaNumber(data.totalStudents);
      const groupCount = helpers.convertToBanglaNumber(data.groupCount);
      const formattedName = _formatLabel(name);
      return `
        <article class="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm transition hover:shadow-lg dark:border-gray-700/70 dark:bg-gray-900/70">
          <div class="absolute inset-0 bg-gradient-to-br ${palette.gradient} opacity-60"></div>
          <div class="relative space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="text-base font-semibold text-gray-900 dark:text-white" title="${formattedName}">${formattedName}</h4>
              <span class="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200 shadow">
                <i class="fas fa-signal"></i> গড়: ${avgText}%
              </span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div class="h-full rounded-full" style="width: ${progress}%; background: ${palette.solid}; box-shadow: 0 6px 12px ${palette.shadow};"></div>
            </div>
            <div class="grid grid-cols-2 gap-3 text-xs font-medium text-gray-600 dark:text-gray-300">
              <span class="inline-flex items-center gap-2">
                <i class="fas fa-users text-indigo-500"></i> শিক্ষার্থী: ${totalStudents}
              </span>
              <span class="inline-flex items-center gap-2 justify-end">
                <i class="fas fa-layer-group text-emerald-500"></i> গ্রুপ: ${groupCount}
              </span>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  const academicColumns = ['grid', 'grid-cols-1', 'gap-6'];
  if (topThree.length >= 2) academicColumns.push('sm:grid-cols-2');
  if (topThree.length >= 3) academicColumns.push('lg:grid-cols-3');

  elements.academicGroupStatsList.innerHTML = `
    <div class="${academicColumns.join(' ')}">
      ${cards}
    </div>
  `;
}

/** NEW: Build a single Rank Card (glass + gradient + medal) */
function _buildRankCard(data, rank) {
  const palette = _getScorePalette(data.averageScore);
  const rankText = helpers.convertToBanglaRank(rank);
  const groupName = _formatLabel(data.groupName);

  const formatInt = (value) => {
    const num = Math.max(0, Math.round(Number(value) || 0));
    const str = `${num}`;
    return helpers.convertToBanglaNumber ? helpers.convertToBanglaNumber(str) : str;
  };
  const formatPct = (value) => {
    const num = Number(value) || 0;
    const str = num.toFixed(2);
    return helpers.convertToBanglaNumber ? helpers.convertToBanglaNumber(str) : str;
  };

  const scorePct = Math.min(100, Math.max(0, Number(data.averageScore) || 0));
  const avgPct = formatPct(scorePct);
  const evals = formatInt(data.evalCount || 0);
  const members = formatInt(data.studentCount || 0);
  const evaluated = formatInt(data.evaluatedMembers || 0);
  const tasks = formatInt(data.taskCount || 0);

  const summaryLine = `মোট সদস্য: ${members} · মূল্যায়িত: ${evaluated} `;
  const groupId = data.group?.id || '';

  return `
  <article class="relative flex items-center justify-between gap-4 rounded-2xl border border-transparent
                  bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg
                  dark:border-transparent dark:bg-slate-900/70 cursor-pointer"
           data-group-id="${groupId}"
           style="box-shadow:0 10px 24px ${palette.shadow}; border:1px solid ${palette.solid}55;">
    <div class="flex items-start gap-3 min-w-0">
      <div class="flex flex-col items-center justify-center rounded-xl bg-slate-900/5 px-3 py-2 text-center
                  text-slate-700 shadow-sm dark:bg-white/10 dark:text-slate-100">
        <div class="text-sm font-bold">${rankText}</div>
        <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">গ্রুপ র‍্যাঙ্ক</div>
      </div>
      <div class="min-w-0 space-y-2">
        <h4 class="truncate text-base font-semibold text-slate-900 dark:text-white" title="${groupName}">
          ${groupName}
        </h4>
        <div class="grid grid-cols-2 gap-2 text-[12px] font-semibold">
          <span class="inline-flex items-center justify-center rounded-lg bg-slate-100 px-2 py-1 text-slate-700
                       dark:bg-slate-800 dark:text-slate-100">
            গড়: ${avgPct}%
          </span>
          <span class="inline-flex items-center justify-center rounded-lg bg-slate-900/5 px-2 py-1 text-slate-700
                       dark:bg-white/10 dark:text-slate-100">
            এসাইনমেন্ট অংশগ্রহন: ${evals} টি
          </span>
        </div>
        <p class="text-xs text-slate-600 dark:text-slate-300 truncate" title="${summaryLine}">
          ${summaryLine}
        </p>
      </div>
    </div>

    <div class="flex flex-col items-center gap-1 shrink-0">
      ${_buildCircularMeter(scorePct, palette, 64)}
      <span class="text-xs font-semibold text-slate-500 dark:text-slate-300">Avg%</span>
    </div>
  </article>`;
}

/** UPDATED: Renders group ranking list using new Rank Card */
function _renderGroupsRanking(groupData, rankingMeta = null) {
  if (!elements.groupsRankingList) return;
  uiManager.clearContainer(elements.groupsRankingList);

  const evaluatedGroups = groupData.filter((g) => g.evalCount > 0);
  if (evaluatedGroups.length === 0) {
    uiManager.displayEmptyMessage(elements.groupsRankingList, 'র‍্যাঙ্কিংয়ের জন্য ডেটা নেই।');
    return;
  }

  // Sort strictly by Average Score to match Elite Group logic
  const sortedGroups = [...evaluatedGroups].sort((a, b) => {
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    if (b.evalCount !== a.evalCount) return b.evalCount - a.evalCount;
    return (a.groupName || '').localeCompare(b.groupName || '', 'bn');
  });

  const cards = sortedGroups
    .map((data, index) => {
      const rank = index + 1;
      return _buildRankCard(data, rank);
    })
    .join('');

  elements.groupsRankingList.innerHTML = `
    <div class="grid grid-cols-1 gap-4 sm:gap-5">
      ${cards}
    </div>
  `;

  // Open group detail modal on click
  if (elements.groupsRankingList && window && typeof window.openGroupModalById === 'function') {
    uiManager.addListener(elements.groupsRankingList, 'click', (e) => {
      const card = e.target.closest('[data-group-id]');
      if (!card) return;
      const gid = card.getAttribute('data-group-id');
      if (gid) {
        try {
          window.openGroupModalById(gid);
        } catch (err) {
          console.warn('Group modal open failed:', err);
        }
      }
    });
  }
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

function _getScorePalette(score) {
  const numeric = Number(score) || 0;
  if (numeric >= 85) {
    return {
      solid: '#22c55e',
      soft: 'rgba(34,197,94,0.18)',
      gradient: 'from-emerald-500/15 via-emerald-400/10 to-transparent',
      shadow: 'rgba(34,197,94,0.28)',
    };
  }
  if (numeric >= 70) {
    return {
      solid: '#0ea5e9',
      soft: 'rgba(14,165,233,0.18)',
      gradient: 'from-sky-500/15 via-sky-400/10 to-transparent',
      shadow: 'rgba(14,165,233,0.25)',
    };
  }
  if (numeric >= 55) {
    return {
      solid: '#f59e0b',
      soft: 'rgba(245,158,11,0.18)',
      gradient: 'from-amber-500/15 via-amber-400/10 to-transparent',
      shadow: 'rgba(245,158,11,0.25)',
    };
  }
  return {
    solid: '#f43f5e',
    soft: 'rgba(244,63,94,0.18)',
    gradient: 'from-rose-500/15 via-rose-400/10 to-transparent',
    shadow: 'rgba(244,63,94,0.25)',
  };
}

function _buildCircularMeter(score, palette, size = 96) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const diameter = typeof size === 'number' ? size : 96;
  const displayValue = helpers.convertToBanglaNumber(Math.round(clamped).toString());
  return `
    <div class="relative flex items-center justify-center" style="width:${diameter}px;height:${diameter}px;">
      <div class="absolute inset-0 rounded-full" style="background: conic-gradient(${palette.solid} ${clamped}%, ${palette.soft} ${clamped}% 100%);"></div>
      <div class="absolute inset-[18%] rounded-full bg-white dark:bg-gray-900 flex items-center justify-center shadow-inner" style="box-shadow: 0 8px 18px ${palette.shadow};">
        <span class="text-lg font-semibold text-gray-800 dark:text-gray-100">${displayValue}%</span>
      </div>
    </div>
  `;
}

function _setupDashboardFilters() {
    const teacherInfoContainer = document.getElementById('teacherFiltersContainer');
    const teacherInfoCard = document.getElementById('teacherInfoCard');
    const teacherNameDisplay = document.getElementById('teacherNameDisplay');
    const teacherAssignmentDisplay = document.getElementById('teacherAssignmentDisplay');
    
    const classSelect = document.getElementById('dashboardClassFilter');
    const sectionSelect = document.getElementById('dashboardSectionFilter');
    const subjectSelect = document.getElementById('dashboardSubjectFilter');
    
    // Get the wrapper div that contains all three filter selects
    // This is the div with class "flex flex-wrap gap-2 items-center" inside teacherFiltersContainer
    const filtersWrapper = classSelect?.parentElement;
    
    console.log('🔍 Filter setup debug:', {
        teacherInfoContainer: !!teacherInfoContainer,
        teacherInfoCard: !!teacherInfoCard,
        classSelect: !!classSelect,
        sectionSelect: !!sectionSelect,
        subjectSelect: !!subjectSelect,
        filtersWrapper: !!filtersWrapper
    });

    const user = stateManager.get('currentUserData');
    const currentTeacher = stateManager.get('currentTeacher');
    const isTeacher = user && user.type === 'teacher';
    // If user is undefined (auth not complete), assume admin since only authenticated users can access dashboard
    const isAdmin = user ? (user.type === 'admin' || user.type === 'super-admin') : true;
    
    console.log('👤 User type:', user?.type, 'isAdmin:', isAdmin, 'isTeacher:', isTeacher);

    // === TEACHER: Show info card ONLY, hide filter dropdowns ===
    if (isTeacher) {
        if (teacherInfoContainer) teacherInfoContainer.classList.remove('hidden');
        
        // Hide the filter dropdowns for teachers
        if (filtersWrapper) filtersWrapper.classList.add('hidden');

        // Display Teacher Info Card
        if (teacherInfoCard && teacherNameDisplay && teacherAssignmentDisplay) {
            teacherInfoCard.classList.remove('hidden');
            
            // Teacher Name
            const teacherName = currentTeacher?.name || user.email?.split('@')[0] || 'শিক্ষক';
            teacherNameDisplay.textContent = teacherName;
            
            // Get assigned data from currentTeacher (NOT from user which doesn't have assignments)
            const assignedClasses = currentTeacher?.assignedClasses || [];
            const assignedSections = currentTeacher?.assignedSections || [];
            const assignedSubjects = currentTeacher?.assignedSubjects || [];
            
            const allClasses = stateManager.get('classes') || [];
            const allSections = stateManager.get('sections') || [];
            const allSubjects = stateManager.get('subjects') || [];

            const availableClasses = allClasses.filter(c => assignedClasses.includes(c.id));
            const availableSections = allSections.filter(s => assignedSections.includes(s.id));
            const availableSubjects = allSubjects.filter(s => assignedSubjects.includes(s.id));

            // Build assignment summary
            const classNames = availableClasses.map(c => c.name).join(', ') || 'N/A';
            const sectionNames = availableSections.map(s => s.name).join(', ') || 'N/A';
            const subjectNames = availableSubjects.map(s => s.name).join(', ') || 'N/A';
            
            teacherAssignmentDisplay.innerHTML = `
                <span class="text-indigo-600 dark:text-indigo-400">ক্লাস:</span> ${classNames} 
                <span class="mx-1 text-indigo-400">|</span>
                <span class="text-indigo-600 dark:text-indigo-400">শাখা:</span> ${sectionNames}
                <span class="mx-1 text-indigo-400">|</span>
                <span class="text-indigo-600 dark:text-indigo-400">বিষয়:</span> ${subjectNames}
            `;
        }
        return; // Teacher setup done - no filters
    }

    // === ADMIN: Show filter dropdowns, hide teacher info ===
    if (isAdmin) {
        if (teacherInfoContainer) teacherInfoContainer.classList.remove('hidden');
        if (teacherInfoCard) teacherInfoCard.classList.add('hidden'); // Hide teacher-specific card
        if (filtersWrapper) filtersWrapper.classList.remove('hidden'); // Show filter dropdowns

        if (!classSelect || !sectionSelect || !subjectSelect) return;

        // Populate with ALL options for admin (remove duplicates by name)
        const allClasses = stateManager.get('classes') || [];
        const allSections = stateManager.get('sections') || [];
        const allSubjects = stateManager.get('subjects') || [];
        
        // Remove duplicates by name (not ID) - if multiple entries have same name, keep first one
        const uniqueClasses = Array.from(new Map(allClasses.map(c => [c.name, c])).values());
        const uniqueSections = Array.from(new Map(allSections.map(s => [s.name, s])).values());
        const uniqueSubjects = Array.from(new Map(allSubjects.map(s => [s.name, s])).values());

        uiManager.populateSelect(classSelect, uniqueClasses.map(c => ({ value: c.id, text: c.name })), 'সকল ক্লাস');
        uiManager.populateSelect(sectionSelect, uniqueSections.map(s => ({ value: s.id, text: s.name })), 'সকল শাখা');
        uiManager.populateSelect(subjectSelect, uniqueSubjects.map(s => ({ value: s.id, text: s.name })), 'সকল বিষয়');

        // Set current values from activeContext
        const context = stateManager.get('activeContext') || {};
        if (context.classId) classSelect.value = context.classId;
        if (context.sectionId) sectionSelect.value = context.sectionId;
        if (context.subjectId) subjectSelect.value = context.subjectId;

        // Add Listeners
        const updateContext = () => {
            stateManager.setActiveContext({
                classId: classSelect.value || null,
                sectionId: sectionSelect.value || null,
                subjectId: subjectSelect.value || null
            });
            render(); // Re-render dashboard with new filters
        };

        classSelect.onchange = updateContext;
        sectionSelect.onchange = updateContext;
        subjectSelect.onchange = updateContext;
        return;
    }

    // === PUBLIC USERS: Hide everything ===
    if (teacherInfoContainer) teacherInfoContainer.classList.add('hidden');
}

