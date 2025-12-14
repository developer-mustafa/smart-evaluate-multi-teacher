// js/components/analysis.js



let stateManager;
let uiManager;
let helpers;
let app;

const ANALYSIS_FILTER_KEY = 'analysis';
const MAX_PERCENT = 100;

// Cached DOM elements
const elements = {
  summaryPage: null,
  summaryHeader: null,
  summaryContent: null,
  summaryFilterGroup: null,
  summaryFilterTask: null,
  summaryFilterViewButtons: null,
  graphPage: null,
  graphFiltersContainer: null,
  graphDashboardContainer: null, // Will be queried dynamically
  graphDetailContainer: null, // Will be queried dynamically
  printableArea: null,
};

const VIEW_MODES = {
  TABLE: 'table',
  CHART: 'chart',
};

const SUMMARY_EVAL_VIEWS = {
  TABLE: 'table',
  CHART: 'chart',
};

const ROLE_LABELS = {
  'team-leader': 'টিম লিডার',
  'time-keeper': 'টাইম কিপার',
  reporter: 'রিপোর্টার',
  'resource-manager': 'রিসোর্স ম্যানেজার',
  'peace-maker': 'পিস মেকার',
};

// --- CRITERIA DEFINITIONS ---
const CRITERIA_MAPPING = {
  topic: {
    topic_learned_well: {
      id: 'topic_learned_well',
      label: 'ভালো করে শিখেছি',
      marks: 10,
    },
    topic_understood: {
      id: 'topic_understood',
      label: 'শুধু বুঝেছি',
      marks: 5,
    },
    topic_none: {
      id: 'topic_none',
      label: 'এখনো এই টপিক পারিনা ',
      marks: -5,
    },
  },
  options: {
    attendance_regular: {
      id: 'attendance_regular',
      label: 'সাপ্তাহিক নিয়মিত উপস্থিতি',
      marks: 10,
    },
    homework_done: {
      id: 'homework_done',
      label: 'সপ্তাহে প্রতিদিন বাড়ির কাজ',
      marks: 5,
    },
  },
};

const CUSTOM_CRITERIA = {
  FULL_POSITIVE: {
    id: 'full_positive',
    label: 'সব মানদণ্ড পূরণ',
  },
  IMPROVEMENT_NEEDED: {
    id: 'improvement_needed',
    label: 'উন্নয়ন প্রয়োজন',
  },
};

// Pre-computed map for fast criteria lookups
const CRITERIA_META_INDEX = (() => {
  const map = new Map();
  Object.values(CRITERIA_MAPPING.topic).forEach((criteria) => {
    map.set(criteria.id, {
      ...criteria,
      category: 'topic',
      categoryLabel: 'বিষয়ভিত্তিক মানদণ্ড',
    });
  });
  Object.values(CRITERIA_MAPPING.options).forEach((criteria) => {
    map.set(criteria.id, {
      ...criteria,
      category: 'options',
      categoryLabel: 'সহায়ক মানদণ্ড',
    });
  });
  map.set(CUSTOM_CRITERIA.FULL_POSITIVE.id, {
    ...CUSTOM_CRITERIA.FULL_POSITIVE,
    category: 'summary',
    categoryLabel: 'বিশেষ ফোকাস',
  });
  map.set(CUSTOM_CRITERIA.IMPROVEMENT_NEEDED.id, {
    ...CUSTOM_CRITERIA.IMPROVEMENT_NEEDED,
    category: 'summary',
    categoryLabel: 'বিশেষ ফোকাস',
  });
  return map;
})();
// --- END CRITERIA ---

// Module state
// let pdfFontPromise = null; // Removed

let topicBarChart = null;
let criteriaPieChart = null;
let summaryEvaluationChart = null;
let currentCriteriaContext = null;
let currentCriteriaSelection = null;

/* ---------- THEME HELPERS (for visibility/contrast) ---------- */
function _isDarkMode() {
  try {
    return document.documentElement.classList.contains('dark');
  } catch {
    return false;
  }
}

function _getChartTheme() {
  const dark = _isDarkMode();
  return {
    tick: dark ? '#e5e7eb' /* gray-200 */ : '#334155' /* slate-700 */,
    grid: dark ? 'rgba(148,163,184,0.25)' /* slate-400 */ : 'rgba(148,163,184,0.2)',
    legend: dark ? '#f1f5f9' /* slate-100 */ : '#1f2937' /* gray-800 */,
    tooltipTitle: dark ? '#e5e7eb' : '#111827',
    tooltipBody: dark ? '#e5e7eb' : '#111827',
    tooltipBg: dark ? 'rgba(17,24,39,0.9)' /* gray-900 */ : 'rgba(255,255,255,0.95)',
    border: dark ? '#334155' : '#e5e7eb',
  };
}
/* ------------------------------------------------------------- */

/**
 * Initializes the Analysis component.
 * @param {object} dependencies - Injected dependencies.
 */
export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  helpers = dependencies.utils;
  app = dependencies.app;

  _cacheDOMElements();
  _ensureFilters();
  _bindStaticListeners(); // Bind persistent listeners once
  _renderAll();

  if (!window.smartEvaluator) window.smartEvaluator = {};
  window.smartEvaluator.components = window.smartEvaluator.components || {};
  window.smartEvaluator.components.analysis = {
    render: _renderAll,
    generateGroupAnalysisPDF,
    generateSelectedGroupPDF,
    generateGroupWiseFullDetailsPDF,
    printGroupAnalysis,
  };

  return {
    renderSummary: _renderSummarySection,
    renderGraphs: _renderGraphSection,
    generateGroupAnalysisPDF,
    generateSelectedGroupPDF,
    generateGroupWiseFullDetailsPDF,
    printGroupAnalysis,
  };
}

/**
 * Caches static DOM elements for reuse.
 */
function _cacheDOMElements() {
  elements.summaryPage = document.getElementById('page-group-analysis');
  elements.summaryContent = document.getElementById('groupAnalysisDetails');
  elements.summaryFilterGroup = document.getElementById('analysisGroupSelect');
  elements.printableArea = document.getElementById('printableAnalysisArea');

  elements.graphPage = document.getElementById('page-graph-analysis');
  elements.graphFiltersContainer = document.getElementById('graphAnalysisContent');
  // graphDashboardContainer & graphDetailContainer are dynamic and will be queried post-render
}

/**
 * Binds all static event listeners using event delegation.
 * This is more efficient than re-binding on every render.
 */
function _bindStaticListeners() {
  // --- Summary Page Listeners ---
  if (elements.summaryFilterGroup) {
    uiManager.addListener(elements.summaryFilterGroup, 'change', (event) => {
      _updateFilters({ groupFilter: event.target.value });
    });
  }

  if (elements.summaryContent) {
    uiManager.addListener(elements.summaryContent, 'click', (event) => {
      const summaryAction = event.target.closest('[data-summary-action]');
      if (summaryAction) {
        event.preventDefault();
        const action = summaryAction.dataset.summaryAction;
        switch (action) {
          case 'print':
            printGroupAnalysis();
            break;
          case 'pdf-all':
            generateGroupAnalysisPDF();
            break;
          case 'pdf-group':
            if (!summaryAction.disabled) {
              generateSelectedGroupPDF();
            }
            break;
        }
        return; // Handled
      }

      const summaryEvalView = event.target.closest('[data-summary-eval-view]');
      if (summaryEvalView) {
        event.preventDefault();
        const value = summaryEvalView.dataset.analysisValue;
        if (value) {
          _updateFilters({ summaryEvaluationView: value });
        }
      }
    });
  }

  // --- Graph Page Filter Listeners ---
  if (elements.graphFiltersContainer) {
    // One listener for all button clicks in this container
    uiManager.addListener(elements.graphFiltersContainer, 'click', (event) => {
      const evalButton = event.target.closest('[data-analysis-evaluation]');
      if (evalButton) {
        const value = evalButton.dataset.analysisValue;
        _updateFilters({ evaluationType: value });
        return;
      }

      const viewButton = event.target.closest('[data-analysis-view]');
      if (viewButton) {
        const value = viewButton.dataset.analysisValue;
        _updateFilters({ viewMode: value });
        return;
      }

      const criteriaViewButton = event.target.closest('[data-analysis-criteria-view]');
      if (criteriaViewButton) {
        const value = criteriaViewButton.dataset.analysisValue;
        _updateFilters({ criteriaView: value });
      }
    });

    // One listener for all <select> and <input> changes
    uiManager.addListener(elements.graphFiltersContainer, 'change', (event) => {
      const targetId = event.target.id;
      switch (targetId) {
        case 'analysisGraphGroupSelect':
          _updateFilters({ groupFilter: event.target.value });
          break;
        case 'analysisGraphTaskSelect':
          _updateFilters({ taskFilter: event.target.value });
          break;
        case 'analysisFullCriteriaToggle':
          _updateFilters({ showFullOnly: event.target.checked });
          break;
      }
    });
  }

  // --- Graph Dashboard Listeners (for criteria cards) ---
  if (elements.graphPage) {
    uiManager.addListener(elements.graphPage, 'click', (event) => {
      const criteriaCard = event.target.closest('[data-criteria-id]');
      // Ensure the dashboard container exists before trying to find cards
      if (criteriaCard && elements.graphDashboardContainer) {
        const value = criteriaCard.dataset.criteriaId;
        if (!value || value === currentCriteriaSelection) return;

        currentCriteriaSelection = value;

        // Update active state of cards
        _updateCriteriaCardStates();

        // Re-render detail section
        _renderCriteriaDetailSection();
      }
    });
  }
}

/**
 * Ensures default filters are set in the state.
 */
function _ensureFilters() {
  const merged = _normalizeAnalysisFilters(stateManager.getFilterSection(ANALYSIS_FILTER_KEY));
  stateManager.updateFilters(ANALYSIS_FILTER_KEY, merged);
  return merged;
}

function _normalizeAnalysisFilters(source) {
  const base = (source && typeof source === 'object') ? source : {};
  return {
    groupFilter: base.groupFilter ?? 'all',
    taskFilter: base.taskFilter ?? 'all',
    evaluationType: base.evaluationType ?? 'all',
    viewMode: base.viewMode ?? VIEW_MODES.TABLE,
    showFullOnly: Boolean(base.showFullOnly),
    criteriaView: base.criteriaView ?? 'topic',
    summaryEvaluationView: base.summaryEvaluationView ?? SUMMARY_EVAL_VIEWS.TABLE,
  };
}

/**
 * Main render function. Builds data once and passes it to sub-renderers.
 */
function _renderAll() {
  const filters = stateManager.getFilterSection(ANALYSIS_FILTER_KEY);
  // Build data ONCE, as it's the most expensive operation
  const data = _buildAnalysisData(filters);

  try {
    _renderSummarySection(filters, data);
  } catch (e) {
    console.error('❌ Failed to render summary section:', e);
    if (elements.summaryContent) {
      elements.summaryContent.innerHTML =
        '<div class="card card-body text-rose-600 dark:text-rose-300 p-4">দুঃখিত, সারাংশ বিশ্লেষণ লোড করা যায়নি।</div>';
    }
  }

  try {
    _renderGraphSection(filters, data);
  } catch (e) {
    console.error('❌ Failed to render graph section:', e);
    if (elements.graphFiltersContainer) {
      // Use graphFiltersContainer as graphDashboardContainer might not exist
      elements.graphFiltersContainer.innerHTML +=
        '<div class="card card-body text-rose-600 dark:text-rose-300 p-4 mt-4">দুঃখিত, গ্রাফ বিশ্লেষণ লোড করা যায়নি।</div>';
    }
  }
}

/**
 * Updates filters in the state and triggers a full re-render.
 * @param {object} updates - Filter key/value pairs to update.
 */
function _updateFilters(updates) {
  const current = { ...(stateManager.getFilterSection(ANALYSIS_FILTER_KEY) || {}) };
  const next = { ...current, ...updates };

  stateManager.updateFilters(ANALYSIS_FILTER_KEY, next);
  _renderAll();
}

// ===================================================================
//
// SUMMARY PAGE SECTION
//
// ===================================================================

/**
 * Renders the entire summary section.
 * @param {object} filters - The current filter state.
 * @param {object} data - The pre-computed analysis data.
 */
function _renderSummarySection(filters, data) {
  if (!elements.summaryPage || !elements.summaryContent) return;

  let safeFilters = filters;
  if (!safeFilters || typeof safeFilters !== 'object') {
    safeFilters = _ensureFilters();
  } else {
    safeFilters = _normalizeAnalysisFilters(safeFilters);
  }

  let summaryData = data;
  if (!summaryData) {
    try {
      summaryData = _buildAnalysisData(safeFilters);
    } catch {
      summaryData = null;
    }
  }

  _renderSummaryFilters(safeFilters, summaryData);
  _renderSummaryDashboard(safeFilters, summaryData);
}

/**
 * Renders the filter dropdowns for the summary page.
 * @param {object} filters - The current filter state.
 * @param {object} analysisData - The pre-computed analysis data.
 */
function _renderSummaryFilters(filters, analysisData) {
  if (!elements.summaryFilterGroup) return;
  
  const groups = (analysisData && analysisData.options && Array.isArray(analysisData.options.groups)) 
    ? analysisData.options.groups 
    : [];
  const selected = (filters && filters.groupFilter) ? filters.groupFilter : 'all';
  elements.summaryFilterGroup.innerHTML = [
    '<option value="all">সমস্ত গ্রুপ</option>',
    ...groups.map(
      (group) =>
        `<option value="${group.id}" ${group.id === selected ? 'selected' : ''}>${group.label}</option>`
    ),
  ].join('');

  elements.summaryFilterGroup.value = selected;
  // No need to re-bind listener; it's handled by _bindStaticListeners
}

/**
 * Renders the main dashboard for the summary page.
 * @param {object} filters - The current filter state.
 * @param {object} analysisData - The pre-computed analysis data.
 */
function _renderSummaryDashboard(filters, analysisData) {
  if (!elements.summaryContent) return;

  const { groupMetrics, summary } = analysisData;
  const groupDetails = analysisData.groupDetails || new Map();
  const selectedGroupId = filters.groupFilter;
  const summaryView = filters.summaryEvaluationView || SUMMARY_EVAL_VIEWS.TABLE;
  const hasGroupSelected = selectedGroupId && selectedGroupId !== 'all';
  const selectedGroupData = hasGroupSelected ? groupDetails.get(selectedGroupId) : null;

  if (!hasGroupSelected || !selectedGroupData) {
    // Render "All Groups" view
    const actionsHtml = _renderSummaryActions(false);
    const cardsHtml = _renderSummaryCards(summary);
    const tableHtml = _renderGroupTable(groupMetrics, filters);

    elements.summaryContent.innerHTML = `
      <div class="space-y-6" id="printableAnalysisArea">
        ${actionsHtml}
        ${cardsHtml}
        ${tableHtml}
      </div>
    `;

    _destroySummaryEvaluationChart();
    // No need to call _bindSummaryActions; handled by delegation
    return;
  }

  // Render "Single Group" view
  const actionsHtml = _renderSummaryActions(true);
  const overviewHeader = _renderGroupHeader(selectedGroupData);
  const overviewCards = _renderGroupOverviewCards(selectedGroupData.metric);
  const membersTable = _renderGroupMembersTable(selectedGroupData.members);
  const evaluationsSection = _renderGroupEvaluationsSection(selectedGroupData.evaluations, summaryView);

  elements.summaryContent.innerHTML = `
    <div class="space-y-6" id="printableAnalysisArea">
      ${actionsHtml}
      ${overviewHeader}
      ${overviewCards}
      ${membersTable}
      ${evaluationsSection}
    </div>
  `;

  // No need to call _bindSummaryActions or _bindSummaryEvaluationView
  // Just render the chart if needed
  if (summaryView === SUMMARY_EVAL_VIEWS.CHART) {
    _renderSummaryEvaluationChart(selectedGroupData.evaluations);
  } else {
    _destroySummaryEvaluationChart();
  }
}

/**
 * Generates HTML for the PDF/Print action buttons.
 * @param {boolean} hasGroupSelected - Toggles the "Selected Group PDF" button state.
 */
function _renderSummaryActions(hasGroupSelected) {
  const primaryClass =
    'inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 shadow transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const secondaryClass =
    'inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition focus:outline-none focus:ring-2 focus:ring-blue-500';

  return `
    <div class="flex flex-wrap items-center justify-end gap-2">
      <button type="button" class="${secondaryClass}" data-summary-action="print">
        <i class="fas fa-print"></i>
        Print
      </button>
      <button type="button" class="${secondaryClass}" data-summary-action="pdf-all">
        <i class="fas fa-file-pdf"></i>
        Export PDF
      </button>
      <button type="button" class="${primaryClass}${
    hasGroupSelected ? '' : ' opacity-60 cursor-not-allowed'
  }" data-summary-action="pdf-group" ${hasGroupSelected ? '' : 'disabled'}>
        <i class="fas fa-download"></i>
        Selected Group PDF
      </button>
    </div>
  `;
}

// Renders header for the selected group.
function _renderGroupHeader(groupData) {
  if (!groupData) return '';

  const metric = groupData.metric || {};
  const groupName = metric.groupName || 'Group';
  const totalStudents = _formatNumber(metric.studentCount || 0);
  const participation = _formatPercent(metric.participationRate || 0);
  const latestEvaluation = groupData.evaluations?.[0]?.dateLabel || '-';
  const mentor = groupData.group?.mentor ? _formatText(groupData.group.mentor) : '';

  return `
    <div class="card card-body flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
      <div>
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-50">${groupName}</h2>
        <p class="text-sm text-gray-700 dark:text-gray-300">শিক্ষার্থী: ${totalStudents} জন। অংশগ্রহণ: ${participation}</p>
        ${mentor ? `<p class="text-sm text-gray-700 dark:text-gray-300">মেন্টর: ${mentor}</p>` : ''}
      </div>
      <div class="text-sm text-gray-700 dark:text-gray-300">সর্বশেষ মূল্যায়ন: ${latestEvaluation}</div>
    </div>
  `;
}

// Renders overview cards for the selected group.
function _renderGroupOverviewCards(metric) {
  if (!metric) return '';
  return `
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      ${_createSummaryCard(
        'মোট মূল্যায়ন',
        metric.evaluationCount,
        'bg-blue-50 text-blue-800 dark:bg-gray-800/80 dark:text-white',
        'fa-clipboard-check'
      )}
      ${_createSummaryCard(
        'গড় মোট স্কোর (%)',
        _formatPercent(metric.averageScore),
        'bg-emerald-50 text-emerald-800 dark:bg-gray-800/80 dark:text-white',
        'fa-gauge'
      )}
      ${_createSummaryCard(
        'অংশগ্রহণের হার',
        _formatPercent(metric.participationRate),
        'bg-indigo-50 text-indigo-800 dark:bg-gray-800/80 dark:text-white',
        'fa-people-group'
      )}
      ${_createSummaryCard(
        'লম্বিত শিক্ষার্থী',
        _formatNumber(metric.pendingStudents),
        'bg-amber-50 text-amber-800 dark:bg-gray-800/80 dark:text-white',
        'fa-user-clock'
      )}
    </div>
  `;
}

// Renders the table of members for the selected group.
function _renderGroupMembersTable(members) {
  if (!Array.isArray(members) || !members.length) {
    return `
      <div class="card card-body bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
        <div class="placeholder-content text-gray-800 dark:text-gray-200">
          <i class="fas fa-user-group mr-2"></i>
          এই গ্রুপের জন্য এখনো কোনো শিক্ষার্থীর রেকর্ড পাওয়া যায়নি।
        </div>
      </div>
    `;
  }

  const rows = members
    .map((member) => {
      const hasEvaluations = member.evaluationCount > 0;
      const avgTask = hasEvaluations ? _formatDecimal(member.avgTaskScore) : '-';
      const avgTeam = hasEvaluations ? _formatDecimal(member.avgTeamScore) : '-';
      const avgAdditional = hasEvaluations ? _formatDecimal(member.avgAdditionalScore) : '-';
      const avgTotal = hasEvaluations ? _formatDecimal(member.avgTotalScore) : '-';
      const comment = member.latestComment ? _formatText(member.latestComment) : '-';
      const roleLabel = _formatRole(member.role);
      const evaluationsCount = _formatNumber(member.evaluationCount || 0);

      return `
        <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition">
          <td class="px-4 py-3">
            <div class="font-semibold text-gray-900 dark:text-gray-100">${member.name}</div>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <span>মূল্যায়ন: ${evaluationsCount}</span>
              ${
                roleLabel
                  ? `<span class="inline-flex items-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100 px-2 py-0.5">${roleLabel}</span>`
                  : ''
              }
            </div>
          </td>
          <td class="px-4 py-3 text-gray-800 dark:text-gray-200">${member.roll ? _formatText(member.roll) : '-'}</td>
          <td class="px-4 py-3 text-gray-800 dark:text-gray-200">${member.academicGroup || '-'}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${avgTeam}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${avgTask}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${avgAdditional}</td>
          <td class="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">${comment}</td>
          <td class="px-4 py-3 text-center font-semibold text-indigo-700 dark:text-indigo-300">${avgTotal}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="card bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
      <div class="card-header flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-50">গ্রুপ সদস্যদের সারাংশ</h3>
      </div>
      <div class="card-body overflow-x-auto">
        <table class="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-4 py-3 text-left font-semibold uppercase text-gray-700 dark:text-gray-300">শিক্ষার্থীর নাম</th>
              <th class="px-4 py-3 text-left font-semibold uppercase text-gray-700 dark:text-gray-300">রোল</th>
              <th class="px-4 py-3 text-left font-semibold uppercase text-gray-700 dark:text-gray-300">একাডেমিক গ্রুপ</th>
              <th class="px-4 py-3 text-center font-semibold uppercase text-gray-700 dark:text-gray-300">টিম স্কোর</th>
              <th class="px-4 py-3 text-center font-semibold uppercase text-gray-700 dark:text-gray-300">টাস্ক স্কোর</th>
              <th class="px-4 py-3 text-center font-semibold uppercase text-gray-700 dark:text-gray-300">অতিরিক্ত স্কোর</th>
              <th class="px-4 py-3 text-left font-semibold uppercase text-gray-700 dark:text-gray-300">মন্তব্য</th>
              <th class="px-4 py-3 text-center font-semibold uppercase text-gray-700 dark:text-gray-300">গড় মার্কস</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Renders the evaluations section (table or chart) for the selected group.
function _renderGroupEvaluationsSection(evaluations, view) {
  const hasEvaluations = Array.isArray(evaluations) && evaluations.length > 0;

  if (!hasEvaluations) {
    return `
      <div class="card card-body bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
        <div class="placeholder-content text-gray-800 dark:text-gray-200">
          <i class="fas fa-chart-bar mr-2"></i>
          এই গ্রুপের জন্য এখনো কোনো মূল্যায়ন পাওয়া যায়নি।
        </div>
      </div>
    `;
  }

  const viewButtons = [SUMMARY_EVAL_VIEWS.TABLE, SUMMARY_EVAL_VIEWS.CHART]
    .map((mode) =>
      _createToggleButton(
        mode,
        mode === SUMMARY_EVAL_VIEWS.TABLE ? 'টেবিল ভিউ' : 'বার চার্ট ভিউ',
        view === mode,
        'data-summary-eval-view' // This attribute is used by the delegated listener
      )
    )
    .join('');

  const mainContent =
    view === SUMMARY_EVAL_VIEWS.CHART
      ? '<div class="h-80"><canvas id="summaryEvaluationChart"></canvas></div>'
      : _renderGroupEvaluationsTable(evaluations);

  return `
    <div class="card bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
      <div class="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-50">গ্রুপ মূল্যায়ন বিশ্লেষণ</h3>
        <div class="flex flex-wrap gap-2">${viewButtons}</div>
      </div>
      <div class="card-body space-y-4">
        ${mainContent}
      </div>
    </div>
  `;
}

// Renders the table of past evaluations for the selected group.
function _renderGroupEvaluationsTable(evaluations) {
  const rows = evaluations
    .map((evaluation) => {
      const totalStudents = evaluation.assessedCount + evaluation.pendingCount;
      return `
        <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition">
          <td class="px-4 py-3 text-gray-900 dark:text-gray-100 font-semibold">${evaluation.taskName}</td>
          <td class="px-4 py-3 text-gray-800 dark:text-gray-200">${evaluation.dateLabel || '-'}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${_formatNumber(
            evaluation.assessedCount
          )} / ${_formatNumber(totalStudents)}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${_formatDecimal(
            evaluation.avgTaskScore
          )}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${_formatDecimal(
            evaluation.avgTeamScore
          )}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${_formatDecimal(
            evaluation.avgAdditionalScore
          )}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${_formatDecimal(
            evaluation.avgTotalScore
          )}</td>
          <td class="px-4 py-3 text-center font-semibold text-indigo-700 dark:text-indigo-300">${_formatPercent(
            evaluation.averagePercentage
          )}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th class="px-4 py-3 text-left font-semibold uppercase text-gray-700 dark:text-gray-300">মূল্যায়ন</th>
            <th class="px-4 py-3 text-left font-semibold uppercase text-gray-700 dark:text-gray-300">তারিখ</th>
            <th class="px-4 py-3 text-center font-semibold uppercase text-gray-700 dark:text-gray-300">অংশগ্রহণ</th>
            <th class="px-4 py-3 text-center font-semibold uppercase text-gray-700 dark:text-gray-300">গড় টাস্ক</th>
            <th class="px-4 py-3 text-center font-semibold uppercase text-gray-700 dark:text-gray-300">গড় টিম</th>
            <th class="px-4 py-3 text-center font-semibold uppercase text-gray-700 dark:text-gray-300">গড় অতিরিক্ত</th>
            <th class="px-4 py-3 text-center font-semibold uppercase text-gray-700 dark:text-gray-300">গড় মোট</th>
            <th class="px-4 py-3 text-center font-semibold uppercase text-gray-700 dark:text-gray-300">গড় %</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

// Renders the bar chart for group evaluations over time.
function _renderSummaryEvaluationChart(evaluations) {
  if (!Array.isArray(evaluations) || !evaluations.length) {
    _destroySummaryEvaluationChart();
    return;
  }

  const canvas = document.getElementById('summaryEvaluationChart');
  if (!canvas) return;

  if (summaryEvaluationChart) {
    summaryEvaluationChart.destroy();
    summaryEvaluationChart = null;
  }

  const labels = evaluations.map((evaluation) => evaluation.taskName);
  const taskData = evaluations.map((evaluation) => evaluation.avgTaskScore || 0);
  const teamData = evaluations.map((evaluation) => evaluation.avgTeamScore || 0);
  const additionalData = evaluations.map((evaluation) => evaluation.avgAdditionalScore || 0);
  const totalData = evaluations.map((evaluation) => evaluation.avgTotalScore || 0);
  const theme = _getChartTheme();

  summaryEvaluationChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'টাস্ক', data: taskData, backgroundColor: 'rgba(99, 102, 241, 0.85)' },
        { label: 'টিম', data: teamData, backgroundColor: 'rgba(16, 185, 129, 0.85)' },
        { label: 'অতিরিক্ত', data: additionalData, backgroundColor: 'rgba(251, 191, 36, 0.9)' },
        { label: 'মোট', data: totalData, backgroundColor: 'rgba(59, 130, 246, 0.9)' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          stacked: false,
          ticks: { color: theme.tick },
          grid: { color: theme.grid },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: theme.tick,
            callback: (value) => _formatDecimal(value),
          },
          grid: { color: theme.grid },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, color: theme.legend },
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipTitle,
          bodyColor: theme.tooltipBody,
          callbacks: {
            label: (context) => `${context.dataset.label}: ${_formatDecimal(context.parsed.y)}`,
          },
        },
      },
    },
  });
}

function _destroySummaryEvaluationChart() {
  if (summaryEvaluationChart) {
    summaryEvaluationChart.destroy();
    summaryEvaluationChart = null;
  }
}

function _formatRole(role) {
  if (!role) return '';
  return ROLE_LABELS[role] || _formatText(role);
}

// ===================================================================
//
// GRAPH PAGE SECTION
//
// ===================================================================

/**
 * Renders the entire graph analysis section.
 * @param {object} filters - The current filter state.
 * @param {object} data - The pre-computed analysis data.
 */
function _renderGraphSection(filters, data) {
  if (!elements.graphPage || !elements.graphFiltersContainer) return;

  let safeFilters = filters;
  if (!safeFilters || typeof safeFilters !== 'object') {
    safeFilters = _ensureFilters();
  } else {
    safeFilters = _normalizeAnalysisFilters(safeFilters);
  }

  let graphData = data;
  if (!graphData) {
    try {
      graphData = _buildAnalysisData(safeFilters);
    } catch {
      graphData = null;
    }
  }
  if (!graphData) {
    graphData = {
      groupMetrics: [],
      summary: {},
      chartData: { bar: null, pie: null },
      criteriaContext: null,
      selectedGroupDetail: null,
      groupDetails: new Map(),
      options: { groups: [], tasks: [] },
    };
  }

  _renderGraphFilters(safeFilters, graphData);
  _renderGraphDashboard(safeFilters, graphData);
}

/**
 * Renders the filter controls for the graph page.
 * @param {object} filters - The current filter state.
 * @param {object} analysisData - The pre-computed analysis data.
 */
function _renderGraphFilters(filters, analysisData) {
  const safeFilters = filters || {};
  const selectedGroup = safeFilters.groupFilter || 'all';
  const selectedTask = safeFilters.taskFilter || 'all';
  const viewMode = safeFilters.viewMode || VIEW_MODES.TABLE;
  const evaluationType = safeFilters.evaluationType || 'all';
  const criteriaView = safeFilters.criteriaView || 'topic';
  const showFullOnly = Boolean(safeFilters.showFullOnly);

  const options = analysisData?.options || {};
  const groups = Array.isArray(options.groups) ? options.groups : [];
  const tasks = Array.isArray(options.tasks) ? options.tasks : [];
  const summary = analysisData?.summary || {};

  const groupOptions = [
    `<option value="all"${selectedGroup === 'all' ? ' selected' : ''}>সমস্ত গ্রুপ</option>`,
    ...groups.map(
      (group) => `<option value="${group.id}"${group.id === selectedGroup ? ' selected' : ''}>${group.label}</option>`
    ),
  ].join('');

  const taskOptions = [
    `<option value="all"${selectedTask === 'all' ? ' selected' : ''}>সমস্ত মূল্যায়ন</option>`,
    ...tasks.map(
      (task) => `<option value="${task.id}"${task.id === selectedTask ? ' selected' : ''}>${task.label}</option>`
    ),
  ].join('');

  const viewButtons = Object.values(VIEW_MODES)
    .map((mode) =>
      _createToggleButton(
        mode,
        mode === VIEW_MODES.TABLE ? 'টেবিল ভিউ' : 'গ্রাফ ভিউ',
        viewMode === mode,
        'data-analysis-view'
      )
    )
    .join('');

  const evaluationButtons = ['all', 'mcq', 'regular']
    .map((value) => {
      const label =
        value === 'all'
          ? 'সমস্ত মূল্যায়ন'
          : value === 'mcq'
          ? 'MCQ মূল্যায়ন'
          : 'নিয়মিত মূল্যায়ন';
      return _createToggleButton(value, label, evaluationType === value, 'data-analysis-evaluation');
    })
    .join('');

  const criteriaViewButtons = ['topic', 'options', 'summary']
    .map((value) => {
      const label =
        value === 'topic'
          ? 'বিষয়ভিত্তিক মানদণ্ড'
          : value === 'options'
          ? 'সহায়ক মানদণ্ড'
          : 'সারসংক্ষেপ';
      return _createToggleButton(value, label, criteriaView === value, 'data-analysis-criteria-view');
    })
    .join('');

  const groupsInView = _formatNumber(summary.groupsInView ?? 0);
  const totalGroups = _formatNumber(summary.totalGroups ?? groups.length);
  const participation = _formatPercent(summary.participationRate ?? 0);
  const latestEvaluation = summary.latestEvaluation || '-';

  elements.graphFiltersContainer.innerHTML = `
    <div class="space-y-6">
      <div class="grid gap-4 lg:grid-cols-4">
        <div>
          <label class="label text-gray-900 dark:text-gray-100" for="analysisGraphGroupSelect">গ্রুপ নির্বাচন</label>
          <select id="analysisGraphGroupSelect" class="form-select bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
            ${groupOptions}
          </select>
        </div>
        <div>
          <label class="label text-gray-900 dark:text-gray-100" for="analysisGraphTaskSelect">মূল্যায়ন নির্বাচন</label>
          <select id="analysisGraphTaskSelect" class="form-select bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
            ${taskOptions}
          </select>
        </div>
        <div>
          <label class="label text-gray-900 dark:text-gray-100">মূল্যায়ন ধরন</label>
          <div class="flex flex-wrap gap-2" id="analysisGraphEvaluationButtons">
            ${evaluationButtons}
          </div>
        </div>
        <div>
          <label class="label text-gray-900 dark:text-gray-100">মানদণ্ড ভিউ</label>
          <div class="flex flex-wrap gap-2" id="analysisCriteriaViewButtons">
            ${criteriaViewButtons}
          </div>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex flex-wrap gap-2" id="analysisGraphViewButtons">
          ${viewButtons}
        </div>
        <label class="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input type="checkbox" class="form-checkbox" id="analysisFullCriteriaToggle" ${showFullOnly ? 'checked' : ''}>
          পূর্ণ নম্বর পাওয়া শিক্ষার্থীদেরই দেখাও
        </label>
        <div class="text-sm text-gray-800 dark:text-gray-200">
          দৃশ্যমান গ্রুপ: ${groupsInView} / ${totalGroups} · অংশগ্রহণ: ${participation} · সর্বশেষ মূল্যায়ন: ${latestEvaluation}
        </div>
      </div>
    </div>
  `;

  // No event listeners to bind here; _bindStaticListeners() handles it.
}
function _renderGraphDashboard(filters, analysisData) {
  const { groupMetrics, chartData, selectedGroupDetail, summary, criteriaContext } = analysisData;

  const visibleBuckets = _getCriteriaBucketsForView(criteriaContext, filters.criteriaView);
  const summaryCards = _renderSummaryCards(summary);
  const criteriaSection = _renderCriteriaOverview(criteriaContext, filters, visibleBuckets);
  const mainSection =
    filters.viewMode === VIEW_MODES.TABLE ? _renderGroupTable(groupMetrics, filters) : _renderChartsMarkup(chartData);
  const detailSection = `
    <div class="graph-detail-container space-y-6">
      ${selectedGroupDetail ? _renderGroupDetail(selectedGroupDetail) : ''}
      ${_renderCriteriaDetailPlaceholder(criteriaContext, visibleBuckets)}
    </div>
  `;
  const dashboard = `
    <div class="space-y-6">
      ${summaryCards}
      ${mainSection}
      ${criteriaSection}
      ${detailSection}
    </div>
  `;

  if (elements.graphPage) {
    if (!elements.graphDashboardContainer) {
      elements.graphDashboardContainer = document.createElement('div');
      elements.graphDashboardContainer.className = 'graph-dashboard-container space-y-6';
      elements.graphPage.appendChild(elements.graphDashboardContainer);
    }
    elements.graphDashboardContainer.innerHTML = dashboard;

    // Re-cache dynamic elements
    elements.graphDetailContainer = elements.graphDashboardContainer.querySelector('.graph-detail-container');

    // Update UI state post-render
    _updateCriteriaCardStates();
    _renderCriteriaDetailSection();

    if (filters.viewMode === VIEW_MODES.CHART) {
      _initializeCharts(chartData);
    } else {
      _destroyCharts();
    }
  }
}

/**
 * Helper to create a toggle button's HTML string.
 */
function _createToggleButton(value, label, isActive, attribute) {
  const baseClass = 'px-4 py-2 rounded-full border text-sm transition-colors';
  const activeClass = 'bg-blue-600 text-white border-blue-600 shadow';
  const inactiveClass =
    'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800';

  return `<button type="button" class="${baseClass} ${isActive ? activeClass : inactiveClass}" ${
    attribute ? `${attribute}=""` : ''
  } data-analysis-value="${value}">${label}</button>`;
}

// ===================================================================
//
// DATA PROCESSING
//
// ===================================================================

/**
 * Builds the complete analysis data object from state.
 * This is the primary data aggregation function.
 * @param {object} filters - The current filter state.
 * @returns {object} The complete analysis data.
 */
function _buildAnalysisData(filters) {
  const groups = stateManager.get('groups') || [];
  const students = stateManager.get('students') || [];
  const tasks = stateManager.get('tasks') || [];
  const evaluations = stateManager.get('evaluations') || [];

  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const studentMap = new Map(students.map((student) => [student.id, student]));

  const studentsByGroup = new Map();
  students.forEach((student) => {
    if (!studentsByGroup.has(student.groupId)) {
      studentsByGroup.set(student.groupId, []);
    }
    studentsByGroup.get(student.groupId).push(student);
  });

  const groupSummaries = new Map();
  groups.forEach((group) => {
    const studentCount = studentsByGroup.get(group.id)?.length || 0;
    groupSummaries.set(group.id, {
      groupId: group.id,
      groupName: _formatText(group.name),
      studentCount,
      evaluationDetails: [],
    });
  });

  const taskOptionsMap = new Map();
  const groupDetailsMap = new Map();

  evaluations.forEach((evaluation) => {
    try {
      // Start of outer try-catch for the whole evaluation record
      const groupSummary = groupSummaries.get(evaluation.groupId);
      if (!groupSummary) return;

      const task = taskMap.get(evaluation.taskId);
      if (task) {
        taskOptionsMap.set(task.id, {
          id: task.id,
          label: _formatText(task.name),
        });
      }

      const evaluationType = _isMcqEvaluation(task) ? 'mcq' : 'regular';
      const scores = evaluation.scores || {};

      const participants = new Set();
      const fullPositiveStudents = new Set();
      const improvementStudents = new Set();

      const topicCounts = {
        learnedWell: 0,
        understood: 0,
        notYet: 0,
      };
      const optionCounts = {
        attendance: 0,
        homework: 0,
      };

      const taskSequence = (groupSummary.evaluationDetails?.length || 0) + 1;
      const detail = {
        evaluationId: evaluation.id,
        taskId: evaluation.taskId,
        taskName: _resolveTaskName(task, evaluation, taskSequence),
        type: evaluationType,
        dateMs: _extractTimestamp(evaluation.taskDate || evaluation.updatedAt || evaluation.evaluationDate),
        dateLabel: '',
        assessedCount: 0,
        pendingCount: 0,
        averagePercentage: 0,
        participationRate: 0,
        topicCounts,
        optionCounts,
        fullPositiveCount: 0,
        improvementCount: 0,
        fullPositiveAll: false,
        participantIds: [],
        fullPositiveStudentIds: [],
        improvementStudentIds: [],
        weightedScoreSum: 0,
        weight: 0,
        studentRecords: [],
      };

      Object.entries(scores).forEach(([studentId, scoreData]) => {
        try {
          // Start of inner try-catch for each student's score
          participants.add(studentId);

          const criteria = scoreData?.additionalCriteria || {};
          const topicChoice = criteria.topic || CRITERIA_MAPPING.topic.topic_none.id;
          const topicKey =
            topicChoice === CRITERIA_MAPPING.topic.topic_learned_well.id
              ? 'learnedWell'
              : topicChoice === CRITERIA_MAPPING.topic.topic_understood.id
              ? 'understood'
              : 'notYet';

          topicCounts[topicKey] = (topicCounts[topicKey] || 0) + 1;

          const attendance = Boolean(criteria.attendance);
          const homework = Boolean(criteria.homework);

          if (attendance) optionCounts.attendance += 1;
          if (homework) optionCounts.homework += 1;

          const fullPositive = topicKey === 'learnedWell' && attendance && homework;
          if (fullPositive) {
            fullPositiveStudents.add(studentId);
          }

          const improvementNeeded = topicKey === 'notYet' || !attendance || !homework;
          if (improvementNeeded) {
            improvementStudents.add(studentId);
          }

          const maxScore = parseFloat(evaluation.maxPossibleScore) || _deriveMaxScoreFromTask(task) || MAX_PERCENT;
          const rawScore = parseFloat(scoreData.totalScore) || 0;
          const percentage = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
          const taskScore = parseFloat(scoreData?.taskScore) || 0;
          const teamScore = parseFloat(scoreData?.teamScore) || 0;
          const additionalScore = parseFloat(scoreData?.additionalScore) || 0;
          const mcqScore = parseFloat(scoreData?.mcqScore) || 0;
          const comments = typeof scoreData?.comments === 'string' ? scoreData.comments.trim() : '';

          detail.weightedScoreSum += percentage;
          detail.weight += 1;

          detail.studentRecords.push({
            studentId,
            topicId: topicChoice,
            topicKey,
            attendance,
            homework,
            taskScore,
            teamScore,
            additionalScore,
            mcqScore,
            totalScore: rawScore,
            maxScore,
            percentage,
            evaluationId: evaluation.id,
            taskId: detail.taskId,
            taskName: detail.taskName,
            dateMs: detail.dateMs,
            dateLabel: detail.dateLabel,
            comments: _formatText(comments),
            problemRecovered: Boolean(scoreData.problemRecovered),
          });
          // End of inner try-catch
        } catch (scoreError) {
          console.warn(
            `⚠️ Skipping score record for student ${studentId} in evaluation ${evaluation.id} due to error:`,
            scoreError,
            scoreData
          );
        }
      });

      detail.assessedCount = participants.size;
      detail.pendingCount = Math.max(groupSummary.studentCount - detail.assessedCount, 0);
      detail.averagePercentage = detail.weight > 0 ? detail.weightedScoreSum / detail.weight : 0;
      detail.participationRate =
        groupSummary.studentCount > 0 ? Math.min(100, (detail.assessedCount / groupSummary.studentCount) * 100) : 0;
      detail.fullPositiveCount = fullPositiveStudents.size;
      detail.improvementCount = improvementStudents.size;
      detail.fullPositiveAll = detail.assessedCount > 0 && detail.fullPositiveCount === detail.assessedCount;
      detail.dateLabel = detail.dateMs ? _formatDate(detail.dateMs) : '';
      detail.participantIds = Array.from(participants);
      detail.fullPositiveStudentIds = Array.from(fullPositiveStudents);
      detail.improvementStudentIds = Array.from(improvementStudents);

      groupSummary.evaluationDetails.push(detail);
      // End of outer try-catch
    } catch (evalError) {
      console.error(`❌ Skipping evaluation ${evaluation.id} due to processing error:`, evalError, evaluation);
    }
  });

  const groupFilter = filters.groupFilter;
  const taskFilter = filters.taskFilter;
  const typeFilter = filters.evaluationType;

  const groupMetrics = [];
  let selectedGroupDetail = null;

  groupSummaries.forEach((summary) => {
    if (groupFilter !== 'all' && summary.groupId !== groupFilter) {
      return;
    }

    const relevantDetails = summary.evaluationDetails.filter((detail) => {
      const matchesTask = taskFilter === 'all' || detail.taskId === taskFilter;
      const matchesType = typeFilter === 'all' || detail.type === typeFilter;
      return matchesTask && matchesType;
    });

    if (!relevantDetails.length) {
      // Handle groups with no relevant evaluations
      const baseMembers = (studentsByGroup.get(summary.groupId) || []).map((student) => ({
        studentId: student.id,
        name: _formatText(student.name || student.id),
        roll: student.roll ?? '',
        role: student.role || '',
        academicGroup: _formatText(student.academicGroup || ''),
        avgTaskScore: 0,
        avgTeamScore: 0,
        avgAdditionalScore: 0,
        avgMcqScore: 0,
        avgTotalScore: 0,
        totalScore: 0,
        evaluationCount: 0,
        latestComment: '',
      }));

      groupDetailsMap.set(summary.groupId, {
        metric: {
          groupId: summary.groupId,
          groupName: summary.groupName,
          studentCount: summary.studentCount,
          evaluationCount: 0,
          mcqEvaluationCount: 0,
          assessedCount: 0,
          assessmentEntries: 0,
          pendingStudents: summary.studentCount,
          averageScore: 0,
          participationRate: 0,
          scoreWeight: 0,
          uniqueParticipantsCount: 0,
          topicCounts: { learnedWell: 0, understood: 0, notYet: 0 },
          optionCounts: { attendance: 0, homework: 0 },
          fullCriteriaStudents: 0,
          improvementCount: 0,
          fullCriteriaEvaluations: [],
          evaluationDetails: [],
          latestEvaluationMs: null,
        },
        group: groupMap.get(summary.groupId) || null,
        members: baseMembers,
        evaluations: [],
      });

      return;
    }

    // --- Aggregate Metrics for Relevant Evaluations ---
    const evaluationCount = relevantDetails.length;
    const mcqCount = relevantDetails.filter((d) => d.type === 'mcq').length;
    const totalAssessmentEntries = relevantDetails.reduce((sum, detail) => sum + detail.assessedCount, 0);
    const weightedScoreSum = relevantDetails.reduce((sum, detail) => sum + detail.weightedScoreSum, 0);
    const weight = relevantDetails.reduce((sum, detail) => sum + detail.weight, 0);

    const topicTotals = { learnedWell: 0, understood: 0, notYet: 0 };
    const optionTotals = { attendance: 0, homework: 0 };
    const participantIds = new Set();
    const fullPositiveIds = new Set();
    const improvementIds = new Set();
    const fullCriteriaSessions = [];

    relevantDetails.forEach((detail) => {
      topicTotals.learnedWell += detail.topicCounts.learnedWell;
      topicTotals.understood += detail.topicCounts.understood;
      topicTotals.notYet += detail.topicCounts.notYet;
      optionTotals.attendance += detail.optionCounts.attendance;
      optionTotals.homework += detail.optionCounts.homework;
      detail.participantIds.forEach((id) => participantIds.add(id));
      detail.fullPositiveStudentIds.forEach((id) => fullPositiveIds.add(id));
      detail.improvementStudentIds.forEach((id) => improvementIds.add(id));

      if (detail.fullPositiveAll) {
        fullCriteriaSessions.push(detail.taskName);
      }
    });

    const averageScore = weight > 0 ? weightedScoreSum / weight : 0;
    const uniqueParticipantsCount = participantIds.size;
    const pendingStudents = Math.max(summary.studentCount - uniqueParticipantsCount, 0);
    const participationRate =
      summary.studentCount > 0 ? Math.min(100, (uniqueParticipantsCount / summary.studentCount) * 100) : 0;

    const latestDateMs = relevantDetails.reduce(
      (acc, detail) => (detail.dateMs && detail.dateMs > acc ? detail.dateMs : acc),
      -Infinity
    );

    const metric = {
      groupId: summary.groupId,
      groupName: summary.groupName,
      studentCount: summary.studentCount,
      evaluationCount,
      mcqEvaluationCount: mcqCount,
      assessedCount: uniqueParticipantsCount,
      assessmentEntries: totalAssessmentEntries,
      pendingStudents,
      averageScore,
      participationRate,
      scoreWeight: weight,
      uniqueParticipantsCount,
      topicCounts: topicTotals,
      optionCounts: optionTotals,
      fullCriteriaStudents: fullPositiveIds.size,
      improvementCount: improvementIds.size,
      fullCriteriaEvaluations: fullCriteriaSessions,
      evaluationDetails: relevantDetails.sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0)),
      latestEvaluationMs: latestDateMs > 0 ? latestDateMs : null,
    };

    // --- Aggregate Member Details ---
    const groupStudents = studentsByGroup.get(summary.groupId) || [];
    const memberAggregates = new Map();

    groupStudents.forEach((student) => {
      memberAggregates.set(student.id, {
        studentId: student.id,
        name: _formatText(student.name || student.id),
        roll: student.roll ?? '',
        role: student.role || '',
        academicGroup: _formatText(student.academicGroup || ''),
        totalTaskScore: 0,
        totalTeamScore: 0,
        totalAdditionalScore: 0,
        totalMcqScore: 0,
        totalScore: 0,
        evaluationCount: 0,
        latestComment: '',
        latestCommentDate: -Infinity,
      });
    });

    relevantDetails.forEach((detail) => {
      detail.studentRecords.forEach((record) => {
        const studentId = record.studentId;
        if (!studentId) return;

        if (!memberAggregates.has(studentId)) {
          const studentInfo = studentMap.get(studentId) || {};
          memberAggregates.set(studentId, {
            studentId,
            name: _formatText(studentInfo.name || studentId),
            roll: studentInfo.roll ?? '',
            role: studentInfo.role || '',
            academicGroup: _formatText(studentInfo.academicGroup || ''),
            totalTaskScore: 0,
            totalTeamScore: 0,
            totalAdditionalScore: 0,
            totalMcqScore: 0,
            totalScore: 0,
            evaluationCount: 0,
            latestComment: '',
            latestCommentDate: -Infinity,
          });
        }

        const aggregate = memberAggregates.get(studentId);
        aggregate.totalTaskScore += record.taskScore || 0;
        aggregate.totalTeamScore += record.teamScore || 0;
        aggregate.totalAdditionalScore += record.additionalScore || 0;
        aggregate.totalMcqScore += record.mcqScore || 0;
        aggregate.totalScore += record.totalScore || 0;
        aggregate.evaluationCount += 1;

        if (record.comments) {
          const recordDate = record.dateMs || 0;
          if (recordDate >= aggregate.latestCommentDate) {
            aggregate.latestComment = record.comments;
            aggregate.latestCommentDate = recordDate;
          }
        }
      });
    });

    const membersDetailed = Array.from(memberAggregates.values())
      .map((aggregate) => {
        const evaluationCountSafe = aggregate.evaluationCount || 0;
        const divisor = evaluationCountSafe || 1;

        return {
          studentId: aggregate.studentId,
          name: aggregate.name,
          roll: aggregate.roll,
          role: aggregate.role,
          academicGroup: aggregate.academicGroup,
          avgTaskScore: evaluationCountSafe ? aggregate.totalTaskScore / divisor : 0,
          avgTeamScore: evaluationCountSafe ? aggregate.totalTeamScore / divisor : 0,
          avgAdditionalScore: evaluationCountSafe ? aggregate.totalAdditionalScore / divisor : 0,
          avgMcqScore: evaluationCountSafe ? aggregate.totalMcqScore / divisor : 0,
          avgTotalScore: evaluationCountSafe ? aggregate.totalScore / divisor : 0,
          totalScore: aggregate.totalScore,
          evaluationCount: evaluationCountSafe,
          latestComment: aggregate.latestComment,
        };
      })
      .sort((a, b) => {
        if (b.evaluationCount !== a.evaluationCount) {
          return b.evaluationCount - a.evaluationCount;
        }
        return a.name.localeCompare(b.name);
      });

    // --- Aggregate Evaluation Summaries ---
    const evaluationSummaries = relevantDetails
      .map((detail) => {
        const participantCount = detail.studentRecords.length || 0;
        const totals = detail.studentRecords.reduce(
          (acc, record) => {
            acc.task += record.taskScore || 0;
            acc.team += record.teamScore || 0;
            acc.additional += record.additionalScore || 0;
            acc.mcq += record.mcqScore || 0;
            acc.total += record.totalScore || 0;
            return acc;
          },
          { task: 0, team: 0, additional: 0, mcq: 0, total: 0 }
        );
        const divisor = participantCount || 1;

        return {
          evaluationId: detail.evaluationId,
          taskName: detail.taskName,
          dateLabel: detail.dateLabel,
          dateMs: detail.dateMs || null,
          assessedCount: detail.assessedCount,
          pendingCount: detail.pendingCount,
          averagePercentage: detail.averagePercentage,
          avgTaskScore: participantCount ? totals.task / divisor : 0,
          avgTeamScore: participantCount ? totals.team / divisor : 0,
          avgAdditionalScore: participantCount ? totals.additional / divisor : 0,
          avgMcqScore: participantCount ? totals.mcq / divisor : 0,
          avgTotalScore: participantCount ? totals.total / divisor : 0,
        };
      })
      .sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));

    // Store full details for the summary page
    groupDetailsMap.set(summary.groupId, {
      metric,
      group: groupMap.get(summary.groupId) || null,
      members: membersDetailed,
      evaluations: evaluationSummaries,
    });

    if (filters.showFullOnly && metric.fullCriteriaEvaluations.length === 0) {
      return;
    }

    groupMetrics.push(metric);

    if (filters.groupFilter !== 'all' && summary.groupId === filters.groupFilter) {
      selectedGroupDetail = metric;
    }
  });

  const summary = _buildDashboardSummary(groupMetrics, groupFilter, groupSummaries.size);
  const chartData = _buildChartData(groupMetrics, filters);

  const criteriaContext = _buildCriteriaContext(groupMetrics, studentMap, groupMap);
  currentCriteriaContext = criteriaContext; // Cache context for delegated listeners

  // Reset criteria selection if it's no longer valid in the new context
  if (criteriaContext && currentCriteriaSelection && !criteriaContext.criteriaBuckets.has(currentCriteriaSelection)) {
    currentCriteriaSelection = null;
  }

  return {
    groupMetrics,
    summary,
    chartData,
    criteriaContext,
    selectedGroupDetail,
    groupDetails: groupDetailsMap,
    options: {
      groups: groups.map((group) => ({ id: group.id, label: _formatText(group.name) })),
      tasks: Array.from(taskOptionsMap.values()),
    },
  };
}

/**
 * Builds the top-level summary object for the dashboard cards.
 * @param {Array} groupMetrics - Array of metrics for groups in view.
 * @param {string} groupFilter - The current group filter.
 * @param {number} totalGroupCount - Total number of groups in state.
 * @returns {object} Summary data.
 */
function _buildDashboardSummary(groupMetrics, groupFilter, totalGroupCount) {
  if (!groupMetrics.length) {
    return {
      groupsInView: 0,
      totalGroups: groupFilter === 'all' ? totalGroupCount : 1,
      totalEvaluations: 0,
      totalMcqEvaluations: 0,
      averageScore: 0,
      pendingStudents: 0,
      improvementStudents: 0,
      participationRate: 0,
      latestEvaluation: null,
      fullCriteriaGroups: 0,
    };
  }

  const totalEvaluations = groupMetrics.reduce((sum, metric) => sum + (metric.evaluationCount || 0), 0);
  const totalMcqEvaluations = groupMetrics.reduce((sum, metric) => sum + (metric.mcqEvaluationCount || 0), 0);
  const totalStudents = groupMetrics.reduce((sum, metric) => sum + (metric.studentCount || 0), 0);
  const totalParticipants = groupMetrics.reduce((sum, metric) => sum + (metric.uniqueParticipantsCount || 0), 0);
  const pendingStudents = Math.max(totalStudents - totalParticipants, 0);
  const improvementStudents = groupMetrics.reduce((sum, metric) => sum + (metric.improvementCount || 0), 0);
  const totalScoreWeight = groupMetrics.reduce((sum, metric) => sum + (metric.scoreWeight || 0), 0);
  const weightedScoreSum = groupMetrics.reduce(
    (sum, metric) => sum + (metric.averageScore || 0) * (metric.scoreWeight || 0),
    0
  );
  const averageScore = totalScoreWeight > 0 ? weightedScoreSum / totalScoreWeight : 0;
  const participationRate =
    totalStudents > 0 ? Math.min(100, (totalParticipants / totalStudents) * 100) : 0;
  const latestEvaluationMs = groupMetrics.reduce(
    (max, metric) => (metric.latestEvaluationMs && metric.latestEvaluationMs > max ? metric.latestEvaluationMs : max),
    -Infinity
  );
  const fullCriteriaGroups = groupMetrics.filter((metric) => metric.fullCriteriaEvaluations.length > 0).length;

  return {
    groupsInView: groupMetrics.length,
    totalGroups: groupFilter === 'all' ? totalGroupCount : 1,
    totalEvaluations,
    totalMcqEvaluations,
    averageScore,
    pendingStudents,
    improvementStudents,
    participationRate,
    latestEvaluation: latestEvaluationMs > 0 ? _formatDate(latestEvaluationMs) : null,
    fullCriteriaGroups,
  };
}

/**
 * Prepares data structured for Chart.js.
 * @param {Array} groupMetrics - Array of metrics for groups in view.
 * @param {object} filters - The current filter state.
 * @returns {object} Chart.js compatible data.
 */
function _buildChartData(groupMetrics, filters) {
  if (!groupMetrics.length) {
    return { bar: null, pie: null };
  }

  const theme = _getChartTheme();
  const labels = groupMetrics.map((metric) => metric.groupName);
  const learnedSeries = groupMetrics.map((metric) => metric.topicCounts.learnedWell);
  const understoodSeries = groupMetrics.map((metric) => metric.topicCounts.understood);
  const notYetSeries = groupMetrics.map((metric) => metric.topicCounts.notYet);
  const pendingSeries = groupMetrics.map((metric) => metric.pendingStudents);

  const bar = {
    labels,
    datasets: [
      {
        label: 'ভালো করে শিখেছি',
        data: learnedSeries,
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderRadius: 6,
      },
      {
        label: 'শুধু বুঝেছি',
        data: understoodSeries,
        backgroundColor: 'rgba(99, 102, 241, 0.85)',
        borderRadius: 6,
      },
      {
        label: 'এখনো এই টপিক পারিনা ',
        data: notYetSeries,
        backgroundColor: 'rgba(251, 191, 36, 0.9)',
        borderRadius: 6,
      },
      {
        label: 'বাকি শিক্ষার্থী',
        data: pendingSeries,
        type: 'line',
        borderColor: 'rgba(239, 68, 68, 0.95)',
        backgroundColor: 'rgba(239, 68, 68, 0.25)',
        tension: 0.35,
        borderWidth: 2,
        fill: true,
        yAxisID: 'y1',
      },
    ],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: theme.tick,
            callback: (value) => _formatNumber(value),
          },
          grid: {
            color: theme.grid,
          },
        },
        y1: {
          beginAtZero: true,
          position: 'right',
          grid: {
            drawOnChartArea: false,
            color: theme.grid,
          },
          ticks: {
            precision: 0,
            color: theme.tick,
            callback: (value) => _formatNumber(value),
          },
        },
        x: {
          ticks: { color: theme.tick },
          grid: { color: theme.grid },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            color: theme.legend,
          },
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipTitle,
          bodyColor: theme.tooltipBody,
        },
      },
    },
  };

  let pie = null;
  if (filters.groupFilter !== 'all' && groupMetrics.length === 1) {
    const metric = groupMetrics[0];
    const totalTopic = metric.topicCounts.learnedWell + metric.topicCounts.understood + metric.topicCounts.notYet;

    if (totalTopic > 0) {
      pie = {
        labels: ['ভালো করে শিখেছি', 'শুধু বুঝেছি', 'এখনো এই টপিক পারিনা '],
        data: [metric.topicCounts.learnedWell, metric.topicCounts.understood, metric.topicCounts.notYet],
        colors: ['#10b981', '#6366f1', '#f59e0b'],
        title: `${metric.groupName} - টপিক রেটিং`,
      };
    }
  }

  return { bar, pie };
}

/**
 * Builds the context object for "Additional Criteria" analysis.
 * @param {Array} groupMetrics - Array of metrics for groups in view.
 * @param {Map} studentMap - Map of all students.
 * @param {Map} groupMap - Map of all groups.
 * @returns {object | null} Criteria context or null.
 */
function _buildCriteriaContext(groupMetrics, studentMap, groupMap) {
  if (!Array.isArray(groupMetrics) || !groupMetrics.length) {
    return null;
  }

  const bucketsById = new Map();
  const bucketsByCategory = {
    topic: [],
    options: [],
    summary: [],
  };
  const allStudentIds = new Set();

  const ensureBucket = (criteriaId) => {
    const meta = CRITERIA_META_INDEX.get(criteriaId);
    if (!meta) return null;
    let bucket = bucketsById.get(criteriaId);
    if (!bucket) {
      bucket = {
        id: criteriaId,
        label: _formatText(meta.label),
        category: meta.category,
        categoryLabel: meta.categoryLabel,
        students: new Map(),
        count: 0,
        totalEntries: 0,
      };
      bucketsById.set(criteriaId, bucket);
      if (Array.isArray(bucketsByCategory[meta.category])) {
        bucketsByCategory[meta.category].push(bucket);
      }
    }
    return bucket;
  };

  const registerRecord = (criteriaId, studentInfo, record) => {
    const bucket = ensureBucket(criteriaId);
    if (!bucket) return;
    const existing = bucket.students.get(studentInfo.studentId) || {
      studentId: studentInfo.studentId,
      name: studentInfo.name,
      groupId: studentInfo.groupId,
      groupName: studentInfo.groupName,
      records: [],
    };
    existing.records.push(record);
    bucket.students.set(studentInfo.studentId, existing);
  };

  groupMetrics.forEach((metric) => {
    const groupName = _formatText(metric.groupName);
    (metric.evaluationDetails || []).forEach((detail) => {
      if (!Array.isArray(detail.studentRecords)) return;
      detail.studentRecords.forEach((record) => {
        const studentId = record.studentId;
        if (!studentId) return;
        allStudentIds.add(studentId);
        const student = studentMap.get(studentId) || {};
        const derivedGroupId = student.groupId || metric.groupId;
        const derivedGroup = groupMap.get(derivedGroupId);
        const studentInfo = {
          studentId,
          name: _formatText(student.name || record.displayName || studentId),
          groupId: derivedGroupId,
          groupName: _formatText(derivedGroup?.name || groupName),
        };
        const baseRecord = {
          evaluationId: record.evaluationId,
          taskId: record.taskId,
          taskName: _formatText(record.taskName),
          dateMs: record.dateMs,
          dateLabel: record.dateLabel || '',
          topicId: record.topicId,
          topicKey: record.topicKey,
          attendance: Boolean(record.attendance),
          homework: Boolean(record.homework),
          percentage: record.percentage,
          totalScore: record.totalScore,
          maxScore: record.maxScore,
          groupId: metric.groupId,
          groupName,
          studentId: record.studentId, // Add studentId for debugging
          taskScore: record.taskScore,
          problemRecovered: record.problemRecovered,
        };

        if (record.topicId) {
          registerRecord(record.topicId, studentInfo, baseRecord);
        }

        if (record.attendance) {
          registerRecord(CRITERIA_MAPPING.options.attendance_regular.id, studentInfo, baseRecord);
        }
        if (record.homework) {
          registerRecord(CRITERIA_MAPPING.options.homework_done.id, studentInfo, baseRecord);
        }

        const fullPositive = record.topicKey === 'learnedWell' && record.attendance && record.homework;
        const needsImprovement = record.topicKey === 'notYet' || !record.attendance || !record.homework;

        if (fullPositive) {
          registerRecord(CUSTOM_CRITERIA.FULL_POSITIVE.id, studentInfo, baseRecord);
        }
        if (needsImprovement) {
          registerRecord(CUSTOM_CRITERIA.IMPROVEMENT_NEEDED.id, studentInfo, baseRecord);
        }
      });
    });
  });

  bucketsById.forEach((bucket) => {
    bucket.count = bucket.students.size;
    bucket.totalEntries = Array.from(bucket.students.values()).reduce(
      (sum, student) => sum + student.records.length,
      0
    );
  });

  const sortBuckets = (collection) =>
    collection
      .filter((bucket) => bucket.count > 0)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      });

  bucketsByCategory.topic = sortBuckets(bucketsByCategory.topic);
  bucketsByCategory.options = sortBuckets(bucketsByCategory.options);
  bucketsByCategory.summary = sortBuckets(bucketsByCategory.summary);

  if (!bucketsByCategory.topic.length && !bucketsByCategory.options.length && !bucketsByCategory.summary.length) {
    return null;
  }

  return {
    criteriaBuckets: bucketsById,
    bucketsByCategory,
    totalUniqueStudents: allStudentIds.size,
  };
}

// ===================================================================
//
// CRITERIA SECTION (Graph Page)
//
// ===================================================================

/**
 * Gets the list of criteria buckets for the current filter view.
 */
function _getCriteriaBucketsForView(criteriaContext, viewValue) {
  if (!criteriaContext) return [];
  const category = viewValue === 'topic' ? 'topic' : viewValue === 'options' ? 'options' : 'summary';
  return Array.isArray(criteriaContext.bucketsByCategory?.[category])
    ? criteriaContext.bucketsByCategory[category]
    : [];
}

/**
 * Gets the currently active criteria bucket, defaulting to the first.
 */
function _getActiveCriteriaBucket(visibleBuckets) {
  if (!visibleBuckets || !visibleBuckets.length) {
    currentCriteriaSelection = null;
    return null;
  }
  if (currentCriteriaSelection) {
    const existing = visibleBuckets.find((bucket) => bucket.id === currentCriteriaSelection);
    if (existing) return existing;
  }
  // Default to the first bucket if current selection is invalid
  currentCriteriaSelection = visibleBuckets[0].id;
  return visibleBuckets[0];
}

function _prettyCriteriaCategory(category) {
  if (category === 'topic') return 'বিষয়ভিত্তিক মানদণ্ড';
  if (category === 'options') return 'সহায়ক মানদণ্ড';
  if (category === 'summary') return 'সারসংক্ষেপ';
  return 'মানদণ্ড';
}

function _prettyCriteriaLabel(id, fallback) {
  const meta = CRITERIA_META_INDEX.get(id);
  const raw = meta ? meta.label : fallback || '';
  return _formatText(raw);
}

/**
 * Renders the overview cards for the criteria section.
 */
function _renderCriteriaOverview(criteriaContext, filters, visibleBuckets) {
  if (!criteriaContext) {
    return '';
  }

  if (!visibleBuckets || !visibleBuckets.length) {
    currentCriteriaSelection = null;
    return `
      <div class="card card-body bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
        <div class="placeholder-content text-gray-800 dark:text-gray-200">
          <i class="fas fa-user-check mr-2"></i>
          বর্তমান ফিল্টারের জন্য কোনো মানদণ্ডের ডেটা পাওয়া যায়নি।
        </div>
      </div>
    `;
  }

  const activeBucket = _getActiveCriteriaBucket(visibleBuckets); // Ensures selection is valid
  const totalStudents = criteriaContext.totalUniqueStudents || 0;
  const baseClass =
    'criteria-card block w-full rounded-2xl border transition-colors p-4 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900';
  const activeClass = 'border-blue-600 bg-blue-600 text-white shadow-lg';
  const inactiveClass =
    'border-gray-200 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 hover:border-blue-400 hover:bg-blue-50/60 dark:hover:bg-gray-800 dark:border-gray-700';

  const cards = visibleBuckets
    .map((bucket) => {
      const isActive = activeBucket && bucket.id === activeBucket.id;
      const share = totalStudents > 0 ? (bucket.count / totalStudents) * 100 : 0;
      const minorTextClass = isActive ? 'text-white/90' : 'text-gray-700 dark:text-gray-300';

      // Note: active state (className) will be set by _updateCriteriaCardStates() post-render
      return `
        <button
          type="button"
          class="${baseClass} ${isActive ? activeClass : inactiveClass}"
          data-criteria-id="${bucket.id}"
          data-base-class="${baseClass}"
          data-active-class="${activeClass}"
          data-inactive-class="${inactiveClass}"
        >
          <span class="text-xs font-semibold uppercase tracking-wide ${minorTextClass}">${_prettyCriteriaCategory(
        bucket.category
      )}</span>
          <div class="mt-2 flex items-baseline justify-between gap-2">
            <span class="text-lg font-semibold">${_prettyCriteriaLabel(bucket.id, bucket.label)}</span>
            <span class="text-3xl font-bold">${_formatNumber(bucket.count)}</span>
          </div>
          <div class="mt-1 flex items-center justify-between text-sm ${minorTextClass}">
            <span>${_formatNumber(bucket.totalEntries)} মূল্যায়ন</span>
            <span>${_formatPercent(share || 0)}</span>
          </div>
        </button>
      `;
    })
    .join('');

  const viewLabel =
    filters.criteriaView === 'topic'
      ? 'বিষয়ভিত্তিক মানদণ্ড'
      : filters.criteriaView === 'options'
      ? 'সহায়ক মানদণ্ড'
      : 'মূল্যায়ন';

  return `
    <div class="card bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
      <div class="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-50">অতিরিক্ত মানদণ্ড বিশ্লেষণ</h3>
        <span class="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">${viewLabel}</span>
      </div>
      <div class="card-body">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-${Math.min(
          visibleBuckets.length || 1,
          4
        )}" data-criteria-grid>
          ${cards}
        </div>
      </div>
    </div>
  `;
}

/**
 * Updates the visual state (CSS classes) of criteria cards.
 */
function _updateCriteriaCardStates() {
  if (!elements.graphDashboardContainer) return;
  const allCards = elements.graphDashboardContainer.querySelectorAll('[data-criteria-id]');
  allCards.forEach((button) => {
    const base = button.dataset.baseClass || '';
    const activeClass = button.dataset.activeClass || '';
    const inactiveClass = button.dataset.inactiveClass || '';
    const isActive = button.dataset.criteriaId === currentCriteriaSelection;
    button.className = `${base} ${isActive ? activeClass : inactiveClass}`.trim();
  });
}

/**
 * Renders the placeholder for the criteria detail section.
 */
function _renderCriteriaDetailPlaceholder(criteriaContext, visibleBuckets) {
  // This function just renders the container.
  // _renderCriteriaDetailSection() will fill it.
  return `<div class="space-y-4" data-criteria-detail></div>`;
}

/**
 * Renders the content for the criteria detail section based on the active bucket.
 * This is called by the event listener.
 */
function _renderCriteriaDetailSection() {
  if (!elements.graphDetailContainer) return;

  const detailContainer = elements.graphDetailContainer.querySelector('[data-criteria-detail]');
  if (!detailContainer) return;

  const filters = stateManager.getFilterSection(ANALYSIS_FILTER_KEY);
  const visibleBuckets = _getCriteriaBucketsForView(currentCriteriaContext, filters.criteriaView);
  const activeBucket = _getActiveCriteriaBucket(visibleBuckets);

  detailContainer.innerHTML = activeBucket ? _renderCriteriaDetail(activeBucket) : _renderEmptyCriteriaDetail();
}

function _renderEmptyCriteriaDetail() {
  return `
    <div class="card card-body bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
      <div class="placeholder-content text-gray-800 dark:text-gray-200">
        <i class="fas fa-users mr-2"></i>
        নির্বাচিত মানদণ্ডের সাথে মেলে এমন কোনো শিক্ষার্থী পাওয়া যায়নি।
      </div>
    </div>
  `;
}

/**
 * Renders the detail view for a single, active criteria bucket.
 */
function _renderCriteriaDetail(bucket) {
  if (!bucket || !bucket.students.size) {
    return _renderEmptyCriteriaDetail();
  }

  const studentCards = Array.from(bucket.students.values())
    .sort((a, b) => {
      if (b.records.length !== a.records.length) {
        return b.records.length - a.records.length;
      }
      return a.name.localeCompare(b.name);
    })
    .map((student) => {
      const history = [...student.records].sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));
      const historyMarkup = history.map((record) => _renderCriteriaHistoryRow(record)).join('');

      return `
        <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h5 class="text-lg font-semibold text-gray-900 dark:text-gray-50">${student.name}</h5>
              <p class="text-sm text-gray-700 dark:text-gray-300">${student.groupName || 'গ্রুপ তথ্য অনুপস্থিত'}</p>
            </div>
            <div class="text-sm text-gray-700 dark:text-gray-300">
              <span class="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 px-3 py-1 text-blue-800 dark:text-blue-100 font-medium">
                ${_formatNumber(history.length)} মূল্যায়ন
              </span>
            </div>
          </div>
          <div class="space-y-2">
            ${historyMarkup}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="space-y-4">
      <div class="card bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
        <div class="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-50">${_prettyCriteriaLabel(
            bucket.id,
            bucket.label
          )}</h4>
          <span class="text-sm text-gray-700 dark:text-gray-300">মোট শিক্ষার্থী: ${_formatNumber(bucket.count)}</span>
        </div>
        <div class="card-body space-y-4">
          ${studentCards}
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders a single history row for the criteria detail student card.
 */
function _renderCriteriaHistoryRow(record) {
  const topicLabel = _getCriteriaLabel(record.topicId) || 'মানদণ্ড অনুপস্থিত';
  const attendanceLabel = record.attendance ? 'উপস্থিত' : 'অনুপস্থিত';
  const attendanceClass = record.attendance
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-700/50 dark:text-emerald-50'
    : 'bg-rose-100 text-rose-800 dark:bg-rose-700/50 dark:text-rose-50';
  const homeworkLabel = record.homework ? 'হোমওয়ার্ক সম্পন্ন' : 'হোমওয়ার্ক বাকি';
  const homeworkClass = record.homework
    ? 'bg-violet-100 text-violet-800 dark:bg-violet-700/50 dark:text-violet-50'
    : 'bg-amber-100 text-amber-800 dark:bg-amber-700/50 dark:text-amber-50';

  return `
    <div class="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">${record.taskName}</p>
          <p class="text-xs text-gray-700 dark:text-gray-300">${record.dateLabel || 'তারিখ অনুপস্থিত'} · ${
    record.groupName
  }</p>
        </div>
        <div class="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          ${_formatPercent(record.percentage)}
        </div>
      </div>
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="inline-flex items-center rounded-full bg-sky-100 text-sky-800 dark:bg-sky-700/50 dark:text-sky-50 px-3 py-1 font-medium">${topicLabel}</span>
        <span class="inline-flex items-center rounded-full px-3 py-1 font-medium ${attendanceClass}">${attendanceLabel}</span>
        <span class="inline-flex items-center rounded-full px-3 py-1 font-medium ${homeworkClass}">${homeworkLabel}</span>
        ${(() => {
          // Use topicKey for logic as taskScore might be 0
          const topicKey = record.topicKey;
          const isProblematic = (topicKey === 'understood' || topicKey === 'notYet');
          
          // DEBUG LOG
          console.log(`Student: ${record.studentId}, TopicKey: ${topicKey}, ProblemRecovered: ${record.problemRecovered}, IsProblematic: ${isProblematic}`);

          if (isProblematic) {
             const html = record.problemRecovered
                ? '<span class="inline-flex items-center rounded-full px-3 py-1 font-medium bg-green-100 text-green-800 dark:bg-green-700/50 dark:text-green-50">Problem Resolved</span>'
                : '<span class="inline-flex items-center rounded-full px-3 py-1 font-medium bg-red-100 text-red-800 dark:bg-red-700/50 dark:text-red-50">Have a problem</span>';
             console.log('Generating Tag HTML:', html);
             return html;
          }
          
          if (topicKey === 'learnedWell' && record.problemRecovered) {
             const html = '<span class="inline-flex items-center rounded-full px-3 py-1 font-medium bg-green-100 text-green-800 dark:bg-green-700/50 dark:text-green-50">Problem Resolved</span>';
             console.log('Generating Tag HTML (Resolved 10):', html);
             return html;
          }
          
          return '';
        })()}
      </div>
    </div>
  `;
}

function _getCriteriaLabel(criteriaId) {
  const meta = CRITERIA_META_INDEX.get(criteriaId);
  return meta ? _formatText(meta.label) : '';
}

// ===================================================================
//
// SHARED UI COMPONENTS (Cards, Tables, Charts)
//
// ===================================================================

/**
 * Renders the top summary cards (total evaluations, avg score, etc.).
 */
function _renderSummaryCards(summary) {
  return `
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      ${_createSummaryCard(
        'মোট মূল্যায়ন',
        summary.totalEvaluations,
        'bg-blue-50 text-blue-800 dark:bg-gray-800/80 dark:text-white',
        'fa-clipboard-list'
      )}
      ${_createSummaryCard(
        'MCQ মূল্যায়ন',
        summary.totalMcqEvaluations,
        'bg-purple-50 text-purple-800 dark:bg-gray-800/80 dark:text-white',
        'fa-brain'
      )}
      ${_createSummaryCard(
        'গড় স্কোর (%)',
        _formatPercent(summary.averageScore),
        'bg-emerald-50 text-emerald-800 dark:bg-gray-800/80 dark:text-white',
        'fa-gauge'
      )}
      ${_createSummaryCard(
        'বাকি শিক্ষার্থী',
        summary.pendingStudents,
        'bg-rose-50 text-rose-800 dark:bg-gray-800/80 dark:text-white',
        'fa-user-clock'
      )}
    </div>
  `;
}

/**
 * Helper to create a single summary card's HTML.
 */
function _createSummaryCard(title, value, classes, icon) {
  const displayValue = typeof value === 'string' ? value : _formatNumber(value);
  return `
    <div class="rounded-2xl border ${
      classes.includes('dark:') ? 'border-transparent' : 'border-gray-100'
    } ${classes} p-4 shadow-sm backdrop-blur">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-medium opacity-90">${title}</div>
          <div class="mt-2 text-2xl font-semibold">${displayValue}</div>
        </div>
        <div class="text-3xl opacity-70"><i class="fas ${icon}"></i></div>
      </div>
    </div>
  `;
}

/**
 * Renders the main table of all groups.
 */
function _renderGroupTable(groupMetrics, filters) {
  if (!groupMetrics.length) {
    return `
      <div class="card card-body bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
        <div class="placeholder-content text-gray-800 dark:text-gray-200">
          <i class="fas fa-info-circle mr-2"></i>
          নির্বাচিত ফিল্টারের জন্য কোনও তথ্য পাওয়া যায়নি।
        </div>
      </div>
    `;
  }

  const headers = [
    'গ্রুপ',
    'মোট শিক্ষার্থী',
    'মূল্যায়ন (মোট/MCQ)',
    'অংশগ্রহণকারী',
    'গড় স্কোর (%)',
    'অংশগ্রহণ হার (%)',
    'বাকি শিক্ষার্থী',
    'ইতিবাচক শিক্ষার্থী',
    'উন্নয়ন প্রয়োজন',
    'ফুল ক্রাইটেরিয়া সেশন',
  ];

  const rows = groupMetrics
    .map((metric) => {
      return `
        <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition">
          <td class="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">${metric.groupName}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${_formatNumber(metric.studentCount)}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${_formatNumber(
            metric.evaluationCount
          )} / ${_formatNumber(metric.mcqEvaluationCount)}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${_formatNumber(
            metric.uniqueParticipantsCount
          )}</td>
          <td class="px-4 py-3 text-center ${_scoreColorClass(metric.averageScore)} font-semibold">${_formatPercent(
        metric.averageScore
      )}</td>
          <td class="px-4 py-3 text-center text-indigo-700 dark:text-indigo-300 font-semibold">${_formatPercent(
            metric.participationRate
          )}</td>
          <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100">${_formatNumber(
            metric.pendingStudents
          )}</td>
          <td class="px-4 py-3 text-center text-emerald-700 dark:text-emerald-300 font-semibold">${_formatNumber(
            metric.fullCriteriaStudents
          )}</td>
          <td class="px-4 py-3 text-center ${
            metric.improvementCount > 0
              ? 'text-rose-600 dark:text-rose-300 font-semibold'
              : 'text-gray-800 dark:text-gray-200'
          }">${_formatNumber(metric.improvementCount)}</td>
          <td class="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">${metric.fullCriteriaEvaluations
            .map((name, index) => {
              const rawName =
                typeof name === 'string' && name.trim().length
                  ? name.trim()
                  : typeof name === 'number'
                  ? String(name)
                  : '';
              const formatted = _formatText(rawName);
              const cleanName = formatted && formatted.length ? formatted : rawName;
              const badgeLabel =
                cleanName && cleanName.length
                  ? cleanName.length > 32
                    ? `${cleanName.slice(0, 30)}…`
                    : cleanName
                  : `এসাইনমেন্ট ${_formatNumber(index + 1)}`;
              const tooltip = _escapeAttribute(cleanName || badgeLabel);
              return `<span class="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-100 rounded-full mr-1 mb-1 whitespace-nowrap" title="${tooltip}">${badgeLabel}</span>`;
            })
            .join('') || '<span class="text-gray-500 dark:text-gray-400">—</span>'}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="card overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
      <div class="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-50">গ্রুপ ভিত্তিক বিশ্লেষণ</h3>
        <p class="text-sm text-gray-800 dark:text-gray-200">
          ভিউ মোড: ${filters.viewMode === VIEW_MODES.TABLE ? 'টেবিল' : 'চার্ট'} · মোট গ্রুপ: ${_formatNumber(
    groupMetrics.length
  )}
        </p>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              ${headers
                .map(
                  (header) =>
                    `<th scope="col" class="px-4 py-3 text-left font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">${header}</th>`
                )
                .join('')}
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Renders the HTML markup for the chart containers.
 */
function _renderChartsMarkup(chartData) {
  if (!chartData.bar) {
    return `
      <div class="card card-body bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
        <div class="placeholder-content text-gray-800 dark:text-gray-200">
          <i class="fas fa-chart-column mr-2"></i>
          চার্ট প্রদর্শনের জন্য কোনো তথ্য নেই।
        </div>
      </div>
    `;
  }

  const pieSection = chartData.pie
    ? `
        <div class="card bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
          <div class="card-header flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-50">${chartData.pie.title}</h3>
          </div>
          <div class="card-body">
            <div class="h-80">
              <canvas id="analysisPieChart"></canvas>
            </div>
          </div>
        </div>
      `
    : '';

  const gridClass = chartData.pie ? 'lg:grid-cols-3' : 'lg:grid-cols-1';

  return `
    <div class="grid gap-6 ${gridClass}">
      <div class="card lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
        <div class="card-header flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-50">গ্রুপভিত্তিক মানদণ্ড বিশ্লেষণ</h3>
        </div>
        <div class="card-body">
          <div class="h-[420px]">
            <canvas id="analysisBarChart"></canvas>
          </div>
        </div>
      </div>
      ${pieSection}
    </div>
  `;
}

/**
 * Initializes or updates the Chart.js instances.
 */
function _initializeCharts(chartData) {
  if (!chartData.bar) {
    _destroyCharts();
    return;
  }

  const theme = _getChartTheme();

  const barCanvas = document.getElementById('analysisBarChart');
  if (barCanvas) {
    if (topicBarChart) topicBarChart.destroy();
    topicBarChart = new Chart(barCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: chartData.bar.labels,
        datasets: chartData.bar.datasets,
      },
      options: {
        ...chartData.bar.options,
        scales: {
          ...(chartData.bar.options?.scales || {}),
          x: {
            ...(chartData.bar.options?.scales?.x || {}),
            ticks: { ...(chartData.bar.options?.scales?.x?.ticks || {}), color: theme.tick },
            grid: { ...(chartData.bar.options?.scales?.x?.grid || {}), color: theme.grid },
          },
          y: {
            ...(chartData.bar.options?.scales?.y || {}),
            ticks: { ...(chartData.bar.options?.scales?.y?.ticks || {}), color: theme.tick },
            grid: { ...(chartData.bar.options?.scales?.y?.grid || {}), color: theme.grid },
          },
          y1: {
            ...(chartData.bar.options?.scales?.y1 || {}),
            ticks: { ...(chartData.bar.options?.scales?.y1?.ticks || {}), color: theme.tick },
            grid: { ...(chartData.bar.options?.scales?.y1?.grid || {}), color: theme.grid, drawOnChartArea: false },
          },
        },
        plugins: {
          ...(chartData.bar.options?.plugins || {}),
          legend: {
            ...(chartData.bar.options?.plugins?.legend || {}),
            labels: {
              ...(chartData.bar.options?.plugins?.legend?.labels || {}),
              color: theme.legend,
              usePointStyle: true,
            },
          },
          tooltip: {
            ...(chartData.bar.options?.plugins?.tooltip || {}),
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipTitle,
            bodyColor: theme.tooltipBody,
          },
        },
      },
    });
  }

  const pieCanvas = document.getElementById('analysisPieChart');
  if (pieCanvas && chartData.pie) {
    if (criteriaPieChart) criteriaPieChart.destroy();
    criteriaPieChart = new Chart(pieCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: chartData.pie.labels,
        datasets: [
          {
            data: chartData.pie.data,
            backgroundColor: chartData.pie.colors,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.legend,
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipTitle,
            bodyColor: theme.tooltipBody,
          },
        },
      },
    });
  } else if (criteriaPieChart) {
    criteriaPieChart.destroy();
    criteriaPieChart = null;
  }
}

/**
 * Destroys chart instances to prevent memory leaks.
 */
function _destroyCharts() {
  if (topicBarChart) {
    topicBarChart.destroy();
    topicBarChart = null;
  }
  if (criteriaPieChart) {
    criteriaPieChart.destroy();
    criteriaPieChart = null;
  }
}

/**
 * Renders the evaluation-by-evaluation detail for a selected group.
 */
function _renderGroupDetail(metric) {
  const detailCards = metric.evaluationDetails
    .map((detail) => {
      const topicTotal = detail.topicCounts.learnedWell + detail.topicCounts.understood + detail.topicCounts.notYet;
      const topicChips = `
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-700/50 dark:text-emerald-50">
            ভালো করে শিখেছি: ${_formatNumber(detail.topicCounts.learnedWell)}
          </span>
          <span class="px-3 py-1 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-700/50 dark:text-violet-50">
            শুধু বুঝেছি: ${_formatNumber(detail.topicCounts.understood)}
          </span>
          <span class="px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-700/50 dark:text-amber-50">
            এখনো এই টপিক পারিনা : ${_formatNumber(detail.topicCounts.notYet)}
          </span>
        </div>
      `;
      const optionChips = `
        <div class="flex flex-wrap gap-2 text-xs mt-2">
          <span class="px-3 py-1 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-700/50 dark:text-sky-50">
            নিয়মিত উপস্থিতি: ${_formatNumber(detail.optionCounts.attendance)}
          </span>
          <span class="px-3 py-1 rounded-full bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-700/50 dark:text-fuchsia-50">
            বাড়ির কাজ সম্পন্ন: ${_formatNumber(detail.optionCounts.homework)}
          </span>
        </div>
      `;
      return `
        <div class="border border-gray-100 dark:border-gray-700 rounded-xl p-4 space-y-3 bg-white dark:bg-gray-900">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div class="text-base font-semibold text-gray-900 dark:text-gray-50">${_formatText(detail.taskName)}</div>
              <div class="text-xs text-gray-700 dark:text-gray-300 mt-1 flex flex-wrap gap-3">
                <span><i class="fas fa-calendar-day mr-1"></i>${detail.dateLabel || '—'}</span>
                <span><i class="fas fa-list-check mr-1"></i>${detail.type === 'mcq' ? 'MCQ' : 'লিখিত/অন্যান্য'}</span>
              </div>
            </div>
            <div class="flex flex-wrap gap-4 text-sm text-gray-900 dark:text-gray-100">
              <span class="font-semibold text-indigo-700 dark:text-indigo-300">গড় স্কোর: ${_formatPercent(
                detail.averagePercentage
              )}</span>
              <span>মূল্যায়িত: ${_formatNumber(detail.assessedCount)}</span>
              <span class="${
                detail.pendingCount > 0 ? 'text-rose-700 dark:text-rose-300 font-semibold' : ''
              }">বাকি: ${_formatNumber(detail.pendingCount)}</span>
              <span class="text-emerald-700 dark:text-emerald-300 font-semibold">পজিটিভ: ${_formatNumber(
                detail.fullPositiveCount
              )}</span>
            </div>
          </div>
          ${topicTotal > 0 ? topicChips : ''}
          ${optionChips}
        </div>
      `;
    })
    .join('');

  return `
    <div class="card card-body space-y-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-50">${metric.groupName} - মূল্যায়ন বিশ্লেষণ</h4>
        <span class="text-sm text-gray-800 dark:text-gray-200">
          মোট ${_formatNumber(metric.evaluationCount)}টি মূল্যায়ন বিশ্লেষিত
        </span>
      </div>
      <div class="space-y-3">
        ${detailCards}
      </div>
    </div>
  `;
}

// ===================================================================
//
// FORMATTING & UTILITY HELPERS
//
// ===================================================================

function _formatNumber(value) {
  const numeric = Number.isFinite(value) ? value : 0;
  if (helpers?.convertToBanglaNumber) {
    return helpers.convertToBanglaNumber(Math.round(numeric));
  }
  return Math.round(numeric).toString();
}

function _formatPercent(value) {
  const numeric = Number.isFinite(value) ? value : 0;
  const formatted = numeric.toFixed(1);
  if (helpers?.convertToBanglaNumber) {
    return `${helpers.convertToBanglaNumber(formatted)}%`;
  }
  return `${formatted}%`;
}

function _formatDecimal(value, fractionDigits = 2) {
  const numeric = Number.isFinite(value) ? value : 0;
  const formatted = numeric.toFixed(fractionDigits);
  if (helpers?.convertToBanglaNumber) {
    return helpers.convertToBanglaNumber(formatted);
  }
  return formatted;
}

function _formatDate(value) {
  if (!value) return '';
  if (helpers?.formatTimestamp) {
    return helpers.formatTimestamp(value instanceof Date ? value : new Date(value));
  }
  const dateObj = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}

function _extractTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try {
        return value.toDate().getTime();
      } catch (error) {
        return null;
      }
    }
    if (typeof value.seconds === 'number') {
      return value.seconds * 1000;
    }
  }
  return null;
}

function _formatText(value) {
  if (!value) return '';
  if (helpers?.ensureBengaliText && typeof helpers.ensureBengaliText === 'function') {
    return helpers.ensureBengaliText(value);
  }
  if (typeof value === 'string') return value.trim();
  return String(value);
}

function _resolveTaskName(task, evaluation, fallbackIndex = 1) {
  const primary = _formatText(task?.name || evaluation?.taskName || '');
  if (primary) return primary;
  const secondary = _formatText(task?.code || evaluation?.taskCode || '');
  if (secondary) return secondary;
  const suffix = Number.isFinite(fallbackIndex) ? _formatNumber(fallbackIndex) : '';
  return suffix ? `এসাইনমেন্ট ${suffix}` : 'এসাইনমেন্ট';
}

function _escapeAttribute(value) {
  const text = _formatText(value);
  const normalized = typeof text === 'string' ? text.replace(/\r?\n/g, ' ') : '';
  return normalized
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function _scoreColorClass(value) {
  if (value >= 80) return 'text-emerald-700 dark:text-emerald-300';
  if (value >= 60) return 'text-blue-700 dark:text-blue-300';
  if (value >= 40) return 'text-amber-700 dark:text-amber-300';
  return 'text-rose-700 dark:text-rose-300';
}

function _deriveMaxScoreFromTask(task) {
  if (!task) return null;
  if (typeof task.maxScore === 'number') return task.maxScore;
  if (task.maxScoreBreakdown) {
    const breakdown = task.maxScoreBreakdown;
    return (
      (parseFloat(breakdown.task) || 0) +
      (parseFloat(breakdown.team) || 0) +
      (parseFloat(breakdown.additional) || 0) +
      (parseFloat(breakdown.mcq) || 0)
    );
  }
  return null;
}

function _isMcqEvaluation(task) {
  if (!task || !task.maxScoreBreakdown) return false;
  return parseFloat(task.maxScoreBreakdown.mcq) > 0;
}

// ===================================================================
//
// PDF & PRINT ACTIONS
//
// ===================================================================

async function generateGroupAnalysisPDF() {
  uiManager.showLoading('PDF তৈরি হচ্ছে...');
  try {
    const filters = stateManager.getFilterSection(ANALYSIS_FILTER_KEY);
    const data = _buildAnalysisData(filters); // Re-build data to ensure it's fresh
    
    if (!data || !data.groupMetrics || data.groupMetrics.length === 0) {
      uiManager.showToast('এক্সপোর্ট করার মতো ডেটা নেই।', 'warning');
      return;
    }

    await helpers.pdfGenerator.generateGroupAnalysisPDF(data.groupMetrics, uiManager);
  } catch (error) {
    console.error('Error generating group analysis PDF:', error);
    uiManager.showToast('PDF তৈরি করতে সমস্যা হয়েছে।', 'error');
  } finally {
    uiManager.hideLoading();
  }
}

async function generateSelectedGroupPDF() {
  const filters = stateManager.getFilterSection(ANALYSIS_FILTER_KEY);
  if (!filters || filters.groupFilter === 'all') {
    uiManager.showToast('অনুগ্রহ করে প্রথমে একটি গ্রুপ নির্বাচন করুন।', 'info');
    return;
  }

  uiManager.showLoading('PDF তৈরি হচ্ছে...');
  try {
    const data = _buildAnalysisData(filters);
    const groupDetails = data.groupDetails || new Map();
    const selectedGroupData = groupDetails.get(filters.groupFilter);

    if (!selectedGroupData) {
      uiManager.showToast('নির্বাচিত গ্রুপের ডেটা পাওয়া যায়নি।', 'warning');
      return;
    }

    await helpers.pdfGenerator.generateSingleGroupAnalysisPDF(selectedGroupData, uiManager);
  } catch (error) {
    console.error('Error generating selected group PDF:', error);
    uiManager.showToast('PDF তৈরি করতে সমস্যা হয়েছে।', 'error');
  } finally {
    uiManager.hideLoading();
  }
}

function printGroupAnalysis() {
  window.print();
}

// Removed _createPdfFromElement and _ensurePdfFont as they are no longer needed.




/**
 * Generates the "Group Wise Full Details Result" PDF.
 * Retrieves data from stateManager and calls the utility function.
 */
async function generateGroupWiseFullDetailsPDF(filterTaskId = 'all', filterGroupId = null) {
  uiManager.showLoading('PDF তৈরি হচ্ছে...');
  try {
    const groups = stateManager.get('groups') || [];
    const students = stateManager.get('students') || [];
    const tasks = stateManager.get('tasks') || [];
    const evaluations = stateManager.get('evaluations') || [];

    if (groups.length === 0) {
      uiManager.showToast('কোনো গ্রুপ পাওয়া যায়নি।', 'warning');
      return;
    }

    await helpers.pdfGenerator.generateGroupWiseFullDetailsPDF(
      groups,
      students,
      tasks,
      evaluations,
      uiManager,
      filterTaskId,
      filterGroupId
    );
  } catch (error) {
    console.error('Error generating group wise full details PDF:', error);
    uiManager.showToast('PDF তৈরি করতে সমস্যা হয়েছে।', 'error');
  } finally {
    uiManager.hideLoading();
  }
}

