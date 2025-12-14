// js/components/statistics.js

const VIEW_MODES = {
  TABLE: 'table',
  CHART: 'chart',
};

const DEFAULT_STAT_FILTERS = {
  taskFilter: 'all',
  groupFilter: 'all',
  evaluationType: 'all', // all | mcq | regular
  viewMode: VIEW_MODES.TABLE,
  showPendingOnly: false,
};

const MAX_PERCENT = 100;

let stateManager;
let uiManager;
let helpers;
let app;

const elements = {};
let groupStatsChart = null;

// --- NEW: observers & theme state ---
let visibilityObserver = null;
let resizeObserver = null;
let darkMql = null;

/**
 * Initializes the Statistics component.
 */
export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  helpers = dependencies.utils;
  app = dependencies.app;

  _cacheDOMElements();

  // --- observers for theme & resize ---
  try {
    // react to OS theme changes
    if (window.matchMedia) {
      darkMql = window.matchMedia('(prefers-color-scheme: dark)');
      darkMql.addEventListener?.('change', () => render());
    }
    // react to container resize for crisp Chart.js sizing
    if (elements.statsContentContainer && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        if (groupStatsChart) groupStatsChart.resize();
      });
      resizeObserver.observe(elements.statsContentContainer);
    }
  } catch (_) {
    /* no-op */
  }

  console.log('✅ Statistics component initialized.');

  return {
    render,
  };
}

/**
 * Main render entry.
 * (Delays heavy render until section is actually visible.)
 */
export function render() {
  if (!elements.page) {
    console.error('❌ Statistics render failed: Page element #page-statistics not found.');
    return;
  }

  const filters = _ensureFilterDefaults();

  _whenVisible(elements.page, () => {
    try {
      const statsData = _calculateStatistics(filters);
      _renderFilters(filters, statsData);
      _renderStatistics(statsData, filters);
    } catch (error) {
      console.error('❌ Error rendering statistics page:', error);
      if (elements.statsContentContainer) {
        uiManager.displayEmptyMessage(
          elements.statsContentContainer,
          `পরিসংখ্যান লোড করতে সমস্যা হয়েছে: ${error.message}`
        );
      }
    }
  });
}

/**
 * Cache DOM elements.
 */
function _cacheDOMElements() {
  elements.page = document.getElementById('page-statistics');
  if (!elements.page) {
    console.error('❌ Statistics init failed: #page-statistics element not found!');
    return;
  }

  elements.filterContainer = elements.page.querySelector('#statsFilterContainer');
  elements.statsContentContainer = elements.page.querySelector('#statsContentContainer');

  if (!elements.filterContainer) {
    console.warn('Statistics: #statsFilterContainer not found.');
  }
  if (!elements.statsContentContainer) {
    console.warn('Statistics: #statsContentContainer not found.');
  }
}

/**
 * Ensure filter defaults exist inside the state manager.
 */
function _ensureFilterDefaults() {
  const current = { ...DEFAULT_STAT_FILTERS, ...(stateManager.getFilterSection('statistics') || {}) };
  stateManager.updateFilters('statistics', current);
  return current;
}

/**
 * Render summary cards + filter controls.
 */
function _renderFilters(filters, statsData) {
  if (!elements.filterContainer) return;

  const { summary, groupOptions } = statsData;

  const cardsHtml = `
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      ${_createSummaryCard(
        'মোট মূল্যায়ন',
        summary.totalEvaluations,
        'bg-blue-50 text-blue-700 dark:bg-gray-800/80 dark:text-white',
        'fa-clipboard-list'
      )}
      ${_createSummaryCard(
        'MCQ মূল্যায়ন',
        summary.totalMcqEvaluations,
        'bg-purple-50 text-purple-700 dark:bg-gray-800/80 dark:text-white',
        'fa-brain'
      )}
      ${_createSummaryCard(
        'গড় স্কোর (%)',
        _formatPercent(summary.averageScore),
        'bg-emerald-50 text-emerald-700 dark:bg-gray-800/80 dark:text-white',
        'fa-gauge'
      )}
      ${_createSummaryCard(
        'বাকি শিক্ষার্থী',
        summary.pendingStudents,
        'bg-rose-50 text-rose-700 dark:bg-gray-800/80 dark:text-white',
        'fa-user-clock'
      )}
    </div>
  `;

  const filterHtml = `
    <div class="card card-body space-y-4">
      <div class="grid gap-4 lg:grid-cols-3">
        <div>
          <label for="statsGroupFilter" class="label">গ্রুপ নির্বাচন</label>
          <select id="statsGroupFilter" class="form-select stats-filter">
            <option value="all">সমস্ত গ্রুপ</option>
            ${groupOptions
              .map(
                (group) =>
                  `<option value="${group.id}" ${group.id === filters.groupFilter ? 'selected' : ''}>${
                    group.label
                  }</option>`
              )
              .join('')}
          </select>
        </div>
        <div>
          <label class="label">মূল্যায়ন ধরন</label>
          <div class="flex flex-wrap gap-2" id="statsEvaluationTypeButtons">
            ${_createToggleButton('all', 'সব মূল্যায়ন', filters.evaluationType === 'all')}
            ${_createToggleButton('mcq', 'শুধু MCQ', filters.evaluationType === 'mcq')}
            ${_createToggleButton('regular', 'লিখিত/অন্যান্য', filters.evaluationType === 'regular')}
          </div>
        </div>
        <div>
          <label class="label">ভিউ মোড</label>
          <div class="flex flex-wrap gap-2" id="statsViewModeButtons">
            ${_createToggleButton(VIEW_MODES.TABLE, 'টেবিল ভিউ', filters.viewMode === VIEW_MODES.TABLE)}
            ${_createToggleButton(VIEW_MODES.CHART, 'চার্ট ভিউ', filters.viewMode === VIEW_MODES.CHART)}
          </div>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <label class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" id="statsPendingToggle" class="form-checkbox stats-filter" ${
            filters.showPendingOnly ? 'checked' : ''
          }/>
          শুধু বাকি থাকা মূল্যায়ন দেখাও
        </label>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          সক্রিয় গ্রুপ: ${_formatNumber(summary.groupsInView)} / ${_formatNumber(summary.totalGroups)}
          · অংশগ্রহণ হার: ${_formatPercent(summary.participationRate)}
          · সর্বশেষ মূল্যায়ন: ${summary.latestEvaluation || '—'}
        </div>
      </div>
    </div>
  `;

  elements.filterContainer.innerHTML = `
    <div class="space-y-6">
      ${cardsHtml}
      ${filterHtml}
    </div>
  `;

  _bindFilterEvents(filters);
}

/**
 * Create a summary card.
 * (Improved contrast in dark mode via subtle border.)
 */
function _createSummaryCard(title, value, classes, icon) {
  const displayValue = typeof value === 'string' ? value : _formatNumber(value);
  return `
    <div class="rounded-2xl border ${classes} border-gray-200/60 dark:border-white/10 p-4 shadow-sm backdrop-blur">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-medium opacity-80">${title}</div>
          <div class="mt-2 text-2xl font-semibold">${displayValue}</div>
        </div>
        <div class="text-3xl opacity-70"><i class="fas ${icon}"></i></div>
      </div>
    </div>
  `;
}

/**
 * Create filter toggle button markup.
 */
function _createToggleButton(value, label, isActive) {
  const baseClass = 'px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm transition-colors';
  const activeClass = isActive
    ? 'bg-blue-600 text-white border-blue-600 shadow'
    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700';
  return `<button type="button" class="${baseClass} ${activeClass}" data-stat-value="${value}">${label}</button>`;
}

/**
 * Attach event handlers for filters.
 */
function _bindFilterEvents(filters) {
  const groupSelect = elements.filterContainer.querySelector('#statsGroupFilter');
  const evaluationButtons = elements.filterContainer.querySelectorAll('#statsEvaluationTypeButtons button');
  const viewButtons = elements.filterContainer.querySelectorAll('#statsViewModeButtons button');
  const pendingToggle = elements.filterContainer.querySelector('#statsPendingToggle');

  if (groupSelect) {
    uiManager.addListener(groupSelect, 'change', (event) => {
      stateManager.updateFilters('statistics', { ...filters, groupFilter: event.target.value });
      render();
    });
  }

  evaluationButtons.forEach((btn) => {
    uiManager.addListener(btn, 'click', () => {
      const nextValue = btn.getAttribute('data-stat-value');
      if (nextValue && nextValue !== filters.evaluationType) {
        stateManager.updateFilters('statistics', { ...filters, evaluationType: nextValue });
        render();
      }
    });
  });

  viewButtons.forEach((btn) => {
    uiManager.addListener(btn, 'click', () => {
      const nextValue = btn.getAttribute('data-stat-value');
      if (nextValue && nextValue !== filters.viewMode) {
        stateManager.updateFilters('statistics', { ...filters, viewMode: nextValue });
        render();
      }
    });
  });

  if (pendingToggle) {
    uiManager.addListener(pendingToggle, 'change', (event) => {
      stateManager.updateFilters('statistics', { ...filters, showPendingOnly: event.target.checked });
      render();
    });
  }
}

/**
 * Render statistics content (table/chart/details).
 */
function _renderStatistics(statsData, filters) {
  if (!elements.statsContentContainer) return;
  const { groupMetrics, chartData } = statsData;

  let contentHtml = '<div class="space-y-6">';

  if (filters.viewMode === VIEW_MODES.TABLE) {
    contentHtml += _buildTableHtml(groupMetrics, filters);
  } else if (filters.viewMode === VIEW_MODES.CHART) {
    contentHtml += _buildChartContainerHtml(groupMetrics);
  }

  if (filters.groupFilter !== 'all' && groupMetrics.length === 1) {
    contentHtml += _buildEvaluationDetailHtml(groupMetrics[0]);
  }

  contentHtml += '</div>';
  elements.statsContentContainer.innerHTML = contentHtml;

  if (filters.viewMode === VIEW_MODES.CHART) {
    if (chartData) {
      _renderChart(chartData);
      // Ensure correct sizing after becoming visible (tab switch, etc.)
      setTimeout(() => {
        if (groupStatsChart) groupStatsChart.resize();
      }, 0);
    } else {
      _destroyChart();
    }
  } else {
    _destroyChart();
  }
}

/**
 * Build HTML for the table view.
 */
function _buildTableHtml(groupMetrics, filters) {
  if (!groupMetrics.length) {
    return `
      <div class="card card-body">
        <div class="placeholder-content">
          <i class="fas fa-info-circle mr-2"></i>
          নির্বাচিত ফিল্টারের জন্য কোনো তথ্য পাওয়া যায়নি।
        </div>
      </div>
    `;
  }

  const headers = [
    'গ্রুপ',
    'মোট শিক্ষার্থী',
    'মোট মূল্যায়ন',
    'MCQ মূল্যায়ন',
    'গড় স্কোর (%)',
    'অংশগ্রহণ হার (%)',
    'বাকি শিক্ষার্থী',
    'সর্বশেষ মূল্যায়ন',
  ];

  const rows = groupMetrics
    .map((group) => {
      const name = _formatText(group.groupName);
      return `
        <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition">
          <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">${name}</td>
          <td class="px-4 py-3 text-gray-700 dark:text-gray-300 text-center">${_formatNumber(group.studentCount)}</td>
          <td class="px-4 py-3 text-gray-700 dark:text-gray-300 text-center">${_formatNumber(
            group.evaluationCount
          )}</td>
          <td class="px-4 py-3 text-gray-700 dark:text-gray-300 text-center">${_formatNumber(
            group.mcqEvaluationCount
          )}</td>
          <td class="px-4 py-3 text-center">
            <span class="font-semibold ${_scoreColorClass(group.averageScore)}">${_formatPercent(
        group.averageScore
      )}</span>
          </td>
          <td class="px-4 py-3 text-center">
            <span class="font-semibold text-indigo-600 dark:text-indigo-300">${_formatPercent(
              group.participationRate
            )}</span>
          </td>
          <td class="px-4 py-3 text-center">
            <span class="font-semibold ${group.pendingStudents > 0 ? 'text-rose-500' : 'text-emerald-500'}">
              ${_formatNumber(group.pendingStudents)}
            </span>
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300 text-sm text-center">${
            group.latestEvaluationLabel || '—'
          }</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="card overflow-hidden">
      <div class="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white">গ্রুপ ভিত্তিক বিশ্লেষণ</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          ভিউ মোড: ${filters.viewMode === VIEW_MODES.TABLE ? 'টেবিল' : 'চার্ট'} · মূল্যায়ন ধরন: ${_evaluationTypeLabel(
    filters.evaluationType
  )}
        </p>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              ${headers
                .map(
                  (header) =>
                    `<th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">${header}</th>`
                )
                .join('')}
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900/60 divide-y divide-gray-100 dark:divide-gray-800">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Build container for the chart view.
 */
function _buildChartContainerHtml(groupMetrics) {
  if (!groupMetrics.length) {
    return `
      <div class="card card-body">
        <div class="placeholder-content">
          <i class="fas fa-chart-column mr-2"></i>
          চার্ট প্রদর্শনের জন্য কোনো ডেটা নেই।
        </div>
      </div>
    `;
  }

  return `
    <div class="card">
      <div class="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white">গ্রুপ ভিত্তিক চার্ট বিশ্লেষণ</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">বার চার্টে গড় স্কোর, অংশগ্রহণ হার ও বাকি শিক্ষার্থী</p>
      </div>
      <div class="card-body">
        <div class="h-96">
          <canvas id="groupStatisticsChart"></canvas>
        </div>
      </div>
    </div>
  `;
}

/**
 * Build detailed evaluation list for a single group view.
 */
function _buildEvaluationDetailHtml(groupMetric) {
  if (!groupMetric || !groupMetric.evaluationDetails.length) return '';

  const detailRows = groupMetric.evaluationDetails
    .map((detail) => {
      return `
        <div class="border border-gray-100 dark:border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-gray-800 dark:text-white">${_formatText(detail.taskName)}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-3">
              <span><i class="fas fa-calendar-day mr-1"></i>${detail.dateLabel || '—'}</span>
              <span><i class="fas fa-list-check mr-1"></i>${detail.type === 'mcq' ? 'MCQ' : 'লিখিত/অন্যান্য'}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-200">
            <span class="font-semibold text-indigo-600 dark:text-indigo-300">গড় স্কোর: ${_formatPercent(
              detail.averagePercentage
            )}</span>
            <span>মূল্যায়িত: ${_formatNumber(detail.assessedCount)}</span>
            <span class="${detail.pendingCount > 0 ? 'text-rose-500 font-medium' : ''}">বাকি: ${_formatNumber(
        detail.pendingCount
      )}</span>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="card card-body space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h4 class="text-lg font-semibold text-gray-800 dark:text-white">
          ${_formatText(groupMetric.groupName)} - মূল্যায়ন বিশ্লেষণ
        </h4>
        <span class="text-sm text-gray-500 dark:text-gray-400">
          মোট ${_formatNumber(groupMetric.evaluationCount)}টি মূল্যায়ন বিশ্লেষিত
        </span>
      </div>
      <div class="space-y-3">
        ${detailRows}
      </div>
    </div>
  `;
}

/**
 * Calculate statistics based on filters.
 */
function _calculateStatistics(filters) {
  const { groups, students, tasks, evaluations } = stateManager.getState();
  const groupSummaries = new Map();
  const tasksMap = new Map(tasks.map((task) => [task.id, task]));

  groups.forEach((group) => {
    const studentCount = students.filter((student) => student.groupId === group.id).length;
    groupSummaries.set(group.id, {
      groupId: group.id,
      groupName: _formatText(group.name),
      studentCount,
      evaluationDetails: [],
      evaluationCounts: {
        all: 0,
        mcq: 0,
        regular: 0,
      },
      participants: {
        all: new Set(),
        mcq: new Set(),
        regular: new Set(),
      },
      latestEvaluationMs: null,
    });
  });

  evaluations.forEach((evaluation) => {
    const groupSummary = groupSummaries.get(evaluation.groupId);
    if (!groupSummary) return;

    const task = tasksMap.get(evaluation.taskId);
    const maxScore = parseFloat(evaluation.maxPossibleScore) || _deriveMaxScoreFromTask(task) || MAX_PERCENT;

    const isMcq = _isMcqEvaluation(task);
    const evaluationType = isMcq ? 'mcq' : 'regular';

    const scores = evaluation.scores || {};
    const assessedIds = Object.keys(scores);
    const assessedCount = assessedIds.length;
    const pendingCount = Math.max(groupSummary.studentCount - assessedCount, 0);

    let totalPercentage = 0;
    assessedIds.forEach((studentId) => {
      const rawScore = parseFloat(scores[studentId]?.totalScore) || 0;
      const percentage = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
      totalPercentage += percentage;
      groupSummary.participants.all.add(studentId);
      groupSummary.participants[evaluationType].add(studentId);
    });

    const averagePercentage = assessedCount > 0 ? totalPercentage / assessedCount : 0;
    const participationRate =
      groupSummary.studentCount > 0 ? Math.min(100, (assessedCount / groupSummary.studentCount) * 100) : 0;

    const timestampMs = _extractTimestamp(
      evaluation.taskDate || evaluation.completedAt || evaluation.updatedAt || evaluation.createdAt || task?.date
    );

    if (timestampMs && (!groupSummary.latestEvaluationMs || timestampMs > groupSummary.latestEvaluationMs)) {
      groupSummary.latestEvaluationMs = timestampMs;
    }

    groupSummary.evaluationCounts.all += 1;
    groupSummary.evaluationCounts[evaluationType] += 1;

    groupSummary.evaluationDetails.push({
      type: evaluationType,
      assessedCount,
      pendingCount,
      averagePercentage,
      weightedScoreSum: totalPercentage,
      weight: assessedCount,
      participationRate,
      dateMs: timestampMs,
      dateLabel: timestampMs ? _formatDate(timestampMs) : _formatDate(task?.date),
      taskName: task?.name || evaluation.taskName || 'অজানা মূল্যায়ন',
    });
  });

  const metricsArray = [];
  groupSummaries.forEach((summary) => {
    metricsArray.push(_deriveMetricsForGroup(summary, filters));
  });

  const filteredGroups = metricsArray
    .filter((metric) => (filters.groupFilter === 'all' ? true : metric.groupId === filters.groupFilter))
    .filter((metric) => (filters.showPendingOnly ? metric.pendingStudents > 0 : true))
    .sort((a, b) => b.evaluationCount - a.evaluationCount || b.averageScore - a.averageScore);

  const summary = _buildSummary(metricsArray, filteredGroups, filters);
  const chartData = _buildChartData(filteredGroups);

  return {
    filtersUsed: filters,
    groupMetrics: filteredGroups,
    summary,
    chartData,
    groupOptions: metricsArray.map((metric) => ({ id: metric.groupId, label: metric.groupName })),
  };
}

/**
 * Derive statistics for a single group respecting filters.
 */
function _deriveMetricsForGroup(summary, filters) {
  const relevantDetails =
    filters.evaluationType === 'all'
      ? summary.evaluationDetails
      : summary.evaluationDetails.filter((detail) => detail.type === filters.evaluationType);

  const evaluationCount = relevantDetails.length;
  const assessedTotal = relevantDetails.reduce((sum, detail) => sum + detail.assessedCount, 0);
  const pendingTotal = relevantDetails.reduce((sum, detail) => sum + detail.pendingCount, 0);
  const weightedScoreSum = relevantDetails.reduce((sum, detail) => sum + detail.weightedScoreSum, 0);
  const weight = relevantDetails.reduce((sum, detail) => sum + detail.weight, 0);

  const averageScore = weight > 0 ? weightedScoreSum / weight : 0;
  const participationRate =
    evaluationCount > 0 && summary.studentCount > 0
      ? Math.min(100, (assessedTotal / (summary.studentCount * evaluationCount)) * 100)
      : 0;

  const latestDetail = relevantDetails.reduce(
    (acc, detail) => {
      if (detail.dateMs && detail.dateMs > acc.maxDate) {
        return { maxDate: detail.dateMs, label: detail.dateLabel };
      }
      return acc;
    },
    { maxDate: -Infinity, label: null }
  );

  return {
    groupId: summary.groupId,
    groupName: summary.groupName,
    studentCount: summary.studentCount,
    evaluationCount,
    mcqEvaluationCount: summary.evaluationCounts.mcq,
    pendingStudents: pendingTotal,
    averageScore,
    participationRate,
    assessedCount: assessedTotal,
    weightedScoreSum,
    weight,
    latestEvaluationLabel:
      latestDetail.label || (summary.latestEvaluationMs ? _formatDate(summary.latestEvaluationMs) : null),
    uniqueParticipants: _getParticipantCount(summary.participants, filters.evaluationType),
    potentialParticipants: summary.studentCount * Math.max(evaluationCount, 1),
    evaluationDetails: relevantDetails.sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0)),
  };
}

/**
 * Aggregate summary for dashboard cards.
 */
function _buildSummary(allGroups, filteredGroups, filters) {
  const totalEvaluations = filteredGroups.reduce((sum, group) => sum + group.evaluationCount, 0);
  const totalMcqEvaluations =
    filters.evaluationType === 'mcq'
      ? totalEvaluations
      : filteredGroups.reduce((sum, group) => sum + group.mcqEvaluationCount, 0);
  const totalPending = filteredGroups.reduce((sum, group) => sum + group.pendingStudents, 0);
  const weightedScoreSum = filteredGroups.reduce((sum, group) => sum + group.weightedScoreSum, 0);
  const weight = filteredGroups.reduce((sum, group) => sum + group.weight, 0);
  const totalAssessed = filteredGroups.reduce((sum, group) => sum + group.assessedCount, 0);
  const totalPotential = filteredGroups.reduce((sum, group) => sum + group.potentialParticipants, 0);
  const latestDateMs = filteredGroups.reduce((max, group) => {
    const detail = group.evaluationDetails[0];
    if (detail?.dateMs && detail.dateMs > max) return detail.dateMs;
    return max;
  }, -Infinity);

  return {
    totalGroups: allGroups.length,
    groupsInView: filteredGroups.length,
    totalEvaluations,
    totalMcqEvaluations,
    averageScore: weight > 0 ? weightedScoreSum / weight : 0,
    pendingStudents: totalPending,
    participationRate: totalPotential > 0 ? Math.min(100, (totalAssessed / totalPotential) * 100) : 0,
    latestEvaluation: latestDateMs > 0 ? _formatDate(latestDateMs) : null,
  };
}

/**
 * Build chart data object. (Dark-mode aware)
 */
function _buildChartData(groupMetrics) {
  if (!groupMetrics.length) return null;

  const t = _getThemeColors();

  const labels = groupMetrics.map((group) => group.groupName);
  const averageScores = groupMetrics.map((group) => Number(group.averageScore.toFixed(2)));
  const participationRates = groupMetrics.map((group) => Number(group.participationRate.toFixed(2)));
  const pendingStudents = groupMetrics.map((group) => group.pendingStudents);

  const maxPending = pendingStudents.length ? Math.max(...pendingStudents) : 0;

  return {
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'গড় স্কোর (%)',
        data: averageScores,
        backgroundColor: t.scoreBar,
        borderRadius: 8,
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'অংশগ্রহণ হার (%)',
        data: participationRates,
        backgroundColor: t.partBar,
        borderRadius: 8,
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: 'বাকি শিক্ষার্থী (জন)',
        data: pendingStudents,
        backgroundColor: t.pendLine,
        borderColor: t.pendLineBorder,
        pointBackgroundColor: t.pendLineBorder,
        pointBorderColor: t.pendLineBorder,
        pointRadius: 3,
        borderWidth: 2,
        tension: 0.35,
        fill: false,
        yAxisID: 'y1',
      },
    ],
    options: {
      maintainAspectRatio: false,
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          beginAtZero: true,
          max: MAX_PERCENT,
          ticks: {
            color: t.ticks,
            callback: (value) => `${value}%`,
          },
          grid: {
            color: t.grid,
          },
        },
        y1: {
          beginAtZero: true,
          position: 'right',
          suggestedMax: maxPending * 1.2 || 10,
          ticks: {
            color: t.ticks,
            callback: (value) => _formatNumber(value),
          },
          grid: {
            drawOnChartArea: false,
          },
        },
        x: {
          ticks: { color: t.ticks },
          grid: { color: t.grid },
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: t.tooltipBg,
          titleColor: t.tooltipFg,
          bodyColor: t.tooltipFg,
          callbacks: {
            label: (context) => {
              if (context.dataset.yAxisID === 'y1') {
                return `${context.dataset.label}: ${_formatNumber(context.parsed.y)} জন`;
              }
              return `${context.dataset.label}: ${_formatPercent(context.parsed.y)}`;
            },
          },
        },
        legend: {
          labels: {
            usePointStyle: true,
            color: t.legend,
          },
        },
      },
      animation: false,
    },
  };
}

/**
 * Render Chart.js chart.
 */
function _renderChart(chartData) {
  const canvas = document.getElementById('groupStatisticsChart');
  if (!canvas) return;

  _destroyChart();

  groupStatsChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: chartData.labels,
      datasets: chartData.datasets,
    },
    options: chartData.options,
  });
}

/**
 * Destroy chart instance if exists.
 */
function _destroyChart() {
  if (groupStatsChart) {
    groupStatsChart.destroy();
    groupStatsChart = null;
  }
}

/**
 * Helpers
 */
function _getParticipantCount(participants, evaluationType) {
  if (evaluationType === 'mcq') return participants.mcq.size;
  if (evaluationType === 'regular') return participants.regular.size;
  return participants.all.size;
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

function _evaluationTypeLabel(type) {
  switch (type) {
    case 'mcq':
      return 'MCQ';
    case 'regular':
      return 'লিখিত/অন্যান্য';
    default:
      return 'সব মূল্যায়ন';
  }
}

function _scoreColorClass(value) {
  if (value >= 80) return 'text-emerald-500';
  if (value >= 60) return 'text-blue-500';
  if (value >= 40) return 'text-amber-500';
  return 'text-rose-500';
}

function _formatNumber(value) {
  if (helpers?.convertToBanglaNumber) {
    return helpers.convertToBanglaNumber(Math.round(value ?? 0));
  }
  return Math.round(value ?? 0).toString();
}

function _formatPercent(value) {
  const num = Number.isFinite(value) ? value : 0;
  const fixed = num.toFixed(1);
  if (helpers?.convertToBanglaNumber) {
    return `${helpers.convertToBanglaNumber(fixed)}%`;
  }
  return `${fixed}%`;
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
      } catch (err) {
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

/* ----------------- NEW: THEME & VISIBILITY UTILITIES ----------------- */

function _isDarkMode() {
  // Tailwind dark mode: 'dark' class on <html>, fallback to OS
  const root = document.documentElement;
  if (root.classList.contains('dark')) return true;
  if (root.classList.contains('light')) return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function _getThemeColors() {
  const dark = _isDarkMode();
  // Carefully chosen for contrast across backgrounds; WCAG-friendly
  return {
    dark,
    // data series colors
    scoreBar: dark ? 'rgba(96, 165, 250, 0.9)' : 'rgba(37, 99, 235, 0.9)', // blue-400/600
    partBar: dark ? 'rgba(52, 211, 153, 0.9)' : 'rgba(16, 185, 129, 0.9)', // emerald-400/500
    pendLine: dark ? 'rgba(248, 113, 113, 1.0)' : 'rgba(220, 38, 38, 1.0)', // rose-400/600
    pendLineBorder: dark ? 'rgba(252, 165, 165, 1.0)' : 'rgba(239, 68, 68, 1.0)',
    // chart chrome
    grid: dark ? 'rgba(148,163,184,0.25)' : 'rgba(100,116,139,0.2)',
    ticks: dark ? '#E5E7EB' : '#334155', // slate-200 / slate-700
    legend: dark ? '#F1F5F9' : '#0F172A', // slate-50 / slate-900
    tooltipBg: dark ? 'rgba(2,6,23,0.9)' : 'rgba(255,255,255,0.95)', // slate-950
    tooltipFg: dark ? '#F8FAFC' : '#0F172A',
  };
}

/**
 * Ensures we only render heavy parts (like charts) once the page/section
 * is actually visible. Fixes "0×0 canvas" when tab/panel is hidden on mount.
 */
function _whenVisible(el, onceCb) {
  if (!el) return;
  const isShown = !!(el.offsetParent || el.getClientRects().length);
  if (isShown) {
    onceCb();
    return;
  }

  visibilityObserver?.disconnect();
  visibilityObserver = new MutationObserver(() => {
    const shown = !!(el.offsetParent || el.getClientRects().length);
    if (shown) {
      visibilityObserver.disconnect();
      onceCb();
    }
  });

  // Observe style/class changes up the DOM chain
  let node = el;
  while (node && node !== document) {
    visibilityObserver.observe(node, { attributes: true, attributeFilter: ['class', 'style'], subtree: false });
    node = node.parentElement;
  }
}
