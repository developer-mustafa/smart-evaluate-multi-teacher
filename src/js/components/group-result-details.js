
/* global window, document */
(() => {
  'use strict';

  // ---- absolute singleton guard (prevents double load/run) ----
  if (window.__GDM_MODAL_INIT__) return;
  window.__GDM_MODAL_INIT__ = true;

  const UI = { els: {}, bound: false, state: { currentGroupId: null } };

  // ---------- tiny helpers ----------
  const byId = (id) => document.getElementById(id);

  const bn = (n) => {
    try {
      return window.smartEvaluator?.utils?.convertToBanglaNumber(String(n)) ?? String(n);
    } catch { return String(n); }
  };

  const escHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const prettyRoleBn = (role) => (
    ({
      'team-leader': 'টিম লিডার',
      'time-keeper': 'টাইম কিপার',
      reporter: 'রিপোর্টার',
      'resource-manager': 'রিসোর্স ম্যানেজার',
      'peace-maker': 'পিস মেকার',
    }[String(role || '').trim()] || (role ? String(role) : ''))
  );

  const roleBadgeClass = (role) => (
    ({
      'team-leader': 'bg-amber-50 text-amber-700 border-amber-200',
      'time-keeper': 'bg-sky-50 text-sky-700 border-sky-200',
      reporter: 'bg-purple-50 text-purple-700 border-purple-200',
      'resource-manager': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'peace-maker': 'bg-rose-50 text-rose-700 border-rose-200',
    }[String(role || '').trim()] || 'bg-gray-50 text-gray-700 border-gray-200')
  );

  // Academic group badge palette (deterministic by name)
  const ACAD_PALETTE = [
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-700/40',
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-700/40',
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-700/40',
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-700/40',
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-700/40',
    'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:border-fuchsia-700/40',
    'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-500/10 dark:text-lime-300 dark:border-lime-700/40',
    'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-700/40',
    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-700/40',
    'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-700/40',
  ];

  const acadBadgeClass = (label) => {
    const s = String(label || '').trim();
    if (!s) return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700/60';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
    return ACAD_PALETTE[h % ACAD_PALETTE.length];
  };

  const pctBadgeClass = (p) => {
    const v = Number(p) || 0;
    if (v >= 85) return 'bg-emerald-50 text-emerald-700';
    if (v >= 70) return 'bg-sky-50 text-sky-700';
    if (v >= 55) return 'bg-amber-50 text-amber-700';
    return 'bg-rose-50 text-rose-700';
  };

  // ---------- state ----------
  function getState() {
    const app = window.smartEvaluator;
    if (!app) return { groups: [], students: [], tasks: [], evaluations: [] };
    const s = app.managers?.stateManager?.getState?.() || {};
    return {
      groups: Array.isArray(s.groups) ? s.groups : [],
      students: Array.isArray(s.students) ? s.students : [],
      tasks: Array.isArray(s.tasks) ? s.tasks : [],
      evaluations: Array.isArray(s.evaluations) ? s.evaluations : [],
      classes: Array.isArray(s.classes) ? s.classes : [],
      sections: Array.isArray(s.sections) ? s.sections : [],
    };
  }

  // timestamp normalizer for assorted Firestore/ISO dates
  function extractTs(d) {
    if (!d) return 0;
    if (typeof d === 'object' && d.seconds) return d.seconds * 1000;
    const t = Date.parse(d);
    return Number.isFinite(t) ? t : 0;
  }

  // ---------- computations ----------
  function computeGroupPerformance(groupId, state) {
    const taskMap = new Map(state.tasks.map((t) => [t?.id, t]));
    const members = state.students.filter((s) => String(s?.groupId) === String(groupId));
    const memberIds = new Set(members.map((m) => String(m?.id)));
    const evals = state.evaluations.filter((ev) => String(ev?.groupId) === String(groupId));

    const perEval = evals.map((ev) => {
      const task = taskMap.get(ev?.taskId);
      const max = parseFloat(ev?.maxPossibleScore) || parseFloat(task?.maxScore) || 100;
      let cnt = 0, sumPct = 0;
      let bestId = null, bestPct = -1;
      if (max > 0 && ev?.scores) {
        for (const [sid, sc] of Object.entries(ev.scores)) {
          if (!memberIds.has(String(sid))) continue;
          const tot = parseFloat(sc?.totalScore) || 0;
          const pct = (tot / max) * 100;
          cnt++; sumPct += pct;
          if (pct > bestPct) { bestPct = pct; bestId = sid; }
        }
      }
      const ts = extractTs(ev?.taskDate || ev?.updatedAt || ev?.evaluationDate || ev?.createdAt || task?.date);
      return { ev, task, ts, avgPct: cnt ? (sumPct / cnt) : 0, count: cnt, topStudentId: bestId, topPct: bestPct };
    });

    const groupAvg = perEval.length ? perEval.reduce((a, b) => a + b.avgPct, 0) / perEval.length : 0;

    // rank among all groups by their average %
    const other = state.groups.map((g) => {
      const gid = String(g?.id);
      const evs = state.evaluations.filter((ev) => String(ev?.groupId) === gid);
      const arr = evs.map((ev) => {
        const task = taskMap.get(ev?.taskId);
        const max = parseFloat(ev?.maxPossibleScore) || parseFloat(task?.maxScore) || 100;
        if (max <= 0 || !ev?.scores) return 0;
        let cnt = 0, sum = 0;
        for (const sc of Object.values(ev.scores)) {
          const tot = parseFloat(sc?.totalScore) || 0;
          cnt++; sum += (tot / max) * 100;
        }
        return cnt ? (sum / cnt) : 0;
      });
      return { id: gid, avg: arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : -1 };
    }).filter(x => x.avg >= 0).sort((a, b) => b.avg - a.avg);

    const rankIdx = other.findIndex((x) => x.id === String(groupId));
    return { members, perEval, groupAvg, rank: rankIdx >= 0 ? (rankIdx + 1) : null };
  }

  // ---------- render ----------
  async function renderGroupModal(groupId) {
    try {
      UI.state.currentGroupId = groupId;
      
      // Force reload fresh evaluation data from database to ensure sync
      const app = window.smartEvaluator;
      if (app?.managers?.cacheManager) {
        try {
          await app.managers.cacheManager.invalidate('evaluations_data');
          await app.managers.cacheManager.forceReload('evaluations_data');
        } catch (err) {
          console.warn('Failed to reload evaluations:', err);
        }
      }
      
      const state = getState();
      const group = state.groups.find((g) => String(g?.id) === String(groupId));
      if (!group) return;

      const { perEval, groupAvg, rank } = computeGroupPerformance(groupId, state);

      // Header
      const name = group?.name || group?.label || groupId;
      const elTitle = byId('gdmTitle');      if (elTitle) elTitle.textContent = 'গ্রুপের বিস্তারিত ফলাফল';
      const elName  = byId('gdmGroupName');  if (elName)  elName.textContent = name;
      const elAvg   = byId('gdmGroupAvg');   if (elAvg)   elAvg.textContent = `${(groupAvg || 0).toFixed(1)}%`;
      const elRank  = byId('gdmGroupRank');  if (elRank)  elRank.textContent = rank ? bn(rank) : '-';

      // --- Assignment-wise details in the "Members" tab (table body + selector) ---
      try {
        const sel  = byId('gdmAssignSelect'); // <select>
        const tbody = byId('gdmAssignBody');  // <tbody>
        const meta = byId('gdmAssignMeta');   // <div> or <span> for meta text

        if (sel && tbody) {
          // Inject headers if not present
          const theadRow = tbody.closest('table')?.querySelector('thead tr');
          if (theadRow && !theadRow.querySelector('.gdm-dynamic-header')) {
            const thClass = document.createElement('th');
            thClass.className = 'px-3 py-2 text-center whitespace-nowrap gdm-dynamic-header';
            thClass.textContent = 'ক্লাস';
            
            const thSection = document.createElement('th');
            thSection.className = 'px-3 py-2 text-center whitespace-nowrap gdm-dynamic-header';
            thSection.textContent = 'শাখা';

            // Insert after Name column (assuming Name is 2nd column, index 1? No, let's check existing headers)
            // Existing headers: Roll, Badge, Name, ...
            // We want to insert after Name.
            // Let's assume Name is the 3rd column (index 2).
            // Or just insert at specific position.
            // Let's inspect the row structure in renderAssignTable:
            // Roll, Badge, Name, Class, Section, ...
            // So we need to insert at index 3 and 4.
            
            if (theadRow.children.length >= 3) {
               theadRow.insertBefore(thSection, theadRow.children[3]);
               theadRow.insertBefore(thClass, theadRow.children[3]);
            }
          }

          const assigns = perEval.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));

          sel.innerHTML = assigns.map((e, idx) => {
            const d = e.ts ? new Date(e.ts).toISOString().slice(0, 10) : '-';
            const nm = e.task?.name || `Assignment-${idx + 1}`;
            return `<option value="${idx}">${escHtml(nm)} (${d})</option>`;
          }).join('');

          const renderAssignTable = (idx) => {
            const e = assigns[idx | 0];
            if (!e) {
              tbody.innerHTML = '';
              const elAA = byId('gdmAssignAvg'); if (elAA) elAA.textContent = '-';
              if (meta) meta.textContent = 'Task: - | Date: -'; const elAN = byId('gdmAssignName'); if (elAN) elAN.textContent = ''; const elAT = byId('gdmAssignTitle'); if (elAT) elAT.textContent = 'Assignment-wise Details';
              return;
            }

            try {
              const dstr = e.ts ? new Date(e.ts).toISOString().slice(0, 10) : '-';
              const nm = e.task?.name || `Assignment-${idx + 1}`;
              if (meta) meta.textContent = 'Task: ' + nm + ' | Date: ' + dstr;
              const elAN = byId('gdmAssignName'); if (elAN) elAN.textContent = nm;
              const elAT = byId('gdmAssignTitle'); if (elAT) elAT.textContent = 'Assignment-wise Details';
            } catch {}

            const elAA = byId('gdmAssignAvg');
            if (elAA) elAA.textContent = ((e.avgPct || 0).toFixed(1) + '%');

            const scores = e.ev?.scores || {};
            const classesMap = new Map(state.classes.map(c => [c.id, c]));
            const sectionsMap = new Map(state.sections.map(s => [s.id, s]));

            const rows = state.students
              .filter(s => String(s.groupId) === String(groupId))
              .map(s => {
                const sc = scores[s.id];
                const taskScore = parseFloat(sc?.taskScore) || 0;
                const teamScore = parseFloat(sc?.teamScore) || 0;
                const additional = parseFloat(sc?.additionalScore) || 0;
                const mcq = parseFloat(sc?.mcqScore) || 0;
                const total = parseFloat(sc?.totalScore) || (taskScore + teamScore + additional + mcq);
                const max = parseFloat(e.ev?.maxPossibleScore) || parseFloat(e.task?.maxScore) || 100;
                const pct = max > 0 ? (total / max) * 100 : 0;

                const duty = s.role || s.duty || '';
                const dutyLabel = prettyRoleBn(duty);
                const badge = dutyLabel
                  ? `<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${roleBadgeClass(duty)}"><i class="fas fa-id-badge"></i>${escHtml(dutyLabel)}</span>`
                  : '-';

                const comment = typeof sc?.comments === 'string' ? sc.comments.trim() : '';

                const agName = s.academicGroup || s.academic_group || s.academic || '';
                const agClass = acadBadgeClass(agName);
                const className = classesMap.get(s.classId)?.name || '-';
                const sectionName = sectionsMap.get(s.sectionId)?.name || '-';

                return {
                  roll: s.roll || s.studentRoll || s.classRoll || s.rollNumber || null,
                  badge,
                  name: s.name || s.id,
                  agName,
                  agClass,
                  className,
                  sectionName,
                  agName,
                  agClass,
                  taskScore, teamScore, additional, mcq, total, pct, comment,
                  taskScore, teamScore, additional, mcq, total, pct, comment,
                  problemRecovered: sc?.problemRecovered || false,
                  topic: sc?.additionalCriteria?.topic || null
                };
              })
              .filter(r => Number.isFinite(r.total))
              .sort((a, b) => b.pct - a.pct);

            const frag2 = document.createDocumentFragment();
            rows.forEach(r => {
              const tr = document.createElement('tr');
              const pctCls = pctBadgeClass(r.pct);
              const shortC = r.comment.length > 120 ? r.comment.slice(0, 117) + '.' : r.comment;

              tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap">${bn(r.roll ?? '-')}</td>
                <td class="px-3 py-2 whitespace-nowrap">
                  ${r.badge}
                </td>
                <td class="px-3 py-2 whitespace-nowrap">
                  <span class="font-medium">${escHtml(r.name)}</span>
                  ${r.agName ? `<span class="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${r.agClass}"><i class="fas fa-graduation-cap"></i>${escHtml(r.agName)}</span>` : ''}
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-center">${escHtml(r.className)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-center">${escHtml(r.sectionName)}</td>
                <td class="px-3 py-2 text-right">${r.taskScore.toFixed(2)}</td>
                <td class="px-3 py-2 text-right">${r.teamScore.toFixed(2)}</td>
                <td class="px-3 py-2 text-right">${r.additional.toFixed(2)}</td>
                <td class="px-3 py-2 text-right">${r.mcq.toFixed(2)}</td>
                <td class="px-3 py-2 text-right font-semibold">${r.total.toFixed(2)}</td>
                <td class="px-3 py-2 text-right"><span class="inline-block rounded px-2 py-0.5 text-xs font-semibold ${pctCls}">${r.pct.toFixed(1)}%</span></td>
                <td class="px-3 py-2 text-center whitespace-nowrap">
                  ${(() => {
                     // Logic for Status in Group Member List
                     const topic = r.topic;
                     const isProblematic = (topic === 'topic_understood' || topic === 'topic_none');
                     
                     if (isProblematic) {
                        return r.problemRecovered 
                            ? `<span class="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"><i class="fas fa-check-circle text-[10px]"></i> প্রবলেম রিজলভড</span>`
                            : `<span class="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"><i class="fas fa-exclamation-circle text-[10px]"></i> সমস্যা আছে</span>`;
                     }
                     
                     if (topic === 'topic_learned_well' && r.problemRecovered) {
                         return `<span class="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"><i class="fas fa-check-circle text-[10px]"></i> প্রবলেম রিজলভড</span>`;
                     }

                     return '-';
                  })()}
                </td>
                <td class="px-3 py-2 comments-cell">${escHtml(shortC)}</td>`;
              frag2.appendChild(tr);
            });

            tbody.innerHTML = '';
            tbody.appendChild(frag2);
          };

          renderAssignTable(0);
          sel.onchange = (e) => {
            const i = parseInt(e.target.value, 10) || 0;
            renderAssignTable(i);
          };
        }
      } catch {}

      // Evaluations list (latest first)
      const ebody = byId('gdmEvalsBody');
      if (ebody) {
        ebody.innerHTML = '';
        const sorted = perEval.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
        const frag = document.createDocumentFragment();
        const studentMap = new Map(state.students.map((s) => [String(s?.id), s?.name || s?.id]));

        sorted.forEach((e, idx) => {
          const tr = document.createElement('tr');
          const dateStr = e.ts ? new Date(e.ts).toISOString().slice(0, 10) : '-';
          const topName = e.topStudentId ? (studentMap.get(String(e.topStudentId)) || e.topStudentId) : '-';
          tr.innerHTML = `
            <td class="px-3 py-2 whitespace-nowrap">${escHtml(e.task?.name || `Assignment-${idx + 1}`)}</td>
            <td class="px-3 py-2 whitespace-nowrap">${dateStr}</td>
            <td class="px-3 py-2">${e.count}</td>
            <td class="px-3 py-2">${e.avgPct.toFixed(1)}%</td>
            <td class="px-3 py-2 whitespace-nowrap">${escHtml(topName)}</td>`;
          frag.appendChild(tr);
        });
        ebody.appendChild(frag);
      }

      // Show modal default view
      UI.els.modal?.classList.remove('hidden');
      setMode('members');
    } catch (err) {
      console.error('[GDM] renderGroupModal failed:', err);
    }
  }

  // ---------- mode toggle ----------
  function setMode(mode) {
    const showMembers = mode === 'members';
    UI.els.members?.classList.toggle('hidden', !showMembers);
    UI.els.evals?.classList.toggle('hidden', showMembers);
    UI.els.btnMembers?.classList.toggle('bg-gray-100', showMembers);
    UI.els.btnEvals?.classList.toggle('bg-gray-100', !showMembers);
  }

  // ---------- bindings ----------
  function bindOnce() {
    if (UI.bound) return;
    UI.bound = true;

    // close by data attr
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-group-modal-close]')) {
        UI.els.modal?.classList.add('hidden');
      }
    });

    UI.els.btnMembers?.addEventListener('click', () => setMode('members'));
    UI.els.btnEvals?.addEventListener('click', () => setMode('evals'));

    UI.els.btnPrint?.addEventListener('click', () => {
      const app = window.smartEvaluator;
      if (!app?.components?.analysis?.generateGroupWiseFullDetailsPDF) {
        console.warn('PDF generator not found');
        return;
      }
      
      const groupId = UI.state.currentGroupId;
      if (!groupId) return;

      // Get selected assignment ID if in members mode and assignment is selected
      let filterTaskId = 'all';
      const sel = UI.els.assignSelect; // We need to cache this or query it
      if (sel && sel.value) {
         // The value is the index in the 'assigns' array. We need to reconstruct the logic or store the task ID.
         // Wait, the select value is the index. We need to get the task ID from the 'perEval' list.
         // Since we don't have easy access to 'perEval' here without re-computing, let's re-compute or just print 'all' for now.
         // Actually, the user might want to print what they see.
         // But 'generateGroupWiseFullDetailsPDF' takes a taskId.
         // Let's try to get the taskId from the selected option or state.
         // Re-computing is safer.
         const state = getState();
         const { perEval } = computeGroupPerformance(groupId, state);
         const assigns = perEval.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
         const idx = parseInt(sel.value, 10) || 0;
         const selectedEval = assigns[idx];
         if (selectedEval && selectedEval.task) {
           filterTaskId = selectedEval.task.id;
         }
      }

      app.managers.uiManager.showToast('PDF তৈরি হচ্ছে...', 'info');
      const { groups, students, tasks, evaluations } = getState();
      app.components.analysis.generateGroupWiseFullDetailsPDF(filterTaskId, groupId);
    });
  }

  // ---------- init ----------
  function init() {
    UI.els.modal     = byId('groupDetailModal');
    UI.els.btnMembers= byId('gdmBtnMembers');
    UI.els.btnEvals  = byId('gdmBtnEvals');
    UI.els.btnPrint  = byId('gdmBtnPrint');
    UI.els.members   = byId('gdmMembersWrap');
    UI.els.evals     = byId('gdmEvalsWrap');
    UI.els.assignSelect = byId('gdmAssignSelect');

    if (!UI.els.modal) {
      console.warn('[GDM] modal node missing; script loaded but no #groupDetailModal.');
      return;
    }

    bindOnce();

    // public API (one-time)
    if (!window.openGroupModalById) window.openGroupModalById = renderGroupModal;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();




