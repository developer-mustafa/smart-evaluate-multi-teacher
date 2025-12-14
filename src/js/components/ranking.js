// js/components/ranking.js

// Dependencies
let stateManager, uiManager, dataService, helpers, app;

// DOM Elements
const elements = {};

// Tab state
const uiTabState = { active: 'students' }; // 'students' | 'groups'

// Search state & cached data for re-rendering student list
const studentSearchState = { name: '', roll: '' };
const cachedRankingData = {
  rankedStudents: [],
  rankedGroups: [],
  groups: [],
  students: [],
};

// Ranking criteria
const MIN_EVALUATIONS_FOR_RANKING = 1;

/* ----------------------------- Soft Neumorphic + Gradient + Badges ------------------------------ */
function _ensureSoft3DStyles() {
  if (document.getElementById('ranking-soft3d-styles')) return;
  const style = document.createElement('style');
  style.id = 'ranking-soft3d-styles';
  style.textContent = `
  /* ---------- Global soft page vibe ---------- */
  .rk-soft-page{
    --rk-page-start:#f8fafc;
    --rk-page-mid:#eef2ff;
    --rk-page-end:#ffffff;
    background: radial-gradient(120% 140% at 10% -10%, var(--rk-page-start) 0%, var(--rk-page-mid) 42%, var(--rk-page-end) 100%);
    background-attachment: fixed;
  }
  .dark .rk-soft-page{
    --rk-page-start:#0b1220; --rk-page-mid:#0f172a; --rk-page-end:#111827;
    background: radial-gradient(120% 140% at 10% -10%, var(--rk-page-start) 0%, var(--rk-page-mid) 52%, var(--rk-page-end) 100%);
    background-attachment: fixed;
  }

  .rk-surface{
    --rk-bg:#fff;
    border-radius: 1rem;
    background-color: var(--rk-bg);
    box-shadow:
      8px 8px 20px rgba(0,0,0,.08),
      -6px -6px 16px rgba(255,255,255,.70),
      inset 0 1px 0 rgba(255,255,255,.45);
  }
  .dark .rk-surface{
    --rk-bg: rgba(17,24,39,.92);
    box-shadow:
      10px 10px 26px rgba(0,0,0,.45),
      -6px -6px 14px rgba(255,255,255,.06),
      inset 0 1px 0 rgba(255,255,255,.08);
  }

  .rk-chip{
    border-radius: .65rem;
    background: rgba(255,255,255,.85);
    border: 1px solid rgba(0,0,0,.06);
    box-shadow: 0 1px 0 rgba(255,255,255,.60) inset, 0 2px 6px rgba(0,0,0,.06);
    color: var(--rk-chip-fg, var(--rk-card-fg, #0f172a));
    white-space: nowrap;
  }
  .dark .rk-chip{
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.08);
    --rk-chip-fg: #f8fafc;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 2px 6px rgba(0,0,0,.35);
  }

  .rk-card{
    --rk-card-bg: var(--rk-bg, #fff);
    position: relative;
    border-radius: .9rem;
    background: var(--rk-card-bg);
    color: var(--rk-card-fg, #0f172a);
    border: 1px solid rgba(0,0,0,.06);
    box-shadow:
      6px 6px 16px rgba(0,0,0,.08),
      -4px -4px 12px rgba(255,255,255,.70),
      inset 0 1px 0 rgba(255,255,255,.45);
    transition: transform .2s ease, box-shadow .2s ease, background .25s ease;
  }
  .rk-card:hover{ transform: translateY(-1px); }
  .dark .rk-card{
    --rk-card-bg: rgba(15,23,42,.92);
    --rk-card-fg: #e2e8f0;
    border-color: rgba(255,255,255,.08);
    box-shadow:
      10px 10px 24px rgba(0,0,0,.45),
      -6px -6px 14px rgba(255,255,255,.06),
      inset 0 1px 0 rgba(255,255,255,.08);
  }

  .ranking-card{
    background: var(--rk-card-bg, #fdfefe);
    color: var(--rk-card-fg, #0f172a);
  }
  .dark .ranking-card{
    --rk-card-bg: rgba(13,20,34,.92);
    --rk-card-fg: #e2e8f0;
    border-color: rgba(255,255,255,.08);
  }
  .ranking-card *{
    color: inherit;
  }

  /* Accent border + glow (driven by --rk-grad/--rk-accent/--rk-glow) */
  .rk-card[data-accent]{
    border: 1px solid transparent;
    background-image:
      linear-gradient(var(--rk-card-bg), var(--rk-card-bg)),
      var(--rk-grad, linear-gradient(90deg,#e5e7eb,#e5e7eb));
    background-origin: border-box;
    background-clip: padding-box, border-box;
  }
  .rk-card[data-accent]::after{
    content:""; position:absolute; inset:-6px; z-index:-1; border-radius:inherit;
    background: radial-gradient(60% 60% at 50% -10%, var(--rk-accent, #94a3b8) 0%, transparent 60%);
    filter: blur(16px); opacity:.18; pointer-events:none;
  }
  .dark .rk-card[data-accent]::after{ opacity:.28; }

  .rk-meter-outer{
    box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 8px 18px var(--rk-glow, rgba(0,0,0,.10));
  }

  .rk-micro{ font-size: 11px; line-height: 1.1; }

  /* -------- Pretty, soft badges for Branch & Role -------- */
  .rk-badges{
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr)); /* mobile: 2 columns */
    gap: .35rem;
    margin-top: .45rem;

  }
  .rk-badge{
    display:inline-flex; align-items:center; justify-content:center; gap:.35rem;
    padding:.32rem .50rem; border-radius:.65rem;
    border:1px solid var(--rk-badge-border, rgba(0,0,0,.06));
    background: var(--rk-badge-bg, rgba(255,255,255,.85));
    color: var(--rk-badge-fg, #0f172a);
    font-weight:600; font-size:11px;
    box-shadow: 0 1px 0 rgba(255,255,255,.60) inset, 0 2px 6px var(--rk-badge-glow, rgba(0,0,0,.05));
    white-space: nowrap;
    min-width: 0;
    text-align: center;
  }
  .dark .rk-badge{
    border-color: var(--rk-badge-border-dark, rgba(255,255,255,.12));
    background: var(--rk-badge-bg-dark, rgba(255,255,255,.08));
    color: var(--rk-badge-fg-dark, #f8fafc);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 2px 8px var(--rk-badge-glow-dark, rgba(0,0,0,.45));
  }
  .rk-badge i{ font-size: 11px; }
  .rk-badge--compact{ padding:.28rem .45rem; font-size:10px; }

  @media (min-width: 640px){
    .rk-badges{ display:flex; flex-wrap:wrap; gap:.4rem; }
    .rk-badge{ padding:.46rem .66rem; font-size:12px; }
    .rk-badge i{ font-size:12px; }
  }

  /* -------- Tabs -------- */
  .rk-tabbar{
    display:flex; flex-wrap:wrap; gap:.6rem; align-items:center; justify-content:space-between;
    padding:.6rem; border-radius:.9rem;
    background: color-mix(in srgb, var(--rk-bg) 88%, transparent);
    backdrop-filter: blur(6px);
  }
  .rk-tabs{
    display:flex; gap:.4rem; align-items:center;
    padding:.25rem; border-radius:999px;
    background: linear-gradient(180deg, rgba(0,0,0,.03), rgba(0,0,0,0));
    border:1px solid rgba(0,0,0,.06);
    box-shadow: 0 1px 0 rgba(255,255,255,.5) inset;
  }
  .dark .rk-tabs{ border-color: rgba(255,255,255,.10); background: rgba(255,255,255,.04); }

  .rk-tab{
    position:relative; border:0; background:transparent; cursor:pointer;
    padding:.55rem .85rem; border-radius:999px; font-weight:600; font-size:14px;
    color: #0f172a;
  }
  .dark .rk-tab{ color:#e5e7eb; }

  .rk-tab[aria-selected="true"]{
    color:white;
    background: var(--rk-grad, linear-gradient(90deg,#0ea5e9,#7dd3fc));
    box-shadow: 0 6px 14px var(--rk-glow, rgba(14,165,233,.25));
  }

  .rk-tab-search{ display:flex; gap:.5rem; width:100%; max-width:560px; }
  .rk-input{
    flex:1 1 auto;
    padding:.55rem .75rem; border-radius:.7rem;
    border:1px solid rgba(0,0,0,.08);
    background: rgba(255,255,255,.85);
    color:#0f172a; font-size: 14px; outline: none;
  }
  .rk-input::placeholder{ color:#94a3b8; }
  .rk-input:focus{ border-color: rgba(14,165,233,.45); box-shadow: 0 0 0 3px rgba(14,165,233,.12); }
  .rk-input:disabled{ opacity:.55; cursor:not-allowed; }

  .dark .rk-input{ background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.10); color:#e5e7eb; }
  .dark .rk-input:focus{ border-color: rgba(14,165,233,.55); box-shadow: 0 0 0 3px rgba(14,165,233,.22); }
  `;
  document.head.appendChild(style);
}
function _ensureSoftPageVibe() {
  const root = document.body || document.documentElement;
  if (root && !root.classList.contains('rk-soft-page')) root.classList.add('rk-soft-page');
}

/**
 * Initializes the Ranking component.
 */
export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  dataService = dependencies.services.dataService;
  helpers = dependencies.utils;
  app = dependencies.app;

  _ensureSoft3DStyles();
  _ensureSoftPageVibe();
  _cacheDOMElements();
  _setupEventListeners();

  console.log('✅ Ranking component initialized.');
  return { render };
}

/**
 * Renders the Ranking page (#page-student-ranking).
 */
export function render() {
  if (!elements.page) {
    console.error('❌ Ranking render failed: Page element not found.');
    return;
  }
  console.log('Rendering Student Ranking page...');

  uiManager.showLoading('র‍্যাঙ্কিং গণনা করা হচ্ছে...');
  try {
    const { students, evaluations, tasks, groups } = stateManager.getState();
    if (!students || !evaluations || !tasks) {
      uiManager.displayEmptyMessage(elements.studentRankingListContainer, 'র‍্যাঙ্কিং গণনার জন্য ডেটা লোড হচ্ছে...');
      return;
    }

    const rankedStudents = _calculateStudentRankings(students, evaluations, tasks);
    const rankedGroups = _calculateGroupRankings(students, evaluations, groups || []);

    cachedRankingData.rankedStudents = rankedStudents;
    cachedRankingData.rankedGroups = rankedGroups;
    cachedRankingData.groups = groups || [];
    cachedRankingData.students = students || [];
    studentSearchState.name = '';
    studentSearchState.roll = '';
    uiTabState.active = 'students'; // default active tab

    _renderRankingList(rankedStudents, rankedGroups, groups || [], students);
  } catch (error) {
    console.error('❌ Error rendering student ranking:', error);
    uiManager.displayEmptyMessage(elements.studentRankingListContainer, 'র‍্যাঙ্কিং লোড করতে একটি ত্রুটি ঘটেছে।');
  } finally {
    uiManager.hideLoading();
  }
}

/* ---------------- DOM Cache & Events ---------------- */

function _cacheDOMElements() {
  elements.page = document.getElementById('page-student-ranking');
  if (elements.page) {
    elements.refreshRankingBtn = elements.page.querySelector('#refreshRanking');
    elements.studentRankingListContainer = elements.page.querySelector('#studentRankingList');
  } else {
    console.error('❌ Ranking init failed: #page-student-ranking element not found!');
  }
}

function _setupEventListeners() {
  if (!elements.page) return;
  uiManager.addListener(elements.refreshRankingBtn, 'click', async () => {
    uiManager.showLoading('র‍্যাঙ্কিং রিফ্রেশ করা হচ্ছে...');
    try {
      await app.refreshAllData();
    } catch (error) {
      console.error('❌ Error refreshing ranking data:', error);
      uiManager.showToast('র‍্যাঙ্কিং রিফ্রেশ করতে সমস্যা হয়েছে।', 'error');
    }
  });

  // Card click → open student modal if available
  uiManager.addListener(elements.studentRankingListContainer, 'click', (e) => {
    const studentCard = e.target.closest('[data-student-id]');
    if (studentCard && typeof window !== 'undefined' && typeof window.openStudentModalById === 'function') {
      const studentId = studentCard.getAttribute('data-student-id');
      if (studentId) {
        e.preventDefault();
        try {
          window.openStudentModalById(studentId);
        } catch {}
        return;
      }
    }

    const groupCard = e.target.closest('[data-group-id]');
    if (groupCard && typeof window !== 'undefined' && typeof window.openGroupModalById === 'function') {
      const groupId = groupCard.getAttribute('data-group-id');
      if (groupId) {
        e.preventDefault();
        try {
          window.openGroupModalById(groupId);
        } catch {}
      }
    }
  });
}

/* =========================================================
   RANKING LOGIC
========================================================= */

function _calculateStudentRankings(students, evaluations, tasks) {
  if (!students || !evaluations || !tasks) return [];

  const studentPerf = {};
  evaluations.forEach((evaluation) => {
    const maxScore = parseFloat(evaluation.maxPossibleScore) || 60;
    const ts = _extractTimestamp(
      evaluation.taskDate || evaluation.updatedAt || evaluation.evaluationDate || evaluation.createdAt
    );
    const scores = evaluation.scores || {};
    Object.entries(scores).forEach(([studentId, scoreData]) => {
      if (!studentPerf[studentId]) {
        studentPerf[studentId] = { evalCount: 0, totalScore: 0, maxScoreSum: 0, latestMs: null };
      }
      const totalScore = parseFloat(scoreData.totalScore) || 0;
      const rec = studentPerf[studentId];
      rec.evalCount += 1;
      rec.totalScore += totalScore;
      rec.maxScoreSum += maxScore;
      if (ts) rec.latestMs = rec.latestMs ? Math.max(rec.latestMs, ts) : ts;
    });
  });

  const ranked = students
    .map((stu) => {
      const perf = studentPerf[stu.id];
      if (!perf || perf.evalCount < MIN_EVALUATIONS_FOR_RANKING) return null;
      const efficiency = perf.maxScoreSum > 0 ? (perf.totalScore / perf.maxScoreSum) * 100 : 0;
      return {
        student: stu,
        evalCount: perf.evalCount,
        totalScore: perf.totalScore,
        maxScoreSum: perf.maxScoreSum,
        efficiency,
        latestEvaluationMs: perf.latestMs || null,
        rank: 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
      if (b.evalCount !== a.evalCount) return b.evalCount - a.evalCount;
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.maxScoreSum !== a.maxScoreSum) return b.maxScoreSum - a.maxScoreSum;
      return (b.latestEvaluationMs || 0) - (a.latestEvaluationMs || 0);
    });

  ranked.forEach((x, i) => (x.rank = i + 1));
  return ranked;
}

function _calculateGroupRankings(students, evaluations, groups) {
  if (!students || !evaluations) return [];

  const groupNameMap = new Map((groups || []).map((g) => [g.id, g.name || 'গ্রুপ']));
  const studentToGroup = new Map((students || []).map((s) => [s.id, s.groupId || '__none']));

  const groupSize = {};
  (students || []).forEach((s) => {
    const gid = s.groupId || '__none';
    groupSize[gid] = (groupSize[gid] || 0) + 1;
  });

  const groupAgg = {};
  evaluations.forEach((evaluation) => {
    const maxScore = parseFloat(evaluation.maxPossibleScore) || 60;
    const ts = _extractTimestamp(
      evaluation.taskDate || evaluation.updatedAt || evaluation.evaluationDate || evaluation.createdAt
    );
    const scores = evaluation.scores || {};
    const countedGroups = new Set();
    Object.entries(scores).forEach(([studentId, scoreData]) => {
      const gid = studentToGroup.get(studentId) || '__none';
      if (!groupAgg[gid]) {
        groupAgg[gid] = { evalCount: 0, totalScore: 0, maxScoreSum: 0, latestMs: null, participants: new Set() };
      }
      const totalScore = parseFloat(scoreData.totalScore) || 0;
      const rec = groupAgg[gid];
      if (!countedGroups.has(gid)) {
        rec.evalCount += 1;
        countedGroups.add(gid);
      }
      rec.totalScore += totalScore;
      rec.maxScoreSum += maxScore;
      rec.participants.add(studentId);
      if (ts) rec.latestMs = rec.latestMs ? Math.max(rec.latestMs, ts) : ts;
    });
  });

  const rankedGroups = Object.entries(groupAgg)
    .map(([gid, agg]) => {
      if (agg.evalCount < MIN_EVALUATIONS_FOR_RANKING) return null;
      const efficiency = agg.maxScoreSum > 0 ? (agg.totalScore / agg.maxScoreSum) * 100 : 0;
      const size = groupSize[gid] || 0;
      const participantsCount = agg.participants.size;
      const remainingCount = Math.max(0, size - participantsCount);
      return {
        groupId: gid,
        groupName: groupNameMap.get(gid) || 'গ্রুপ নেই',
        evalCount: agg.evalCount,
        totalScore: agg.totalScore,
        maxScoreSum: agg.maxScoreSum,
        efficiency,
        latestEvaluationMs: agg.latestMs || null,
        participantsCount,
        groupSize: size,
        remainingCount,
        rank: 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
      if (b.evalCount !== a.evalCount) return b.evalCount - a.evalCount;
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.maxScoreSum !== a.maxScoreSum) return b.maxScoreSum - a.maxScoreSum;
      return (b.latestEvaluationMs || 0) - (a.latestEvaluationMs || 0);
    });

  rankedGroups.forEach((g, i) => (g.rank = i + 1));
  return rankedGroups;
}

/* ---------------- Render (Tabs + Compact Cards) ---------------- */

function _renderRankingList(rankedStudents, rankedGroups, groups, students, options = {}) {
  if (!elements.studentRankingListContainer) return;

  const onlyUpdateStudents = Boolean(options?.onlyUpdateStudents);
  let studentCardsTarget = null;
  if (onlyUpdateStudents) {
    studentCardsTarget = elements.studentRankingListContainer.querySelector('[data-student-cards]');
    if (!studentCardsTarget) return;
  }

  const groupsMap = new Map((groups || []).map((g) => [g.id, g.name])); // for student group name

  const formatPct2 = (n) => {
    const str = (Number(n) || 0).toFixed(2);
    return helpers?.convertToBanglaNumber ? helpers.convertToBanglaNumber(str) : str;
  };
  const formatInt = (n) => {
    const str = `${Math.round(Number(n) || 0)}`;
    return helpers?.convertToBanglaNumber ? helpers.convertToBanglaNumber(str) : str;
  };
  const formatNum2 = (n) => {
    const str = (Number(n) || 0).toFixed(2);
    return helpers?.convertToBanglaNumber ? helpers.convertToBanglaNumber(str) : str;
  };
  const toBn = (v) => {
    const raw = (v ?? '').toString();
    return helpers?.convertToBanglaNumber ? helpers.convertToBanglaNumber(raw) : raw;
  };

  // Determine accent palette from current tab top rank
  const topStudent = (rankedStudents && rankedStudents[0]) || null;
  const topGroup = (rankedGroups && rankedGroups[0]) || null;
  const paletteNow =
    uiTabState.active === 'students'
      ? _getScorePalette(topStudent ? topStudent.efficiency : 70)
      : _getScorePalette(topGroup ? topGroup.efficiency : 70);

  // Build tabs + search row
  const searchDisabled = uiTabState.active !== 'students';
  const nameValue = _escapeHtml(studentSearchState.name);
  const rollValue = _escapeHtml(studentSearchState.roll);

  const tabbar = `
    <div class="rk-tabbar rk-surface" style="--rk-accent:${paletteNow.solid}; --rk-grad:${paletteNow.grad}; --rk-glow:${
    paletteNow.shadow
  };">
      <div class="rk-tabs">
        <button class="rk-tab" data-tab="students" aria-selected="${
          uiTabState.active === 'students'
        }">শিক্ষার্থী র‍্যাঙ্কিং</button>
        <button class="rk-tab" data-tab="groups" aria-selected="${
          uiTabState.active === 'groups'
        }">গ্রুপ র‍্যাঙ্কিং</button>
      </div>
      <div class="rk-tab-search">
        <input id="studentSearchName" type="text" class="rk-input" placeholder="নাম দিয়ে সার্চ"
          value="${nameValue}" ${searchDisabled ? 'disabled' : ''} />
        <input id="studentSearchRoll" type="text" inputmode="numeric" autocomplete="off"
          class="rk-input" placeholder="রোল (এক্স্যাক্ট)" value="${rollValue}" ${searchDisabled ? 'disabled' : ''} />
      </div>
    </div>
  `;

  // STUDENT CARDS (with responsive badge grid & meter size)
  const studentCards =
    rankedStudents && rankedStudents.length
      ? (uiTabState.active === 'students' ? _filterStudentsForSearch(rankedStudents) : rankedStudents)
          .map((item) => {
            const s = item.student;
            const rankText = _toBnRank(item.rank);
            const avgPct = formatPct2(item.efficiency);
            const evals = formatInt(item.evalCount);
            // const maxPossible = formatNum2(item.maxScoreSum);
            // const totalMark = formatNum2(item.totalScore);
            const palette = _getScorePalette(item.efficiency);

            const groupName = groupsMap.get(s.groupId) || 'গ্রুপ নেই';
            const idLine = `রোল: ${toBn(s.roll || '—')} · গ্রুপ: ${_escapeHtml(groupName)}`;

            // Badges: Academic Branch + Role (soft colors)
            const branchMeta = _branchBadgeMeta(s.academicGroup);
            const roleMeta = _roleBadgeMeta(s.role);
            const branchBadge = _renderBadge(branchMeta, s.academicGroup || 'একাডেমিক শাখা');
            const roleBadge = _renderBadge(roleMeta, _roleLabel(s.role));

            return `
        <article class="ranking-card rk-card p-4 flex items-center gap-3 justify-between"
          data-student-id="${s.id}" data-accent
          style="--rk-accent:${palette.solid}; --rk-grad:${palette.grad}; --rk-glow:${palette.shadow};">
          
          <div class="flex items-start gap-3 min-w-0">
            <div class="rk-chip px-3 py-2 text-center shrink-0">
              <div class="text-sm font-bold">${rankText}</div>
              <div class="rk-micro text-gray-500 dark:text-gray-400">র‍্যাঙ্ক</div>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 min-w-0">
                <h4 class="font-semibold truncate" title="${_formatLabel(s.name)}">${_formatLabel(s.name)}</h4>
              </div>

              <p class="rk-micro mt-1 text-gray-600 dark:text-gray-300 truncate" title="${_escapeHtml(
                idLine
              )}">${idLine}</p>

              <div class="rk-badges">
                ${branchBadge}
                ${roleBadge}
              </div>

              <div class="flex gap-4 sm:gap-8 mt-2 text-[10px] sm:text-sm font-semibold">
                <div class="hidden sm:flex">গড়: ${avgPct}%</div>
                <div class="">এসাইনমেন্ট অংশগ্রহন: ${evals} টি</div>
              </div>
             
            </div>
          </div>

          <div class="flex flex-col items-center gap-1 shrink-0">
            ${_buildCircularMeter(item.efficiency, palette, _meterSize())}
            <span class="rk-micro text-gray-500 dark:text-gray-400">Avg%</span>
          </div>
        </article>`;
          })
          .join('')
      : `<div class="rk-card p-4 text-center text-gray-600 dark:text-gray-300">কোনো শিক্ষার্থী পাওয়া যায়নি।</div>`;

  // GROUP CARDS
  const groupCards =
    rankedGroups && rankedGroups.length
      ? rankedGroups
          .map((g) => {
            const rank = _toBnRank(g.rank);
            const avgPct = formatPct2(g.efficiency);
            const evals = formatInt(g.evalCount);
            const palette = _getScorePalette(g.efficiency);
            const membersLine = `মোট সদস্য: ${formatInt(g.groupSize)} · পরীক্ষায় অংশগ্রহন : ${formatInt(
              g.participantsCount
            )} · বাকি সদস্য: ${formatInt(g.remainingCount)}`;
            const dataGroupAttr =
              g.groupId && g.groupId !== '__none' ? ` data-group-id="${_escapeHtml(g.groupId)}"` : '';

            return `
        <article class="rk-card p-4 flex items-center gap-3 justify-between"
          data-accent${dataGroupAttr} style="--rk-accent:${palette.solid}; --rk-grad:${palette.grad}; --rk-glow:${
              palette.shadow
            };">
          
          <div class="flex items-start gap-3 min-w-0">
            <div class="rk-chip px-3 py-2 text-center shrink-0">
              <div class="text-sm font-bold">${rank}</div>
              <div class="rk-micro text-gray-500 dark:text-gray-400">গ্রুপ র‍্যাঙ্ক</div>
            </div>
            <div class="min-w-0">
              <h4 class="font-semibold truncate" title="${_formatLabel(g.groupName)}">${_formatLabel(g.groupName)}</h4>
              <div class="mt-1 grid grid-cols-2 gap-2 text-[12px] font-semibold">
                <div class="rk-chip px-2 py-1">গড়: ${avgPct}%</div>
                <div class="rk-chip px-2 py-1">এসাইনমেন্ট অংশগ্রহন: ${evals} টি</div>
              </div>
              <p class="rk-micro mt-2 text-gray-600 dark:text-gray-300 truncate" title="${membersLine}">${membersLine}</p>
            </div>
          </div>

          <div class="flex flex-col items-center gap-1 shrink-0">
            ${_buildCircularMeter(g.efficiency, palette, _meterSize())}
            <span class="rk-micro text-gray-500 dark:text-gray-400">Avg%</span>
          </div>
        </article>`;
          })
          .join('')
      : `<div class="rk-card p-4 text-gray-700 dark:text-gray-300">গ্রুপ র‍্যাঙ্কিং প্রদর্শনের মতো তথ্য পাওয়া যায়নি।</div>`;

  // CONTENT by tab
  const content =
    uiTabState.active === 'students'
      ? `<div class="grid gap-4 grid-cols-1" data-student-cards>${studentCards}</div>`
      : `<div class="grid gap-4 grid-cols-1">${groupCards}</div>`;

  if (onlyUpdateStudents && studentCardsTarget) {
    studentCardsTarget.innerHTML = studentCards;
    return;
  }

  // Full repaint
  uiManager.clearContainer(elements.studentRankingListContainer);
  elements.studentRankingListContainer.innerHTML = `
    <div class="space-y-4" style="--rk-accent:${paletteNow.solid}; --rk-grad:${paletteNow.grad}; --rk-glow:${paletteNow.shadow};">
      ${tabbar}
      ${content}
    </div>
  `;

  _attachTabHandlers();
  _attachStudentSearchListeners(); // harmless if disabled
}

/* ---------------- search + tab handlers ---------------- */

function _attachTabHandlers() {
  if (!elements.studentRankingListContainer) return;
  const container = elements.studentRankingListContainer;

  const tabBtns = Array.from(container.querySelectorAll('.rk-tab'));
  tabBtns.forEach((btn) => {
    uiManager.addListener(btn, 'click', () => {
      const tab = btn.getAttribute('data-tab');
      if (!tab || (tab !== 'students' && tab !== 'groups')) return;
      if (uiTabState.active === tab) return;
      uiTabState.active = tab;

      // Repaint full to update accent + disabled states
      _renderRankingList(
        cachedRankingData.rankedStudents,
        cachedRankingData.rankedGroups,
        cachedRankingData.groups,
        cachedRankingData.students,
        { onlyUpdateStudents: false }
      );
    });
  });
}

function _attachStudentSearchListeners() {
  if (!elements.studentRankingListContainer) return;

  const nameInput = elements.studentRankingListContainer.querySelector('#studentSearchName');
  const rollInput = elements.studentRankingListContainer.querySelector('#studentSearchRoll');

  const enabled = uiTabState.active === 'students';

  if (nameInput) {
    elements.studentSearchNameInput = nameInput;
    nameInput.disabled = !enabled;
    uiManager.addListener(nameInput, 'input', (event) => {
      if (!enabled) return;
      _handleStudentSearchChange('name', event.target.value || '');
    });
  }
  if (rollInput) {
    elements.studentSearchRollInput = rollInput;
    rollInput.disabled = !enabled;
    uiManager.addListener(rollInput, 'input', (event) => {
      if (!enabled) return;
      _handleStudentSearchChange('roll', event.target.value || '');
    });
  }
}

function _handleStudentSearchChange(field, rawValue) {
  if (!Object.prototype.hasOwnProperty.call(studentSearchState, field)) return;
  const nextValue = typeof rawValue === 'string' ? rawValue : rawValue?.toString() || '';
  if (studentSearchState[field] === nextValue) return;
  studentSearchState[field] = nextValue;
  _rerenderStudentCardsWithFilters();
}

function _rerenderStudentCardsWithFilters() {
  if (uiTabState.active !== 'students') return;
  if (!cachedRankingData.rankedStudents || cachedRankingData.rankedStudents.length === 0) return;
  _renderRankingList(
    cachedRankingData.rankedStudents,
    cachedRankingData.rankedGroups,
    cachedRankingData.groups,
    cachedRankingData.students,
    { onlyUpdateStudents: true }
  );
}

function _filterStudentsForSearch(rankedStudents = []) {
  const nameQuery = (studentSearchState.name || '').trim().toLowerCase();
  const rollQuery = _normalizeRollString(studentSearchState.roll);
  if (!nameQuery && !rollQuery) return rankedStudents;

  return rankedStudents.filter((item) => {
    if (!item?.student) return false;
    const student = item.student;
    if (nameQuery) {
      const studentName = (student.name || '').toString().toLowerCase();
      if (!studentName.includes(nameQuery)) return false;
    }
    if (rollQuery) {
      const studentRoll = _normalizeRollString(student.roll);
      if (!studentRoll || studentRoll !== rollQuery) return false;
    }
    return true;
  });
}

/* ---------------- helpers ---------------- */

const BN_TO_EN_DIGITS = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

function _normalizeRollString(value) {
  if (value === undefined || value === null) return '';
  return value
    .toString()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[০-৯]/g, (d) => BN_TO_EN_DIGITS[d] || d);
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
  const n = Number(score) || 0;
  if (n >= 85) {
    return {
      name: 'green',
      solid: '#16a34a',
      shadow: 'rgba(22,163,74,.35)',
      grad: 'linear-gradient(90deg,#16a34a 0%,#22c55e 40%,#86efac 100%)',
    };
  }
  if (n >= 70) {
    return {
      name: 'sky',
      solid: '#0284c7',
      shadow: 'rgba(2,132,199,.30)',
      grad: 'linear-gradient(90deg,#0284c7 0%,#0ea5e9 40%,#7dd3fc 100%)',
    };
  }
  if (n >= 55) {
    return {
      name: 'amber',
      solid: '#d97706',
      shadow: 'rgba(217,119,6,.35)',
      grad: 'linear-gradient(90deg,#d97706 0%,#f59e0b 40%,#facc15 100%)',
    };
  }
  return {
    name: 'rose',
    solid: '#e11d48',
    shadow: 'rgba(225,29,72,.40)',
    grad: 'linear-gradient(90deg,#e11d48 0%,#f43f5e 40%,#fb7185 100%)',
  };
}

/* ===== Role & Branch badge helpers (soft, comfy colors) ===== */

function _roleLabel(code) {
  const map = {
    'team-leader': 'টিম লিডার',
    'time-keeper': 'টাইম কিপার',
    reporter: 'রিপোর্টার',
    'resource-manager': 'রিসোর্স ম্যানেজার',
    'peace-maker': 'পিস মেকার',
  };
  const r = (code || '').toString().trim();
  return map[r] || r || 'দায়িত্ব নেই';
}

function _roleBadgeMeta(roleCode) {
  const r = (roleCode || '').toString().trim();
  // soft palettes
  const palettes = {
    'team-leader': {
      icon: 'fa-crown',
      bg: 'rgba(251, 191, 36, .18)',
      fg: '#92400e',
      border: 'rgba(245, 158, 11, .35)',
      glow: 'rgba(251, 191, 36, .28)',
      darkBg: 'rgba(245, 158, 11, .22)',
      darkFg: '#fde68a',
      darkBorder: 'rgba(251, 191, 36, .45)',
      darkGlow: 'rgba(251, 191, 36, .38)',
    }, // amber
    'time-keeper': {
      icon: 'fa-stopwatch',
      bg: 'rgba(56, 189, 248, .16)',
      fg: '#0c4a6e',
      border: 'rgba(59, 130, 246, .35)',
      glow: 'rgba(56, 189, 248, .26)',
      darkBg: 'rgba(56, 189, 248, .22)',
      darkFg: '#e0f2fe',
      darkBorder: 'rgba(56, 189, 248, .48)',
      darkGlow: 'rgba(14, 165, 233, .35)',
    }, // sky
    reporter: {
      icon: 'fa-pen-nib',
      bg: 'rgba(196, 181, 253, .18)',
      fg: '#4c1d95',
      border: 'rgba(167, 139, 250, .35)',
      glow: 'rgba(196, 181, 253, .26)',
      darkBg: 'rgba(167, 139, 250, .24)',
      darkFg: '#ede9fe',
      darkBorder: 'rgba(196, 181, 253, .48)',
      darkGlow: 'rgba(139, 92, 246, .35)',
    }, // violet
    'resource-manager': {
      icon: 'fa-box-open',
      bg: 'rgba(134, 239, 172, .18)',
      fg: '#065f46',
      border: 'rgba(16, 185, 129, .35)',
      glow: 'rgba(134, 239, 172, .26)',
      darkBg: 'rgba(16, 185, 129, .22)',
      darkFg: '#d1fae5',
      darkBorder: 'rgba(16, 185, 129, .45)',
      darkGlow: 'rgba(5, 150, 105, .32)',
    }, // emerald
    'peace-maker': {
      icon: 'fa-dove',
      bg: 'rgba(253, 164, 175, .18)',
      fg: '#7f1d1d',
      border: 'rgba(244, 63, 94, .35)',
      glow: 'rgba(253, 164, 175, .28)',
      darkBg: 'rgba(244, 63, 94, .22)',
      darkFg: '#ffe4e6',
      darkBorder: 'rgba(244, 63, 94, .45)',
      darkGlow: 'rgba(244, 63, 94, .34)',
    }, // rose
  };
  const def = {
    icon: 'fa-id-badge',
    bg: 'rgba(226, 232, 240, .22)',
    fg: '#111827',
    border: 'rgba(148,163,184,.35)',
    glow: 'rgba(148,163,184,.20)',
    darkBg: 'rgba(148,163,184,.20)',
    darkFg: '#e2e8f0',
    darkBorder: 'rgba(148,163,184,.45)',
    darkGlow: 'rgba(148,163,184,.30)',
  };
  return palettes[r] || def;
}

function _branchBadgeMeta(academicGroup) {
  const g = (academicGroup || '').toString().trim().toLowerCase();
  const isSci = /science|বিজ্ঞান/.test(g);
  const isArts = /arts|মানবিক/.test(g);
  const isCom = /commerce|ব্যবসা|কমার্স/.test(g);
  const isVoc = /vocational|ভোকেশনাল/.test(g);
  if (isSci)
    return {
      icon: 'fa-atom',
      bg: 'rgba(153, 246, 228, .18)',
      fg: '#115e59',
      border: 'rgba(45, 212, 191, .35)',
      glow: 'rgba(94, 234, 212, .26)',
      darkBg: 'rgba(45, 212, 191, .22)',
      darkFg: '#ccfbf1',
      darkBorder: 'rgba(94, 234, 212, .48)',
      darkGlow: 'rgba(20, 184, 166, .32)',
    }; // teal
  if (isArts)
    return {
      icon: 'fa-palette',
      bg: 'rgba(254, 215, 170, .20)',
      fg: '#7c2d12',
      border: 'rgba(251, 146, 60, .35)',
      glow: 'rgba(254, 215, 170, .28)',
      darkBg: 'rgba(251, 146, 60, .24)',
      darkFg: '#ffedd5',
      darkBorder: 'rgba(251, 146, 60, .48)',
      darkGlow: 'rgba(249, 115, 22, .32)',
    }; // orange
  if (isCom)
    return {
      icon: 'fa-chart-line',
      bg: 'rgba(191, 219, 254, .20)',
      fg: '#1e3a8a',
      border: 'rgba(99, 102, 241, .35)',
      glow: 'rgba(191, 219, 254, .28)',
      darkBg: 'rgba(99, 102, 241, .24)',
      darkFg: '#e0e7ff',
      darkBorder: 'rgba(99, 102, 241, .48)',
      darkGlow: 'rgba(79, 70, 229, .32)',
    }; // indigo/blue
  if (isVoc)
    return {
      icon: 'fa-tools',
      bg: 'rgba(165, 243, 252, .20)',
      fg: '#164e63',
      border: 'rgba(34, 211, 238, .35)',
      glow: 'rgba(165, 243, 252, .28)',
      darkBg: 'rgba(34, 211, 238, .22)',
      darkFg: '#cffafe',
      darkBorder: 'rgba(34, 211, 238, .48)',
      darkGlow: 'rgba(14, 165, 233, .32)',
    }; // cyan
  return {
    icon: 'fa-layer-group',
    bg: 'rgba(241, 245, 249, .22)',
    fg: '#0f172a',
    border: 'rgba(148,163,184,.35)',
    glow: 'rgba(148,163,184,.18)',
    darkBg: 'rgba(148,163,184,.20)',
    darkFg: '#e2e8f0',
    darkBorder: 'rgba(148,163,184,.45)',
    darkGlow: 'rgba(148,163,184,.28)',
  }; // slate default
}

function _renderBadge(meta, label) {
  const safe = _escapeHtml(label || '');
  const bg = meta?.bg || 'rgba(255,255,255,.85)';
  const fg = meta?.fg || '#0f172a';
  const border = meta?.border || 'rgba(0,0,0,.06)';
  const glow = meta?.glow || 'rgba(0,0,0,.05)';
  const darkBg = meta?.darkBg || bg;
  const darkFg = meta?.darkFg || fg;
  const darkBorder = meta?.darkBorder || border;
  const darkGlow = meta?.darkGlow || glow;
  return `<span class="rk-badge rk-badge--compact"
    style="--rk-badge-bg:${bg};
           --rk-badge-fg:${fg};
           --rk-badge-border:${border};
           --rk-badge-glow:${glow};
           --rk-badge-bg-dark:${darkBg};
           --rk-badge-fg-dark:${darkFg};
           --rk-badge-border-dark:${darkBorder};
           --rk-badge-glow-dark:${darkGlow};">
           <i class="fas ${meta?.icon || 'fa-circle'}"></i>${safe}
  </span>`;
}

/* ========== Meter size responsive helper ========== */
function _meterSize() {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 480px)').matches ? 64 : 72;
  } catch {
    return 72;
  }
}

/** compact circular meter */
function _buildCircularMeter(percent, palette, size = 72) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const display = helpers?.convertToBanglaNumber
    ? helpers.convertToBanglaNumber(clamped.toFixed(2))
    : clamped.toFixed(2);
  const d = typeof size === 'number' ? size : 72;
  return `
    <div class="relative flex items-center justify-center" style="width:${d}px;height:${d}px;">
      <div class="absolute inset-0 rounded-full"
           style="background: conic-gradient(${palette.solid} ${clamped}%,
                                             rgba(0,0,0,0.08) ${clamped}% 100%);
                  filter: drop-shadow(0 6px 16px ${palette.shadow});">
      </div>
      <div class="rk-meter-outer absolute inset-[18%] rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
        <span class="text-sm font-semibold text-gray-800 dark:text-gray-100">${display}%</span>
      </div>
    </div>
  `;
}

function _toBnRank(n) {
  const num = Number(n) || 0;
  const ordinalMap = { 1: '১ম', 2: '২য়', 3: '৩য়', 4: '৪র্থ', 5: '৫ম', 6: '৬ষ্ঠ', 7: '৭ম', 8: '৮ম', 9: '৯ম', 10: '১০ম' };
  if (ordinalMap[num]) return `${ordinalMap[num]} র‍্যাঙ্ক`;
  const raw = `${num}`;
  const bnNumber = helpers?.convertToBanglaNumber ? helpers.convertToBanglaNumber(raw) : raw;
  return `${bnNumber}তম র‍্যাঙ্ক`;
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
      } catch {
        return null;
      }
    }
    if (typeof value.seconds === 'number') return value.seconds * 1000;
  }
  return null;
}
