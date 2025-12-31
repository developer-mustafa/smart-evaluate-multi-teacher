// js/components/upcoming-assignments.js
// ✅ Focus-first sort + Date-only→11:55 AM + Countdown (conditional + blink)
// ✅ 3D Cards (original left-rail number) + Soft “অনুষ্ঠিত হবে :” capsule with localized date & time
// ✅ Smooth full-width accordion
// ✅ Dashboard summary cards with soft 3D (both light/dark) via injected CSS

let stateManager;
let uiManager;
let helpers;

const elements = {};
let countdownTimer = null; // shared ticker

const STATUS_ORDER = ['upcoming', 'ongoing', 'completed'];
const STATUS_META = {
  upcoming: {
    label: 'আপকামিং এসাইনমেন্ট',
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200',
    card: 'border-sky-100 dark:border-sky-800/60',
    icon: 'fas fa-calendar-plus text-sky-500',
  },
  ongoing: {
    label: 'চলমান এসাইনমেন্ট',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
    card: 'border-amber-100 dark:border-amber-800/60',
    icon: 'fas fa-spinner text-amber-500',
  },
  completed: {
    label: 'কমপ্লিট এসাইনমেন্ট',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
    card: 'border-emerald-100 dark:border-emerald-800/60',
    icon: 'fas fa-check-circle text-emerald-500',
  },
};

const assignmentTabState = { active: 'upcoming' }; // all | upcoming | ongoing | completed
const filterState = { classId: '', sectionId: '', subjectId: '' }; // Filter selections
const TAB_ORDER = ['all', 'upcoming', 'ongoing', 'completed'];
const TAB_META = {
  all: {
    label: 'মোট এসাইনমেন্ট',
    description: 'সমস্ত টাস্ক',
    icon: 'fas fa-layer-group',
    theme: 'slate',
  },
  upcoming: {
    label: STATUS_META.upcoming.label,
    description: 'আসন্ন তালিকা',
    icon: STATUS_META.upcoming.icon,
    theme: 'sky',
  },
  ongoing: {
    label: STATUS_META.ongoing.label,
    description: 'চলমান টাস্ক',
    icon: STATUS_META.ongoing.icon,
    theme: 'amber',
  },
  completed: {
    label: STATUS_META.completed.label,
    description: 'সম্পন্ন টাস্ক',
    icon: STATUS_META.completed.icon,
    theme: 'emerald',
  },
};

const DEFAULT_ASSIGNMENT_HOUR = 11;
const DEFAULT_ASSIGNMENT_MINUTE = 55;
const DEFAULT_ASSIGNMENT_SECOND = 0;

const BN_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];
const BN_WEEKDAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  helpers = dependencies.utils;

  _ensureTabStyles();
  _ensurePillStyles();

  _cacheDOMElements();
  _bindEvents();

  console.log('✅ UpcomingAssignments (focus-first + 10:20 rule + soft 3D + rose chef) initialized.');
  return { render };
}

function _cacheDOMElements() {
  elements.page = document.getElementById('page-upcoming-assignments');
  elements.summary = document.getElementById('upcomingAssignmentSummary');
  elements.list = document.getElementById('upcomingAssignmentsList');
  elements.filter = document.getElementById('assignmentStatusFilter');
  if (elements.filter) {
    elements.filter.classList.add('hidden');
    elements.filter.setAttribute('aria-hidden', 'true');
    elements.filter.style.display = 'none';
  }
  
  // Filter elements (will be populated after render)
  elements.filtersContainer = null; // Will be set after render
  elements.classFilter = null;
  elements.sectionFilter = null;
  elements.subjectFilter = null;
}

function _bindEvents() {
  uiManager.addListener(document, 'keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('[data-acc-panel][data-open="true"]').forEach((p) => _animateToggle(p, false));
      document
        .querySelectorAll('[data-acc-btn][aria-expanded="true"]')
        .forEach((b) => b.setAttribute('aria-expanded', 'false'));
    }
  });
}

/* =========================
   Injected Styles (Tabs + pills)
========================= */
function _ensureTabStyles() {
  if (document.getElementById('ua-tabs-styles')) return;
  const style = document.createElement('style');
  style.id = 'ua-tabs-styles';
  style.textContent = `
  .ua-tabbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    padding: 0.25rem;
    background: transparent;
  }
  
  .ua-tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(255, 255, 255, 0.6);
    color: #475569;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(8px);
    overflow: hidden;
    min-width: 130px;
    flex: 1 1 auto;
  }

  .dark .ua-tab {
    background: rgba(30, 41, 59, 0.6);
    border-color: rgba(148, 163, 184, 0.1);
    color: #94a3b8;
  }

  .ua-tab:hover {
    background: rgba(255, 255, 255, 0.9);
    transform: translateY(-1px);
  }
  .dark .ua-tab:hover {
    background: rgba(30, 41, 59, 0.9);
  }

  /* Active State */
  .ua-tab[aria-selected="true"] {
    background: #fff;
    color: #0f172a;
    border-color: transparent;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
  .dark .ua-tab[aria-selected="true"] {
    background: #1e293b;
    color: #fff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  /* Animated Border Gradient */
  .ua-tab[aria-selected="true"]::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 12px;
    padding: 2px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6);
    background-size: 300% 100%;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: borderFlow 3s linear infinite;
    pointer-events: none;
  }

  @keyframes borderFlow {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  /* Theme Colors */
  .ua-tab[aria-selected="true"][data-theme="sky"] { color: #0284c7; }
  .dark .ua-tab[aria-selected="true"][data-theme="sky"] { color: #38bdf8; }

  .ua-tab[aria-selected="true"][data-theme="amber"] { color: #d97706; }
  .dark .ua-tab[aria-selected="true"][data-theme="amber"] { color: #fbbf24; }

  .ua-tab[aria-selected="true"][data-theme="emerald"] { color: #059669; }
  .dark .ua-tab[aria-selected="true"][data-theme="emerald"] { color: #34d399; }

  /* Elements */
  .ua-tab-icon {
    font-size: 1.1rem;
    color: inherit;
    opacity: 0.8;
  }
  
  .ua-tab-label {
    font-size: 0.95rem;
    font-weight: 600;
    z-index: 1;
  }

  .ua-tab-count {
    font-size: 0.85rem;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.05);
    font-weight: 700;
    z-index: 1;
    margin-left: auto;
  }
  .dark .ua-tab-count {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .ua-tab[aria-selected="true"] .ua-tab-count {
    background: currentColor;
    color: #fff;
    opacity: 0.9;
  }
  .dark .ua-tab[aria-selected="true"] .ua-tab-count {
    color: #1e293b;
  }

  .ua-tab-desc { display: none; }

  /* Mobile Layout */
  @media (max-width: 640px) {
    .ua-tabbar {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }
    .ua-tab {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-areas: 
        "icon count"
        "label label";
      align-items: center;
      padding: 1rem;
      min-width: 0;
      width: 100%;
      gap: 0.5rem;
      text-align: left;
    }
    
    .ua-tab-icon {
      grid-area: icon;
      justify-self: start;
      font-size: 1.5rem;
      margin: 0;
      opacity: 1;
    }

    .ua-tab-count {
      grid-area: count;
      justify-self: end;
      font-size: 1.5rem;
      background: transparent !important;
      padding: 0;
      border: none;
      line-height: 1;
      color: inherit !important;
      opacity: 1 !important;
      margin: 0;
      font-weight: 700;
    }

    .ua-tab-label {
      grid-area: label;
      justify-self: start;
      text-align: left;
      font-size: 0.85rem;
      opacity: 0.9;
      font-weight: 600;
      width: 100%;
      margin: 0;
      white-space: normal;
      line-height: 1.3;
    }
  }
  `;
  document.head.appendChild(style);
}

function _ensurePillStyles() {
  if (document.getElementById('ua-pill-styles')) return;
  const style = document.createElement('style');
  style.id = 'ua-pill-styles';
  style.textContent = `
  /* Countdown pill (with conditional colors) */
  .cd-pill{
    display:inline-flex; align-items:center; gap:.45rem;
    border-radius:.7rem; padding:.28rem .65rem;
    font-weight:700; font-size:.875rem; line-height:1.1;
    border:1px solid var(--border);
    background: var(--surface-2);
    box-shadow: var(--inner-highlight);
    white-space:nowrap;
  }
  .cd-green{ color:#166534; background:rgba(187,247,208,.65); border-color:rgba(22,101,52,.25); }
  .dark .cd-green{ color:#A7F3D0; background:rgba(6,95,70,.35); border-color:rgba(167,243,208,.2); }
  .cd-amber{ color:#92400e; background:rgba(254,243,199,.65); border-color:rgba(146,64,14,.25); }
  .dark .cd-amber{ color:#FDE68A; background:rgba(120,53,15,.35); border-color:rgba(253,230,138,.2); }
  .cd-red{ color:#7f1d1d; background:rgba(254,226,226,.85); border-color:rgba(127,29,29,.22); }
  .dark .cd-red{ color:#fecaca; background:rgba(127,29,29,.28); border-color:rgba(254,202,202,.18); }
  @keyframes uablink { 0%, 60%, 100% { opacity:1 } 30% { opacity:.35 } }
  .cd-blink { animation: uablink 1.2s linear infinite; }

  /* Flat schedule pill aligned with countdown colors */
  .sched-pill{
    display:inline-flex; flex-wrap:wrap; align-items:center; gap:.45rem;
    border-radius:.75rem; padding:.35rem .8rem;
    font-size:.88rem; line-height:1.15;
    font-weight:600;
    border:1px solid rgba(148,163,184,.35);
    background: rgba(248,250,252,.85);
    color:#0f172a;
    white-space:normal;
    box-shadow: var(--inner-highlight);
  }
  .dark .sched-pill{
    background: rgba(30,41,59,.45);
    border-color: rgba(148,163,184,.35);
    color:#e2e8f0;
  }
  .sched-pill__label{
    font-weight:700;
    letter-spacing:.01em;
  }
  .sched-pill__value{
    font-weight:600;
  }
  .sched-pill[data-status="upcoming"]{
    background: rgba(16,185,129,.15);
    border-color: rgba(16,185,129,.35);
    color:#065f46;
  }
  .dark .sched-pill[data-status="upcoming"]{
    background: rgba(5,150,105,.35);
    border-color: rgba(16,185,129,.45);
    color:#a7f3d0;
  }
  .sched-pill[data-status="ongoing"]{
    background: rgba(251,191,36,.2);
    border-color: rgba(245,158,11,.35);
    color:#7c2d12;
  }
  .dark .sched-pill[data-status="ongoing"]{
    background: rgba(120,53,15,.35);
    border-color: rgba(251,191,36,.45);
    color:#fde68a;
  }
  .sched-pill[data-status="completed"]{
    background: rgba(148,163,184,.25);
    border-color: rgba(71,85,105,.35);
    color:#1f2937;
  }
  .dark .sched-pill[data-status="completed"]{
    background: rgba(30,41,59,.55);
    border-color: rgba(148,163,184,.45);
    color:#cbd5f5;
  }
  `;
  document.head.appendChild(style);
}

/* =========================
   Utilities
========================= */

function _coerceDate(raw) {
  if (!raw) return null;
  try {
    if (typeof raw.toDate === 'function') return raw.toDate(); // Firebase Timestamp
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function _buildAssignmentNumberMap(tasks = []) {
  const enriched =
    tasks
      ?.map((task, index) => {
        const createdAtDate = _coerceDate(task?.createdAt);
        const fallbackDate = _coerceDate(task?.date);
        const createdAtTs = createdAtDate?.getTime();
        const fallbackTs = fallbackDate?.getTime();
        const timestamp = Number.isFinite(createdAtTs)
          ? createdAtTs
          : Number.isFinite(fallbackTs)
          ? fallbackTs
          : index;
        return { id: task?.id, timestamp, fallbackIndex: index };
      })
      .filter((entry) => entry.id) || [];

  enriched.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.fallbackIndex - b.fallbackIndex;
  });

  const map = new Map();
  enriched.forEach((entry, idx) => map.set(entry.id, idx + 1));
  return map;
}

/** If date looks date-only (00:00:00), set local time to 10:20 AM */
function _applyDefaultTimeIfDateOnly(dateObj) {
  if (!dateObj) return null;
  const normalized = new Date(dateObj);
  normalized.setHours(DEFAULT_ASSIGNMENT_HOUR, DEFAULT_ASSIGNMENT_MINUTE, DEFAULT_ASSIGNMENT_SECOND, 0);
  return normalized;
}

function _getSortableDate(dateInput) {
  const d = _coerceDate(dateInput);
  return _applyDefaultTimeIfDateOnly(d) || d;
}

function _bn(n) {
  const s = String(n);
  return helpers?.convertToBanglaNumber ? helpers.convertToBanglaNumber(s) : s;
}

function _formatScheduleLabel(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
    return 'তারিখ নির্ধারিত নয়';
  }
  const day = _bn(String(dateObj.getDate()).padStart(2, '0'));
  const month = BN_MONTHS[dateObj.getMonth()] || '';
  const year = _bn(dateObj.getFullYear());
  const weekday = BN_WEEKDAYS[dateObj.getDay()] || '';
  const timeLabel = _formatScheduleTime(dateObj);
  return `${day} ${month} ${year} - ${weekday}, ${timeLabel}`;
}

function _formatScheduleTime(dateObj) {
  const hour = dateObj.getHours();
  const minute = dateObj.getMinutes();
  const partOfDay = _getDayPartLabel(hour);
  const period = hour >= 12 ? 'pm' : 'am';
  const hr12 = hour % 12 || 12;
  const minuteStr = String(minute).padStart(2, '0');
  const time = `${_bn(hr12)}:${_bn(minuteStr)}`;
  return `${partOfDay} ${time} ${period}`;
}

function _getDayPartLabel(hour) {
  if (hour < 4) return 'ভোর';
  if (hour < 12) return 'সকাল';
  if (hour < 16) return 'দুপুর';
  if (hour < 19) return 'বিকাল';
  return 'রাত';
}

/** returns parts + remainingDays (ceil) + remainingMs (future only) */
function _diffParts(targetDate) {
  const now = Date.now();
  const t = targetDate?.getTime?.() ?? NaN;
  if (Number.isNaN(t)) return { valid: false };

  // Calendar-day delta for precise wording
  let dayDiff = 0;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetMid = new Date(targetDate);
    targetMid.setHours(0, 0, 0, 0);
    dayDiff = Math.round((targetMid.getTime() - today.getTime()) / 86400000);
  } catch {
    dayDiff = 0;
  }

  let delta = t - now;
  const past = delta <= 0;
  if (past) delta = Math.abs(delta);

  const sec = Math.floor(delta / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const remainingDays = past ? 0 : Math.ceil((t - now) / 86400000);
  const remainingMs = past ? Number.POSITIVE_INFINITY : t - now;

  return { valid: true, past, days, hours, minutes, seconds, remainingDays, remainingMs, dayDiff };
}

function _countdownLabel(parts, isStart = true) {
  if (!parts.valid) return 'সময় মেলেনি';

  const D = _bn(parts.days);
  const H = _bn(parts.hours);
  const M = _bn(parts.minutes);
  const S = _bn(parts.seconds);

  let prefix = 'শুরু হতে বাকি';
  if (parts.past) {
    prefix = parts.dayDiff === -1 ? 'গতকাল শেষ হয়েছে' : 'শেষ হয়েছে';
  } else {
    if (parts.dayDiff === 0) prefix = 'আজ পরীক্ষা';
    else if (parts.dayDiff === 1) prefix = 'আগামীকাল পরীক্ষা';
    else if (parts.dayDiff === 2) prefix = 'পরশু পরীক্ষা';
  }

  const suffix = parts.past ? 'আগে' : 'পর';
  const segments = [];
  if (parts.days > 0) segments.push(`${D} দিন`);
  segments.push(`${H} ঘন্টা`, `${M} মিনিট`, `${S} সেকেন্ড`);
  return `${prefix}: ${segments.join(' ')} ${suffix}`;
}

function _countdownClass(parts) {
  if (!parts.valid) return 'cd-pill';
  if (parts.past) return 'cd-pill cd-red'; // past due: no blinking

  const d = parts.remainingDays;
  if (d > 10) return 'cd-pill cd-green';
  if (d >= 6) return 'cd-pill cd-amber';
  if (d > 3) return 'cd-pill cd-red';
  return 'cd-pill cd-red cd-blink'; // 0-3 days -> blink
}
/* =========================
   Render Pipeline
========================= */

export function render() {
  if (!elements.page) return;

  let tasks, evaluations;
  const user = stateManager.get('currentUserData');

  if (user && user.type === 'teacher') {
      tasks = stateManager.getFilteredData('tasks', true);
      evaluations = stateManager.getFilteredData('evaluations', true);
  } else {
      tasks = stateManager.get('tasks') || [];
      evaluations = stateManager.get('evaluations') || [];
  }
  
  console.log('📋 Upcoming Assignments - Raw tasks:', tasks.length);
  
  // Apply admin filters (if any)
  tasks = _applyFilters(tasks);
  
  console.log('📋 Upcoming Assignments - After filter:', tasks.length);
  
  const assignmentNumberMap = _buildAssignmentNumberMap(tasks);

  // Normalize (with 10:20 rule) so status/ISO are correct
  const normalized = tasks.map((task) => _normalizeTask(task, evaluations, assignmentNumberMap));

  // Focus-first sorting:
  // upcoming by urgency (remainingMs asc) → ongoing → completed (recent first)
  const now = Date.now();
  const bucket = (t) => (t.status === 'upcoming' ? 0 : t.status === 'ongoing' ? 1 : 2);
  const urgency = (t) => {
    const d = t._dateObj;
    if (!d) return Number.POSITIVE_INFINITY;
    const ms = d.getTime() - now; // only upcoming gets finite positive
    return ms > 0 ? ms : Number.POSITIVE_INFINITY;
  };
  const tms = (t) => (t._dateObj ? t._dateObj.getTime() : -Infinity);

  normalized.sort((a, b) => {
    const ba = bucket(a),
      bb = bucket(b);
    if (ba !== bb) return ba - bb;

    if (ba === 0) {
      // upcoming
      const ua = urgency(a),
        ub = urgency(b);
      if (ua !== ub) return ua - ub; // soonest first
      return tms(a) - tms(b); // tiebreak asc
    }
    // ongoing/completed → recent first
    return tms(b) - tms(a);
  });

  const hasStableNumbers = assignmentNumberMap && assignmentNumberMap.size > 0;
  if (!hasStableNumbers) {
    normalized.forEach((t, i) => (t.assignmentNumber = i + 1));
  } else {
    normalized.forEach((t, i) => {
      if (!t.assignmentNumber) t.assignmentNumber = i + 1;
    });
  }

  _renderSummary(normalized);
  _setupFilters(); // Setup filters after summary is rendered
  _renderAssignments(normalized);

  _startCountdownTicker();
}

/* =========================
   Summary Tabs
========================= */

function _renderSummary(tasks) {
  if (!elements.summary) return;

  const counts = {
    all: tasks.length,
    upcoming: tasks.filter((t) => t.status === 'upcoming').length,
    ongoing: tasks.filter((t) => t.status === 'ongoing').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };

  // Filter dropdowns (will be shown/hidden based on user type)
  const filtersHtml = `
    <div id="upcomingAssignmentsFilters" class="hidden flex flex-wrap gap-1.5 items-center justify-center mb-2">
      <select id="upcomingClassFilter" class="appearance-none bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg py-1 px-2 pr-6 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer backdrop-blur-sm transition-colors hover:bg-white/80 dark:hover:bg-slate-800/80 min-w-[100px]">
        <option value="">সকল ক্লাস</option>
      </select>
      <select id="upcomingSectionFilter" class="appearance-none bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg py-1 px-2 pr-6 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer backdrop-blur-sm transition-colors hover:bg-white/80 dark:hover:bg-slate-800/80 min-w-[100px]">
        <option value="">সকল শাখা</option>
      </select>
      <select id="upcomingSubjectFilter" class="appearance-none bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg py-1 px-2 pr-6 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer backdrop-blur-sm transition-colors hover:bg-white/80 dark:hover:bg-slate-800/80 min-w-[100px]">
        <option value="">সকল বিষয়</option>
      </select>
    </div>
  `;

  const tabsHtml = `
    <div class="ua-tabbar" role="tablist" aria-label="Assignment filter tabs">
      ${TAB_ORDER.map((key) => {
        const meta = TAB_META[key];
        if (!meta) return '';
        const selected = assignmentTabState.active === key;
        const count = _bn(counts[key] ?? 0);
        return `
          <button type="button" role="tab"
            class="ua-tab"
            data-tab="${key}"
            data-theme="${meta.theme}"
            aria-selected="${selected}">
            <i class="${meta.icon} ua-tab-icon"></i>
            <span class="ua-tab-label">${meta.label}</span>
            <span class="ua-tab-count">${count}</span>
            <span class="ua-tab-desc">${meta.description}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;

  elements.summary.innerHTML = filtersHtml + tabsHtml;

  const buttons = elements.summary.querySelectorAll('[data-tab]');
  buttons.forEach((btn) => {
    uiManager.addListener(btn, 'click', () => {
      const targetTab = btn.getAttribute('data-tab');
      if (!targetTab || targetTab === assignmentTabState.active) return;
      assignmentTabState.active = targetTab;
      render();
    });
  });
}

/* =========================
   List + Cards
========================= */

function _renderAssignments(tasks) {
  if (!elements.list) return;

  const activeTab = assignmentTabState.active || 'all';
  const visibleStatuses = activeTab === 'all' ? STATUS_ORDER : [activeTab];
  let content = '';

  visibleStatuses.forEach((status) => {
    const statusTasks = tasks.filter((task) => task.status === status);
    if (!statusTasks.length) return;
    const cards = statusTasks.map(_assignmentCard).join('');

    content += `
      <section class="space-y-4">
        <div class="flex items-center gap-2">
          <span class="chip-3d inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
            STATUS_META[status].chip
          }">
            <i class="${STATUS_META[status].icon}"></i>${STATUS_META[status].label}
          </span>
          <span class="text-xs text-gray-500 dark:text-gray-400">${_bn(statusTasks.length)} টি এন্ট্রি</span>
        </div>
        <div class="space-y-3">${cards}</div>
      </section>
    `;
  });

  elements.list.innerHTML =
    content ||
    `
    <div class="placeholder-content">
      <i class="fas fa-inbox mr-2"></i>
      এই স্টেটাসে কোনো এসাইনমেন্ট পাওয়া যায়নি।
    </div>
  `;

  _wireAccordions();
}

/* Card: left rail number + countdown + rose 3D schedule pill (upcoming only) + accordion */
function _assignmentCard(task) {
  const meta = STATUS_META[task.status] || STATUS_META.upcoming;
  const participantsLabel = _bn(task.participants);
  const assignmentNumber = task.assignmentNumber || 0;
  const formattedNumber = _bn(assignmentNumber);
  const dateLabel = task.dateLabel || 'তারিখ নির্ধারিত নয়';

  const accId = `acc_${task.id || Math.random().toString(36).slice(2)}`;
  const panelId = `panel_${task.id || Math.random().toString(36).slice(2)}`;

  const countdownHtml = `
    <span class="cd-pill" data-cd data-iso="${task.dateISO || ''}" data-mode="start">
      <i class="fas fa-hourglass-half"></i>
      <span class="cd-text text-[11px] sm:text-sm">${_countdownLabel(_diffParts(task._dateObj))}</span>
    </span>
   
  `;

  const schedulePrefix = `${task.scheduleText || 'অনুষ্ঠিত হবে'} :`;
  const scheduleCapsule = `
    <span class="sched-pill" data-status="${task.status}">
      <span class="sched-pill__label text-sm sm:text-base">${schedulePrefix}</span>
      <span class="sched-pill__value text-xs sm:text-sm">${dateLabel}</span>
    </span>
  `;
  
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

  // Get Class, Section, Subject names
  const classes = stateManager.get('classes') || [];
  const sections = stateManager.get('sections') || [];
  const subjects = stateManager.get('subjects') || [];
  
  const className = task.classId ? (classes.find(c => c.id === task.classId)?.name || '') : '';
  const sectionName = task.sectionId ? (sections.find(s => s.id === task.sectionId)?.name || '') : '';
  const subjectName = task.subjectId ? (subjects.find(s => s.id === task.subjectId)?.name || '') : '';
  
  // Get dynamic color for subject
  const subjectColorClass = _getSubjectColor(subjectName);

  // Build info badges
  const infoBadges = `
    <div class="flex flex-wrap gap-1.5 mt-2">
      ${className ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
        <i class="fas fa-graduation-cap"></i> ${className}
      </span>` : ''}
      ${sectionName ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
        <i class="fas fa-layer-group"></i> ${sectionName}
      </span>` : ''}
      ${subjectName ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold border ${subjectColorClass}">
        <i class="fas fa-book"></i> ${subjectName}
      </span>` : ''}
    </div>
  `;

  return `
    <article class="relative card-3d card-3d--bevel focusable flex flex-col sm:flex-row overflow-visible sm:overflow-hidden" tabindex="0" role="group" aria-label="${helpers.ensureBengaliText(
      task.name
    )}">
      <!-- Left Rail: পরীক্ষার নং (original design) -->
      <div class="flex-shrink-0 w-full sm:w-24 flex flex-row sm:flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800/60 p-4 border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-gray-700/50">
        <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">পরীক্ষা</span>
        <span class="text-3xl font-extrabold text-blue-600 dark:text-blue-400">${formattedNumber}</span>
      </div>

      <!-- Content -->
      <div class="flex-1 p-4 min-w-0">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div class="min-w-0">
            <!-- Top row: chip + countdown + rose pill -->
            <div class="flex items-center flex-wrap gap-2">
              <span class="chip-3d inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                meta.chip
              }">
                <i class="${meta.icon}"></i>${meta.label}
              </span>
              ${countdownHtml}
              ${scheduleCapsule}
            </div>

            <h4 class="text-xs sm:text-base font-semibold text-gray-900 dark:text-white mt-2">${task.name}</h4>
            ${infoBadges}
          </div>

          <div class="flex sm:flex-col  gap-2 text-[10px] sm:text-base text-gray-600 dark:text-gray-300">
            <span class="inline-flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800/70 px-3 py-1 border border-gray-200/80 dark:border-white/10 shadow-[var(--inner-highlight)]">
              <i class="fas fa-user-check text-blue-500"></i> অংশগ্রহণ: ${participantsLabel}
            </span>
            <span class="inline-flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800/70 px-3 py-1 border border-gray-200/80 dark:border-white/10 shadow-[var(--inner-highlight)]" title="ব্রেকডাউন: টাস্ক-${_bn(task.maxScoreBreakdown?.task ?? 0)}, টিম-${_bn(task.maxScoreBreakdown?.team ?? 0)}, অতিরিক্ত-${_bn(task.maxScoreBreakdown?.additional ?? 0)}, MCQ-${_bn(task.maxScoreBreakdown?.mcq ?? 0)}">
              <i class="fas fa-star text-amber-500"></i> মোট: ${_bn(task.maxScore || 100)}
            </span>
            <span class="inline-flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800/70 px-3 py-1 border border-gray-200/80 dark:border-white/10 shadow-[var(--inner-highlight)]">
              <i class="fas fa-clock text-purple-500"></i> সময়: ${task.startTimeLabel || 'সকাল ১১:৫৫ am'}
            </span>
          </div>
        </div>

        <!-- Accordion -->
        ${_renderAccordion(task, accId, panelId)}
      </div>
    </article>
  `;
}

/* =========================
   Accordion (Smooth)
========================= */

function _renderAccordion(task, accId, panelId) {
  const trimmed = (task.description || '').trim();
  if (!trimmed) return '';

  const items = trimmed
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const content =
    items.length <= 1
      ? `<p class="leading-relaxed">${helpers.ensureBengaliText(trimmed)}</p>`
      : `<ul class="list-disc list-inside space-y-1.5">${items
          .map((i) => `<li>${helpers.ensureBengaliText(i)}</li>`)
          .join('')}</ul>`;

  return `
    <div class="mt-4">
      <button
        id="${accId}"
        data-acc-btn
        class="w-full flex items-center justify-between gap-3 rounded-xl border border-gray-300/80 dark:border-white/10 bg-gray-50 dark:bg-gray-800/60 px-4 py-2.5 text-left focusable"
        aria-expanded="false"
        aria-controls="${panelId}"
      >
        <span class="inline-flex items-center gap-2 text-sm font-semibold">
          <i class="fas fa-list-check"></i>
          প্রি-রিকোয়ারমেন্টস
        </span>
        <i class="fas fa-chevron-down transition-transform duration-200 ease-out" data-acc-chevron></i>
      </button>

      <div
        id="${panelId}"
        data-acc-panel
        data-open="false"
        class="overflow-hidden rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-gray-900/60 mt-2"
        style="max-height:0; transition:max-height .28s ease;"
      >
        <div class="p-4 text-sm text-gray-700 dark:text-gray-300">${content}</div>
      </div>
    </div>
  `;
}

function _wireAccordions() {
  const buttons = document.querySelectorAll('[data-acc-btn]');
  buttons.forEach((btn) => {
    if (btn.__wired) return;
    btn.__wired = true;

    const panelId = btn.getAttribute('aria-controls');
    const panel = document.getElementById(panelId);
    const chevron = btn.querySelector('[data-acc-chevron]');

    uiManager.addListener(btn, 'click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      _animateToggle(panel, !isOpen);
      if (chevron) chevron.style.transform = !isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  });
}


function _animateToggle(panel, open) {
  if (!panel) return;
  const currentlyOpen = panel.getAttribute('data-open') === 'true';
  if (open === currentlyOpen) return;

  const startHeight = panel.getBoundingClientRect().height;
  panel.style.maxHeight = startHeight + 'px';
  panel.style.overflow = 'hidden';
  panel.setAttribute('data-open', String(open));

  const targetHeight = open ? panel.scrollHeight : 0;

  requestAnimationFrame(() => {
    panel.style.maxHeight = targetHeight + 'px';
  });

  const onEnd = () => {
    panel.style.maxHeight = open ? 'none' : '0';
    panel.style.overflow = open ? 'visible' : 'hidden';
    panel.removeEventListener('transitionend', onEnd);
  };
  panel.addEventListener('transitionend', onEnd, { once: true });
}

/* =========================
   Normalize + Status (10:20 rule)
========================= */

function _normalizeTask(task, evaluations, assignmentNumberMap) {
  const raw = _coerceDate(task.date);
  const adjusted = _applyDefaultTimeIfDateOnly(raw) || raw;

  const status = _getTaskStatus({ ...task, date: adjusted });
  const dateInfo = _getDateInfo(adjusted);
  const participants = _countParticipants(task.id, evaluations);
  const stableNumber =
    assignmentNumberMap instanceof Map ? assignmentNumberMap.get(task.id) : undefined;
  const derivedNumber =
    typeof stableNumber === 'number' && Number.isFinite(stableNumber)
      ? stableNumber
      : typeof task.assignmentNumber === 'number' && task.assignmentNumber > 0
      ? task.assignmentNumber
      : 0;

  // Calculate total max score from breakdown or direct maxScore
  const breakdown = task.maxScoreBreakdown || {};
  const totalMaxScore = task.maxScoreBreakdown
    ? (parseFloat(breakdown.task) || 0) +
      (parseFloat(breakdown.team) || 0) +
      (parseFloat(breakdown.additional) || 0) +
      (parseFloat(breakdown.mcq) || 0)
    : parseFloat(task.maxScore) || 100;

  return {
    id: task.id,
    name: helpers.ensureBengaliText(task.name || 'অজ্ঞাত এসাইনমেন্ট'),
    status,
    dateLabel: dateInfo.label,
    timelineLabel: dateInfo.timelineLabel,
    scheduleText: dateInfo.scheduleText, // not repeated near the pill
    startTimeLabel: dateInfo.startTimeLabel,
    description: task.description || '',
    participants,
    assignmentNumber: derivedNumber,
    dateISO: adjusted ? adjusted.toISOString() : '',
    _dateObj: adjusted,
    // Include class, section, subject for filtering and display
    classId: task.classId || '',
    sectionId: task.sectionId || '',
    subjectId: task.subjectId || '',
    className: (stateManager.get('classes') || []).find(c => c.id === task.classId)?.name || '',
    sectionName: (stateManager.get('sections') || []).find(s => s.id === task.sectionId)?.name || '',
    subjectName: (stateManager.get('subjects') || []).find(s => s.id === task.subjectId)?.name || '',
    // Include max score for display
    maxScore: totalMaxScore,
    maxScoreBreakdown: breakdown,
  };
}

function _getTaskStatus(task) {
  const stored = typeof task.status === 'string' ? task.status.toLowerCase() : '';
  if (STATUS_ORDER.includes(stored)) return stored;
  return _deriveStatusFromDate(task.date);
}

function _deriveStatusFromDate(dateObj) {
  const { isFuture, isToday } = _getDateInfo(dateObj);
  if (isFuture) return 'upcoming';
  if (isToday) return 'ongoing';
  return 'completed';
}

function _getDateInfo(dateObj) {
  if (!dateObj) {
    return {
      label: 'তারিখ নির্ধারিত নয়',
      scheduleText: 'তারিখ আপডেট প্রয়োজন',
      timelineLabel: 'সময়রেখা অনুপস্থিত',
      startTimeLabel: 'সকাল ১১:৫৫ am',
      isFuture: false,
      isToday: false,
    };
  }

  const adjusted = _applyDefaultTimeIfDateOnly(dateObj) || dateObj;

  const now = new Date();
  const isFuture = adjusted.getTime() > now.getTime();

  const sameDay =
    adjusted.getFullYear() === now.getFullYear() &&
    adjusted.getMonth() === now.getMonth() &&
    adjusted.getDate() === now.getDate();

  const isToday = sameDay && adjusted.getTime() >= now.getTime();

  const label = _formatScheduleLabel(adjusted);
  const startTimeLabel = _formatScheduleTime(adjusted);

  let scheduleText = 'অনুষ্ঠিত হয়েছে';
  let timelineLabel = 'সমাপ্ত সময়সূচি';
  if (isFuture) {
    scheduleText = 'অনুষ্ঠিত হবে';
    timelineLabel = 'আসন্ন সময়সূচি';
  } else if (isToday) {
    scheduleText = 'আজ অনুষ্ঠিত';
    timelineLabel = 'চলমান সময়সূচি';
  }

  return { label, scheduleText, timelineLabel, startTimeLabel, isFuture, isToday };
}

function _countParticipants(taskId, evaluations) {
  if (!taskId || !evaluations?.length) return 0;
  const unique = new Set();
  evaluations.forEach((evaluation) => {
    if (evaluation.taskId !== taskId) return;
    const scoreEntries = evaluation.scores || {};
    Object.keys(scoreEntries).forEach((studentId) => unique.add(studentId));
  });
  return unique.size;
}

function _trimText(text, limit = 1060) {
  if (!text) return '';
  if (typeof helpers?.truncateText === 'function') {
    return helpers.truncateText(text, limit);
  }
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function _getGradientForStatus(status) {
  switch (status) {
    case 'ongoing':
      return 'from-amber-800 via-amber-700 to-orange-800 dark:from-amber-900 dark:via-amber-800 dark:to-orange-900';
    case 'completed':
      return 'from-emerald-800 via-emerald-700 to-emerald-800 dark:from-emerald-900 dark:via-emerald-800 dark:to-emerald-900';
    default:
      return 'from-sky-800 via-blue-700 to-cyan-800 dark:from-sky-900 dark:via-blue-800 dark:to-cyan-900';
  }
}

/* =========================
   Countdown Ticker
========================= */

function _startCountdownTicker() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  _tickCountdowns();
  countdownTimer = setInterval(_tickCountdowns, 1000);
}

function _tickCountdowns() {
  const nodes = document.querySelectorAll('[data-cd][data-iso]');
  nodes.forEach((wrap) => {
    const iso = wrap.getAttribute('data-iso') || '';
    const mode = wrap.getAttribute('data-mode') || 'start';
    const span = wrap.querySelector('.cd-text');
    if (!iso || !span) {
      if (span) span.textContent = 'সময় নেই';
      return;
    }
    const target = new Date(iso);
    const parts = _diffParts(target);
    span.textContent = _countdownLabel(parts, mode === 'start');

    // update color class according to remainingDays
    const cls = _countdownClass(parts);
    wrap.className = cls;
  });
}

/* =========================
   Filter System
========================= */

function _setupFilters() {
  // Re-cache filter elements after render
  elements.filtersContainer = document.getElementById('upcomingAssignmentsFilters');
  elements.classFilter = document.getElementById('upcomingClassFilter');
  elements.sectionFilter = document.getElementById('upcomingSectionFilter');
  elements.subjectFilter = document.getElementById('upcomingSubjectFilter');

  if (!elements.filtersContainer) return;

  const user = stateManager.get('currentUserData');
  const isTeacher = user && user.type === 'teacher';
  const isAdmin = user ? (user.type === 'admin' || user.type === 'super-admin') : true;

  // Teachers don't see filters (auto-filtered by stateManager.getFilteredData)
  if (isTeacher) {
    elements.filtersContainer.classList.add('hidden');
    return;
  }

  // Admins/Public: Show and populate filters
  if (isAdmin) {
    elements.filtersContainer.classList.remove('hidden');

    if (!elements.classFilter || !elements.sectionFilter || !elements.subjectFilter) return;

    // Get all data
    const allClasses = stateManager.get('classes') || [];
    const allSections = stateManager.get('sections') || [];
    const allSubjects = stateManager.get('subjects') || [];

    // Remove duplicates by name
    const uniqueClasses = Array.from(new Map(allClasses.map(c => [c.name, c])).values());
    const uniqueSections = Array.from(new Map(allSections.map(s => [s.name, s])).values());
    const uniqueSubjects = Array.from(new Map(allSubjects.map(s => [s.name, s])).values());

    // Populate dropdowns (Use Name as value for Section/Subject to handle deduplication)
    uiManager.populateSelect(elements.classFilter, uniqueClasses.map(c => ({ value: c.id, text: c.name })), 'সকল ক্লাস');
    uiManager.populateSelect(elements.sectionFilter, uniqueSections.map(s => ({ value: s.name, text: s.name })), 'সকল শাখা');
    uiManager.populateSelect(elements.subjectFilter, uniqueSubjects.map(s => ({ value: s.name, text: s.name })), 'সকল বিষয়');

    // Restore filter values from state
    if (filterState.classId) elements.classFilter.value = filterState.classId;
    if (filterState.sectionId) elements.sectionFilter.value = filterState.sectionId;
    if (filterState.subjectId) elements.subjectFilter.value = filterState.subjectId;

    // Add change listeners
    elements.classFilter.onchange = _onFilterChange;
    elements.sectionFilter.onchange = _onFilterChange;
    elements.subjectFilter.onchange = _onFilterChange;
  }
}

function _applyFilters(tasks) {
  const user = stateManager.get('currentUserData');
  const isTeacher = user && user.type === 'teacher';

  // Teachers already get filtered data from stateManager.getFilteredData
  if (isTeacher) return tasks;

  // Normalize filter values - empty string or "all" means no filter
  const classId = (filterState.classId && filterState.classId !== 'all') ? filterState.classId : '';
  const sectionId = (filterState.sectionId && filterState.sectionId !== 'all') ? filterState.sectionId : '';
  const subjectId = (filterState.subjectId && filterState.subjectId !== 'all') ? filterState.subjectId : '';

  // If no filters selected, return all tasks
  if (!classId && !sectionId && !subjectId) {
    console.log('📋 No filters selected, showing all tasks:', tasks.length);
    return tasks;
  }

  // Note: sectionId and subjectId now hold NAMES, not IDs (for deduplication support)
  const selectedSectionName = (sectionId || '').trim().toLowerCase().normalize('NFC');
  const selectedSubjectName = (subjectId || '').trim().toLowerCase().normalize('NFC');

  console.log('🔍 Filter values:', { classId, selectedSectionName, selectedSubjectName });

  // Filter tasks
  const filtered = tasks.filter(task => {
    // 1. Filter by Class (direct ID match)
    if (classId && String(task.classId) !== String(classId)) {
      return false;
    }
    
    // 2. Filter by Section (Name match)
    if (selectedSectionName) {
        let taskSectionName = task.sectionName?.trim().toLowerCase() || '';
        
        // Safety: If name missing in task, try to look it up
        if (!taskSectionName && task.sectionId) {
           const allSections = stateManager.get('sections') || [];
           const s = allSections.find(sec => String(sec.id) === String(task.sectionId));
           if (s) taskSectionName = s.name.trim().toLowerCase();
        }

        if (!taskSectionName || taskSectionName !== selectedSectionName) {
          return false;
        }
    }
    
    // 3. Filter by Subject (Name match)
    if (selectedSubjectName) {
        let taskSubjectName = (task.subjectName || '').trim().toLowerCase().normalize('NFC');
        
        // Safety: If name missing in task, try to look it up
        if (!taskSubjectName && task.subjectId) {
           const allSubjects = stateManager.get('subjects') || [];
           const s = allSubjects.find(sub => String(sub.id) === String(task.subjectId));
           if (s) taskSubjectName = s.name.trim().toLowerCase().normalize('NFC');
        }

        if (!taskSubjectName || taskSubjectName !== selectedSubjectName) {
          return false;
        }
    }
    
    return true;
  });

  console.log('📊 Filtered tasks:', filtered.length, '/', tasks.length);
  
  return filtered;
}

function _onFilterChange() {
  // Save filter state before re-rendering
  if (elements.classFilter) filterState.classId = elements.classFilter.value;
  if (elements.sectionFilter) filterState.sectionId = elements.sectionFilter.value;
  if (elements.subjectFilter) filterState.subjectId = elements.subjectFilter.value;
  
  console.log('🔄 Filter changed:', filterState);
  render();
}
