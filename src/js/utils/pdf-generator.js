/**
 * Generates a PDF by opening the browser's print dialog for the given HTML content.
 * This ensures perfect rendering of Bengali text by leveraging the browser's native engine.
 * 
 * @param {string} htmlContent - The HTML content to render.
 */
async function _printHTML(htmlContent) {
  // 1. Create a hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  // 2. Write content to the iframe
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8">
      <title>Report</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { 
          font-family: 'Noto Sans Bengali', sans-serif; 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact;
        }
        @media print {
          @page { margin: 5mm; size: A4; }
          body { -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body class="bg-white text-gray-900 p-4">
      ${htmlContent}
      <script>
        // Wait for fonts and styles to load before printing
        window.onload = () => {
          setTimeout(() => {
            window.print();
            window.onafterprint = () => {
              // Optional: Notify parent window
            };
          }, 1000); // Small delay to ensure rendering
        };
      </script>
    </body>
    </html>
  `);
  doc.close();

  // 3. Cleanup logic (optional, but good practice to remove iframe after use)
  // Note: Removing immediately might cancel the print dialog in some browsers.
  // We'll leave it or remove it on a timeout/event if needed. 
  // For now, let's keep it simple.
  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 60000); // Remove after 1 minute to allow time for printing
}

/**
 * Generates "Group-based Analysis Data Report PDF"
 */
export async function generateGroupAnalysisPDF(data, uiManager) {
  const date = new Date().toLocaleDateString('bn-BD');
  
  const rows = data.map((item, index) => `
    <tr class="border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
      <td class="py-2 px-3 text-left">${item.groupName}</td>
      <td class="py-2 px-3 text-center">${_bn(item.studentCount)}</td>
      <td class="py-2 px-3 text-center">${_bn(item.evaluationCount)}</td>
      <td class="py-2 px-3 text-center">${_bn(item.averageScore)}%</td>
      <td class="py-2 px-3 text-center">${_bn(item.participationRate)}%</td>
    </tr>
  `).join('');

  const html = `
    <div class="font-bengali">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-blue-700 mb-2">স্মার্ট গ্রুপ ইভালুয়েটর</h1>
        <h2 class="text-xl font-semibold text-gray-700">গ্রুপ ভিত্তিক বিশ্লেষণ রিপোর্ট</h2>
        <p class="text-sm text-gray-500 mt-1">তারিখ: ${date}</p>
      </div>
      
      <table class="w-full border-collapse border border-gray-300 text-sm">
        <thead>
          <tr class="bg-blue-600 text-white">
            <th class="py-2 px-3 text-left font-semibold">গ্রুপের নাম</th>
            <th class="py-2 px-3 text-center font-semibold">সদস্য</th>
            <th class="py-2 px-3 text-center font-semibold">মূল্যায়ন</th>
            <th class="py-2 px-3 text-center font-semibold">গড় স্কোর</th>
            <th class="py-2 px-3 text-center font-semibold">অংশগ্রহণ</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      
      <div class="mt-8 text-xs text-gray-400 text-center border-t pt-2">
        রিপোর্ট জেনারেটেড বাই স্মার্ট গ্রুপ ইভালুয়েটর সিস্টেম
      </div>
    </div>
  `;

  await _printHTML(html);
  uiManager.showToast('প্রিন্ট ডায়ালগ ওপেন হচ্ছে...', 'info');
}

/**
 * Generates "All Students Data Report PDF"
 */
export async function generateAllStudentsPDF(students, groupsMap, uiManager, classesMap, sectionsMap) {
  const date = new Date().toLocaleDateString('bn-BD');
  
  const rows = students.map((s, index) => `
    <tr class="border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
      <td class="py-2 px-2 text-center">${_bn(s.roll)}</td>
      <td class="py-2 px-2 text-left font-medium">${s.name}</td>
      <td class="py-2 px-2 text-center">${classesMap?.get(s.classId)?.name || '-'}</td>
      <td class="py-2 px-2 text-center">${sectionsMap?.get(s.sectionId)?.name || '-'}</td>
      <td class="py-2 px-2 text-left">${groupsMap.get(s.groupId) || '-'}</td>
      <td class="py-2 px-2 text-center">${s.academicGroup || '-'}</td>
      <td class="py-2 px-2 text-center">${s.gender || '-'}</td>
      <td class="py-2 px-2 text-center">${s.contact || '-'}</td>
    </tr>
  `).join('');

  const html = `
    <div class="font-bengali">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-indigo-700 mb-2">স্মার্ট গ্রুপ ইভালুয়েটর</h1>
        <h2 class="text-xl font-semibold text-gray-700">সকল শিক্ষার্থীর তালিকা</h2>
        <p class="text-sm text-gray-500 mt-1">মোট শিক্ষার্থী: ${_bn(students.length)} জন | তারিখ: ${date}</p>
      </div>
      
      <table class="w-full border-collapse border border-gray-300 text-xs">
        <thead>
          <tr class="bg-indigo-600 text-white">
            <th class="py-2 px-2 text-center font-semibold w-16">রোল</th>
            <th class="py-2 px-2 text-left font-semibold">নাম</th>
            <th class="py-2 px-2 text-center font-semibold">ক্লাস</th>
            <th class="py-2 px-2 text-center font-semibold">শাখা</th>
            <th class="py-2 px-2 text-left font-semibold">গ্রুপ</th>
            <th class="py-2 px-2 text-center font-semibold">বিভাগ</th>
            <th class="py-2 px-2 text-center font-semibold">লিঙ্গ</th>
            <th class="py-2 px-2 text-center font-semibold">মোবাইল</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      
      <div class="mt-8 text-xs text-gray-400 text-center border-t pt-2">
        রিপোর্ট জেনারেটেড বাই স্মার্ট গ্রুপ ইভালুয়েটর সিস্টেম
      </div>
    </div>
  `;

  await _printHTML(html);
  uiManager.showToast('প্রিন্ট ডায়ালগ ওপেন হচ্ছে...', 'info');
}

/**
 * Generates "All Groups Student Detailed Data Group-wise Download PDF"
 */
export async function generateGroupWiseStudentsPDF(groups, students, uiManager, classesMap, sectionsMap) {
  const date = new Date().toLocaleDateString('bn-BD');
  
  let contentHtml = '';
  
  groups.forEach(group => {
    const groupStudents = students.filter(s => s.groupId === group.id);
    if (groupStudents.length === 0) return;

    const rows = groupStudents.map((s, index) => `
      <tr class="border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
        <td class="py-1 px-2 text-center">${_bn(s.roll)}</td>
        <td class="py-1 px-2 text-left">${s.name}</td>
        <td class="py-1 px-2 text-center">${classesMap?.get(s.classId)?.name || '-'}</td>
        <td class="py-1 px-2 text-center">${sectionsMap?.get(s.sectionId)?.name || '-'}</td>
        <td class="py-1 px-2 text-center">${s.role || '-'}</td>
        <td class="py-1 px-2 text-center">${s.contact || '-'}</td>
      </tr>
    `).join('');

    contentHtml += `
      <div class="mb-8 break-inside-avoid">
        <h3 class="text-lg font-bold text-purple-700 mb-2 border-b-2 border-purple-200 pb-1">
          ${group.name} <span class="text-sm font-normal text-gray-500 ml-2">(${_bn(groupStudents.length)} জন)</span>
        </h3>
        <table class="w-full border-collapse border border-gray-200 text-xs">
          <thead>
            <tr class="bg-purple-100 text-purple-900">
              <th class="py-1 px-2 text-center w-16">রোল</th>
              <th class="py-1 px-2 text-left">নাম</th>
              <th class="py-1 px-2 text-center">ক্লাস</th>
              <th class="py-1 px-2 text-center">শাখা</th>
              <th class="py-1 px-2 text-center">দায়িত্ব</th>
              <th class="py-1 px-2 text-center">মোবাইল</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  });

  const html = `
    <div class="font-bengali">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-purple-700 mb-2">স্মার্ট গ্রুপ ইভালুয়েটর</h1>
        <h2 class="text-xl font-semibold text-gray-700">গ্রুপ ভিত্তিক বিস্তারিত তালিকা</h2>
        <p class="text-sm text-gray-500 mt-1">তারিখ: ${date}</p>
      </div>
      
      <div class="space-y-4">
        ${contentHtml}
      </div>
      
      <div class="mt-8 text-xs text-gray-400 text-center border-t pt-2">
        রিপোর্ট জেনারেটেড বাই স্মার্ট গ্রুপ ইভালুয়েটর সিস্টেম
      </div>
    </div>
  `;

  await _printHTML(html);
  uiManager.showToast('প্রিন্ট ডায়ালগ ওপেন হচ্ছে...', 'info');
}

// Helper to convert numbers to Bangla
function _bn(num) {
  if (num === undefined || num === null) return '-';
  const en = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).split('').map(c => {
    const index = en.indexOf(c);
    return index > -1 ? bn[index] : c;
  }).join('');
}

// --- Helpers for Result Reports ---

function _extractTs(d) {
  if (!d) return 0;
  if (typeof d === 'object' && d.seconds) return d.seconds * 1000;
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : 0;
}

function _prettyRoleBn(role) {
  return ({
    'team-leader': 'টিম লিডার',
    'time-keeper': 'টাইম কিপার',
    reporter: 'রিপোর্টার',
    'resource-manager': 'রিসোর্স ম্যানেজার',
    'peace-maker': 'পিস মেকার',
  }[String(role || '').trim()] || (role ? String(role) : ''));
}

function _roleBadgeClass(role) {
  return ({
    'team-leader': 'bg-amber-50 text-amber-700 border-amber-200',
    'time-keeper': 'bg-sky-50 text-sky-700 border-sky-200',
    reporter: 'bg-purple-50 text-purple-700 border-purple-200',
    'resource-manager': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'peace-maker': 'bg-rose-50 text-rose-700 border-rose-200',
  }[String(role || '').trim()] || 'bg-gray-50 text-gray-700 border-gray-200');
}

const ACAD_PALETTE = [
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  'bg-lime-50 text-lime-700 border-lime-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
];

function _acadBadgeClass(label) {
  const s = String(label || '').trim();
  if (!s) return 'bg-gray-50 text-gray-700 border-gray-200';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  return ACAD_PALETTE[h % ACAD_PALETTE.length];
}

function _pctBadgeClass(p) {
  const v = Number(p) || 0;
  if (v >= 85) return 'bg-emerald-50 text-emerald-700';
  if (v >= 70) return 'bg-sky-50 text-sky-700';
  if (v >= 55) return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
}

function _computeGroupPerformance(groupId, groups, students, tasks, evaluations) {
  const taskMap = new Map(tasks.map((t) => [t?.id, t]));
  const members = students.filter((s) => String(s?.groupId) === String(groupId));
  const memberIds = new Set(members.map((m) => String(m?.id)));
  const evals = evaluations.filter((ev) => String(ev?.groupId) === String(groupId));

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
    const ts = _extractTs(ev?.taskDate || ev?.updatedAt || ev?.evaluationDate || ev?.createdAt || task?.date);
    return { ev, task, ts, avgPct: cnt ? (sumPct / cnt) : 0, count: cnt, topStudentId: bestId, topPct: bestPct };
  });

  const groupAvg = perEval.length ? perEval.reduce((a, b) => a + b.avgPct, 0) / perEval.length : 0;

  // rank among all groups by their average %
  const other = groups.map((g) => {
    const gid = String(g?.id);
    const evs = evaluations.filter((ev) => String(ev?.groupId) === gid);
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

function _generateGroupHTML(group, students, tasks, evaluations) {
  const { perEval, groupAvg, rank } = _computeGroupPerformance(group.id, groups, students, tasks, evaluations);
  // Actually, _computeGroupPerformance needs ALL groups to calculate rank properly.
  // Let's adjust _computeGroupPerformance to accept all groups, but we are calling it inside a loop in generateAllGroupsResultPDF.
  // To avoid re-calculating rank every time, we could optimize, but for PDF generation (client-side), it's okay.
  // Wait, I need to pass ALL groups to _computeGroupPerformance.
  
  // Refactored to pass all groups in the main function call.
  return ''; // Placeholder, logic moved to main functions
}

/**
 * Generates "All Groups Result PDF"
 * Iterates through all groups and creates a detailed report for each.
 */
export async function generateAllGroupsResultPDF(groups, students, tasks, evaluations, uiManager) {
  const date = new Date().toLocaleDateString('bn-BD');
  let contentHtml = '';

  // Sort groups by name
  const sortedGroups = [...groups].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'bn'));

  for (const group of sortedGroups) {
    const { perEval, groupAvg, rank } = _computeGroupPerformance(group.id, groups, students, tasks, evaluations);
    
    // Header Stats
    const statsHtml = `
      <div class="grid grid-cols-4 gap-3 mb-6">
        <div class="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div class="text-indigo-600"><i class="fa-solid fa-layer-group text-xl"></i></div>
          <div><div class="text-xs text-gray-500">Group</div><div class="text-sm font-semibold">${group.name}</div></div>
        </div>
        <div class="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div class="text-emerald-600"><i class="fa-solid fa-chart-line text-xl"></i></div>
          <div><div class="text-xs text-gray-500">Average %</div><div class="text-sm font-semibold">${groupAvg.toFixed(2)}%</div></div>
        </div>
        <div class="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div class="text-amber-600"><i class="fa-solid fa-crown text-xl"></i></div>
          <div><div class="text-xs text-gray-500">Rank</div><div class="text-sm font-semibold">${rank ? _bn(rank) : '-'}</div></div>
        </div>
        <div class="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div class="text-sky-600"><i class="fa-solid fa-percent text-xl"></i></div>
          <div><div class="text-xs text-gray-500">Evaluations</div><div class="text-sm font-semibold">${_bn(perEval.length)}</div></div>
        </div>
      </div>
    `;

    // Evaluations Table
    const sortedEvals = perEval.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const evalsRows = sortedEvals.map((e, idx) => `
      <tr class="border-b border-gray-100">
        <td class="px-3 py-2">${e.task?.name || 'Assignment-' + (idx + 1)}</td>
        <td class="px-3 py-2">${e.ts ? new Date(e.ts).toLocaleDateString('bn-BD') : '-'}</td>
        <td class="px-3 py-2 text-center">${_bn(e.count)}</td>
        <td class="px-3 py-2 text-center">${e.avgPct.toFixed(2)}%</td>
      </tr>
    `).join('');

    const evalsTable = `
      <h4 class="text-sm font-bold text-gray-700 mb-2 uppercase">Evaluations Summary</h4>
      <table class="w-full border-collapse border border-gray-200 text-xs mb-6">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-3 py-2 text-left">Assignment</th>
            <th class="px-3 py-2 text-left">Date</th>
            <th class="px-3 py-2 text-center">Evaluated</th>
            <th class="px-3 py-2 text-center">Avg %</th>
          </tr>
        </thead>
        <tbody>${evalsRows}</tbody>
      </table>
    `;

    contentHtml += `
      <div class="break-after-page mb-8">
        <h2 class="text-xl font-bold text-indigo-800 mb-4 border-b-2 border-indigo-100 pb-2">${group.name}</h2>
        ${statsHtml}
        ${evalsTable}
      </div>
    `;
  }

  const html = `
    <div class="font-bengali">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-indigo-700">স্মার্ট গ্রুপ ইভালুয়েটর</h1>
        <h2 class="text-lg font-semibold text-gray-600">সকল গ্রুপ ফলাফল রিপোর্ট</h2>
        <p class="text-sm text-gray-500">তারিখ: ${date}</p>
      </div>
      ${contentHtml}
    </div>
  `;

  await _printHTML(html);
  uiManager.showToast('প্রিন্ট ডায়ালগ ওপেন হচ্ছে...', 'info');
}

/**
 * Generates "Assignment Result PDF"
 * Filters by assignment and shows detailed breakdown for each group for that assignment.
 */
export async function generateAssignmentResultPDF(assignmentIndex, groups, students, tasks, evaluations, uiManager, classesMap, sectionsMap) {
  const date = new Date().toLocaleDateString('bn-BD');
  let contentHtml = '';
  
  // Find the task/assignment based on index (logic similar to modal selector)
  // But wait, the selector in modal is per-group. Here we want a global selector.
  // We need to know WHICH assignment the user selected.
  // The UI passes 'assignmentIndex' which might be an index in a sorted list of ALL assignments.
  // Let's assume the UI passes the Task ID or we derive it.
  // For simplicity, let's assume the UI passes the Task ID.
  
  const taskId = String(assignmentIndex); 
  const task = tasks.find(t => String(t.id) === taskId);
  const taskName = task ? task.name : 'Unknown Assignment';

  // Sort groups
  const sortedGroups = [...groups].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'bn'));

  for (const group of sortedGroups) {
    // Get evaluation for this group and task
    const ev = evaluations.find(e => String(e.groupId) === String(group.id) && String(e.taskId) === taskId);
    
    if (!ev) continue; // Skip groups that didn't participate

    const max = parseFloat(ev.maxPossibleScore) || parseFloat(task?.maxScore) || 100;
    const scores = ev.scores || {};
    
    // Calculate group stats for this assignment
    let totalScore = 0;
    let studentCount = 0;
    const groupAvg = max > 0 ? ((totalScore / studentCount) / max) * 100 : 0;

    const rowsHtml = studentRows.map(r => `
      <tr class="border-b border-gray-100">
        <td class="px-2 py-1 text-center">${_bn(r.roll)}</td>
        <td class="px-2 py-1 font-medium">${r.name}</td>
        <td class="px-2 py-1 text-center text-xs">${classesMap?.get(r.classId)?.name || '-'}</td>
        <td class="px-2 py-1 text-center text-xs">${sectionsMap?.get(r.sectionId)?.name || '-'}</td>
        <td class="px-2 py-1 text-xs text-gray-500">${_prettyRoleBn(r.role)}</td>
        <td class="px-2 py-1 text-right font-bold">${r.total.toFixed(2)}</td>
        <td class="px-2 py-1 text-right"><span class="px-1 py-0.5 rounded text-xs ${_pctBadgeClass(r.pct)}">${r.pct.toFixed(1)}%</span></td>
        <td class="px-2 py-1 text-center">
             ${(() => {
                // Logic for Status
                const topic = r.topic;
                const isProblematic = (topic === 'topic_understood' || topic === 'topic_none');
                
                if (isProblematic) {
                    return r.problemRecovered 
                        ? '<span class="text-[9px] text-green-600 font-bold whitespace-nowrap">Problem Resolved</span>' 
                        : '<span class="text-[9px] text-red-600 font-bold whitespace-nowrap">Have a problem</span>';
                }
                
                if (topic === 'topic_learned_well' && r.problemRecovered) {
                    return '<span class="text-[9px] text-green-600 font-bold whitespace-nowrap">Problem Resolved</span>';
                }

                return '-';
             })()}
        </td>
      </tr>
    `).join('');

    contentHtml += `
      <div class="mb-8 break-inside-avoid">
        <div class="flex items-center justify-between mb-2 border-b border-gray-200 pb-1">
          <h3 class="text-lg font-bold text-indigo-700">${group.name}</h3>
          <div class="text-sm text-gray-600">Avg: <span class="font-bold">${groupAvg.toFixed(2)}%</span></div>
        </div>
        <table class="w-full border-collapse border border-gray-200 text-xs">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-2 py-1 text-center w-12">Roll</th>
              <th class="px-2 py-1 text-left">Name</th>
              <th class="px-2 py-1 text-center">Class</th>
              <th class="px-2 py-1 text-center">Section</th>
              <th class="px-2 py-1 text-left">Role</th>
              <th class="px-2 py-1 text-right">Total</th>
              <th class="px-2 py-1 text-right">%</th>
              <th class="px-2 py-1 text-center">Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  const html = `
    <div class="font-bengali">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-indigo-700">স্মার্ট গ্রুপ ইভালুয়েটর</h1>
        <h2 class="text-lg font-semibold text-gray-600">অ্যাসাইনমেন্ট রিপোর্ট:</h2>
        <h2 class="text-lg font-semibold text-gray-600">${taskName}</h2>
        <p class="text-sm text-gray-500">তারিখ: ${date}</p>
      </div>
      <div class="space-y-6">
        ${contentHtml || '<p class="text-center text-gray-500">এই অ্যাসাইনমেন্টের জন্য কোনো ফলাফল পাওয়া যায়নি।</p>'}
      </div>
    </div>
  `;

  await _printHTML(html);
  uiManager.showToast('প্রিন্ট ডায়ালগ ওপেন হচ্ছে...', 'info');
}
/**
 * Generates "Group Wise Full Details Result PDF"
 * Professional report with detailed metrics for every student in every group.
 */
export async function generateGroupWiseFullDetailsPDF(groups, students, tasks, evaluations, uiManager, filterTaskId = 'all', filterGroupId = null, classesMap, sectionsMap) {
  const date = new Date().toLocaleDateString('bn-BD');
  let contentHtml = '';

  // Sort groups by name
  let sortedGroups = [...groups].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'bn'));

  // Filter by group if specified
  if (filterGroupId) {
    sortedGroups = sortedGroups.filter(g => String(g.id) === String(filterGroupId));
  }

  // Determine if a specific task is selected
  const isSingleTask = filterTaskId !== 'all';
  const selectedTask = isSingleTask ? tasks.find(t => String(t.id) === String(filterTaskId)) : null;
  // For single task, we don't need a text title as we have the pill. For all tasks, we need the title.
  const reportTitle = isSingleTask ? '' : 'গ্রুপ ভিত্তিক বিস্তারিত ফলাফল রিপোর্ট';
  const reportDate = isSingleTask && selectedTask?.date ? new Date(selectedTask.date).toLocaleDateString('bn-BD') : date;

  // Pre-calculate student scores based on filter
  const studentScoresMap = new Map();
  students.forEach(s => {
    studentScoresMap.set(s.id, {
      totalScore: 0,
      maxPossible: 0,
      evalCount: 0,
      taskScore: 0,
      teamScore: 0,
      ProgressScore: 0,
      mcqScore: 0,
      comment: '',
      problemRecovered: false,
      topic: null
    });
  });

  evaluations.forEach(ev => {
    // Filter by task if needed
    if (isSingleTask && String(ev.taskId) !== String(filterTaskId)) return;

    const task = tasks.find(t => String(t.id) === String(ev.taskId));
    const max = parseFloat(ev.maxPossibleScore) || parseFloat(task?.maxScore) || 100;
    
    if (ev.scores) {
      Object.entries(ev.scores).forEach(([sid, sc]) => {
        const data = studentScoresMap.get(sid);
        if (data) {
          const total = parseFloat(sc.totalScore) || 0;
          data.totalScore += total;
          data.maxPossible += max;
          data.evalCount++;
          
          // Accumulate detailed scores
          data.taskScore += parseFloat(sc.taskScore) || 0;
          data.teamScore += parseFloat(sc.teamScore) || 0;
          data.ProgressScore += parseFloat(sc.ProgressScore) || 0;
          data.mcqScore += parseFloat(sc.mcqScore) || 0;
          
          // For single task, keep the comment and problem recovered status
          if (isSingleTask) {
            data.comment = sc.comments || '';
            data.problemRecovered = sc.problemRecovered || false;
            data.topic = sc.ProgressCriteria?.topic || null;
          }
        }
      });
    }
  });

  for (const group of sortedGroups) {
    const groupStudents = students.filter(s => s.groupId === group.id);
    if (groupStudents.length === 0) continue;

    // Calculate group aggregate stats
    let groupTotalPct = 0;
    let groupActiveStudents = 0;

    const studentRows = groupStudents.map(s => {
      const stats = studentScoresMap.get(s.id);
      
      // For single task, maxPossible is just that task's max.
      // For all tasks, it's sum of all maxes.
      const avgPct = stats.maxPossible > 0 ? (stats.totalScore / stats.maxPossible) * 100 : 0;
      
      if (stats.evalCount > 0) {
        groupTotalPct += avgPct;
        groupActiveStudents++;
      }

      // Prepare display values (average for 'all', actual for 'single')
      const divisor = isSingleTask ? 1 : (stats.evalCount || 1);
      const displayStats = {
        task: (stats.taskScore / divisor).toFixed(1),
        team: (stats.teamScore / divisor).toFixed(1),
        add: (stats.ProgressScore / divisor).toFixed(1),
        mcq: (stats.mcqScore / divisor).toFixed(1),
        total: stats.totalScore.toFixed(1),
        max: stats.maxPossible
      };

      const participationRate = stats.evalCount > 0 ? 100 : 0; // Or calculate based on total tasks if needed
      const participationClass = participationRate >= 80 ? 'text-emerald-600' : participationRate >= 50 ? 'text-amber-600' : 'text-rose-600';

      return {
        ...s,
        stats,
        displayStats,
        avgPct,
        participationRate,
        participationClass
      };
    }).sort((a, b) => b.avgPct - a.avgPct); // Sort by performance

    const groupAvg = groupActiveStudents > 0 ? groupTotalPct / groupActiveStudents : 0;

    const rowsHtml = studentRows.map((s, idx) => `
      <tr class="border-b border-gray-100 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-indigo-50 transition-colors">
        <td class="px-2 py-2 text-center border-r border-gray-100">${_bn(s.roll)}</td>
        <td class="px-3 py-2 font-medium border-r border-gray-100">
          ${s.name}
          <div class="text-[10px] text-gray-500">${s.academicGroup || ''}</div>
        </td>
        <td class="px-2 py-2 text-center border-r border-gray-100 text-xs">${classesMap?.get(s.classId)?.name || '-'}</td>
        <td class="px-2 py-2 text-center border-r border-gray-100 text-xs">${sectionsMap?.get(s.sectionId)?.name || '-'}</td>
        <td class="px-2 py-2 text-center border-r border-gray-100 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-full text-[10px] border ${_roleBadgeClass(s.role)}">
            ${_prettyRoleBn(s.role) || 'সদস্য'}
          </span>
        </td>
        <td class="px-2 py-2 text-center border-r border-gray-100 font-bold text-gray-700">
             ${_bn(s.stats.evalCount > 0 ? 1 : 0)}
        </td>
        ${!isSingleTask ? `<td class="px-2 py-2 text-center border-r border-gray-100">${_bn(s.stats.evalCount)}</td>` : ''}
        <td class="px-2 py-2 text-center text-gray-600 border-r border-gray-100">${s.displayStats.task}</td>
        <td class="px-2 py-2 text-center text-gray-600 border-r border-gray-100">${s.displayStats.team}</td>
        <td class="px-2 py-2 text-center text-gray-600 border-r border-gray-100">${s.displayStats.add}</td>
        <td class="px-2 py-2 text-center text-gray-600 border-r border-gray-100">${s.displayStats.mcq}</td>
        <td class="px-2 py-2 text-right font-mono text-gray-800 font-bold border-r border-gray-100">${s.displayStats.total} / ${s.displayStats.max}</td>
        <td class="px-2 py-2 text-right border-r border-gray-100">
          <span class="font-bold ${_pctBadgeClass(s.avgPct)} px-1.5 py-0.5 rounded">
            ${s.avgPct.toFixed(1)}%
          </span>
        </td>
        <td class="px-2 py-2 text-center border-r border-gray-100">
          ${(() => {
             // Logic for Status
             if (isSingleTask) {
                const topic = s.stats.topic;
                const isProblematic = (topic === 'topic_understood' || topic === 'topic_none');
                
                if (isProblematic) {
                    return s.stats.problemRecovered 
                        ? '<span class="text-[9px] text-green-600 font-bold whitespace-nowrap">Problem Resolved</span>' 
                        : '<span class="text-[9px] text-red-600 font-bold whitespace-nowrap">Have a problem</span>';
                }
                
                if (topic === 'topic_learned_well' && s.stats.problemRecovered) {
                    return '<span class="text-[9px] text-green-600 font-bold whitespace-nowrap">Problem Resolved</span>';
                }
             }
             return '-';
          })()}
        </td>
      </tr>
    `).join('');

    // Assignment Header for each group (if single task)
    const groupAssignmentHeader = isSingleTask ? `
      <div class="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex justify-between items-center text-xs text-indigo-800">
        <div class="font-semibold"><i class="fas fa-file-alt mr-1"></i> ${selectedTask?.name || ''}</div>
        <div><i class="far fa-calendar-alt mr-1"></i> ${reportDate}</div>
      </div>
    ` : '';

    contentHtml += `
      <div class="break-inside-avoid mb-8 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div class="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 p-4 flex justify-between items-center">
          <div>
            <h3 class="text-lg font-bold text-gray-800 flex items-center gap-2">
              <i class="fas fa-layer-group text-indigo-500"></i> ${group.name}
            </h3>
            <p class="text-xs text-gray-500 mt-1">সদস্য: ${_bn(groupStudents.length)} জন</p>
          </div>
          <div class="text-right">
            <div class="text-xs text-gray-500">গ্রুপ গড়</div>
            <div class="text-xl font-bold text-indigo-600">${groupAvg.toFixed(1)}%</div>
          </div>
        </div>
        
        ${groupAssignmentHeader}

        <table class="w-full text-xs table-fixed border-collapse">
          <thead class="bg-indigo-600 text-white uppercase tracking-wider text-[10px]">
            <tr>
              <th class="px-2 py-3 text-center font-bold w-[6%] border-r border-indigo-500/30">রোল</th>
              <th class="px-3 py-3 text-left font-bold w-[20%] border-r border-indigo-500/30">নাম</th>
              <th class="px-2 py-3 text-center font-bold w-[8%] border-r border-indigo-500/30">ক্লাস</th>
              <th class="px-2 py-3 text-center font-bold w-[8%] border-r border-indigo-500/30">শাখা</th>
              <th class="px-2 py-3 text-center font-bold w-[12%] border-r border-indigo-500/30 whitespace-nowrap">দায়িত্ব</th>
              <th class="px-2 py-3 text-center font-bold w-[8%] border-r border-indigo-500/30">অংশগ্রহণ</th>
              ${!isSingleTask ? '<th class="px-2 py-3 text-center font-bold w-[8%] border-r border-indigo-500/30">মূল্যায়ন</th>' : ''}
              <th class="px-2 py-3 text-center font-bold w-[8%] border-r border-indigo-500/30">টাস্ক</th>
              <th class="px-2 py-3 text-center font-bold w-[8%] border-r border-indigo-500/30">টিম</th>
              <th class="px-2 py-3 text-center font-bold w-[8%] border-r border-indigo-500/30">অগ্রগতি</th>
              <th class="px-2 py-3 text-center font-bold w-[8%] border-r border-indigo-500/30">MCQ</th>
              <th class="px-2 py-3 text-right font-bold w-[9%] border-r border-indigo-500/30">মোট</th>
              <th class="px-2 py-3 text-right font-bold w-[9%] border-r border-indigo-500/30">গড় %</th>
              <th class="px-2 py-3 text-center font-bold w-[10%] border-r border-indigo-500/30">অবস্থা</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  const html = `
    <div class="font-bengali bg-white min-h-screen">
      <!-- Top Header Section -->
      <div class="flex justify-between items-end border-b-[3px] border-indigo-600 pb-4 mb-8">
        <div>
          <h1 class="text-4xl font-extrabold text-indigo-800 tracking-tight mb-1">স্মার্ট গ্রুপ ইভালুয়েটর</h1>
          <div class="flex items-center gap-2 text-sm text-gray-600 font-medium">
            <span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">অটোমেটেড রিপোর্ট</span>
            <span>|</span>
            <span>সেশন: ২০২৪-২৫</span>
          </div>
        </div>
        <div class="text-right">
          <div class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">রিপোর্ট জেনারেশন তারিখ</div>
          <div class="text-xl font-bold text-gray-800 font-mono bg-gray-50 px-3 py-1 rounded border border-gray-200 inline-block">
            ${new Date().toLocaleDateString('bn-BD')}
          </div>
        </div>
      </div>

      <!-- Report Title Card -->
      <div class="mb-10 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 p-6 shadow-sm text-center relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-purple-400"></div>
        
        ${reportTitle ? `<h2 class="text-2xl font-bold text-gray-800 mb-2">${reportTitle}</h2>` : ''}
        ${isSingleTask ? `<div class="inline-block bg-white border border-indigo-100 text-indigo-600 px-4 py-1 rounded-full text-sm font-semibold shadow-sm mb-4">${selectedTask?.name}</div>` : ''}
        
        <div class="flex justify-center flex-wrap gap-4 mt-2">
          <div class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
            <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600"><i class="fas fa-layer-group"></i></div>
            <div class="text-left">
              <div class="text-[10px] text-gray-400 uppercase font-bold">মোট গ্রুপ</div>
              <div class="text-sm font-bold text-gray-700">${_bn(sortedGroups.length)}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
            <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><i class="fas fa-users"></i></div>
            <div class="text-left">
              <div class="text-[10px] text-gray-400 uppercase font-bold">মোট শিক্ষার্থী</div>
              <div class="text-sm font-bold text-gray-700">${_bn(students.length)}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
             <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><i class="far fa-calendar-alt"></i></div>
             <div class="text-left">
               <div class="text-[10px] text-gray-400 uppercase font-bold">তারিখ</div>
               <div class="text-sm font-bold text-gray-700">${reportDate}</div>
             </div>
          </div>
        </div>

        <!-- Developer Info -->
        <div class="mt-6 pt-4 border-t border-indigo-50">
          <div class="inline-flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
            <i class="fas fa-code text-indigo-500 text-sm"></i>
            <span class="text-xs font-medium text-indigo-800">
              সফটওয়্যার নির্মাতা: <span class="font-bold">মোস্তফা রহমান স্যার</span>, সফটওয়্যার ইন্জিনিয়ার, তুরষ্ক (রিমোট জব) | কুয়েরি: <span class="font-mono font-bold">01840-643936</span>
            </span>
          </div>
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="space-y-8">
        ${contentHtml}
      </div>
      
      <!-- Footer -->
      <div class="mt-16 pt-8 border-t border-gray-200 flex justify-between items-end">
        <div class="text-xs text-gray-400">
          <p class="font-semibold text-gray-500 mb-1">স্মার্ট গ্রুপ ইভালুয়েটর সিস্টেম</p>
          <p>একটি অটোমেটেড পারফরম্যান্স অ্যানালাইসিস টুল</p>
        </div>
        <div class="text-right text-xs">
          <p class="text-gray-400 mb-1">ডেভেলাপড বাই</p>
          <p class="font-bold text-indigo-600 text-sm">মোঃ মোস্তফা রাহমান স্যার</p>
          <p class="text-[10px] text-gray-400 mt-0.5">© ${new Date().getFullYear()} স্মার্ট গ্রুপ ইভালুয়েটর সিস্টেম</p>
        </div>
      </div>
    </div>
  `;

  await _printHTML(html);
  uiManager.showToast('প্রিন্ট ডায়ালগ ওপেন হচ্ছে...', 'info');
}

/**
 * Generates "Single Group Analysis Dashboard PDF"
 * Replicates the dashboard view in a print-friendly format.
 */
export async function generateSingleGroupAnalysisPDF(groupData, uiManager, classesMap, sectionsMap) {
  const date = new Date().toLocaleDateString('bn-BD');
  const metric = groupData.metric || {};
  const groupName = metric.groupName || 'Group';
  const members = groupData.members || [];
  const evaluations = groupData.evaluations || [];

  // 1. Overview Cards
  const cardsHtml = `
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div class="text-xs text-blue-600 uppercase font-semibold">মোট মূল্যায়ন</div>
        <div class="text-2xl font-bold text-blue-800">${_bn(metric.evaluationCount)}</div>
      </div>
      <div class="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
        <div class="text-xs text-emerald-600 uppercase font-semibold">গড় মোট স্কোর</div>
        <div class="text-2xl font-bold text-emerald-800">${_bn(metric.averageScore)}%</div>
      </div>
      <div class="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
        <div class="text-xs text-indigo-600 uppercase font-semibold">অংশগ্রহণের হার</div>
        <div class="text-2xl font-bold text-indigo-800">${_bn(metric.participationRate)}%</div>
      </div>
      <div class="p-4 bg-amber-50 rounded-lg border border-amber-100">
        <div class="text-xs text-amber-600 uppercase font-semibold">লম্বিত শিক্ষার্থী</div>
        <div class="text-2xl font-bold text-amber-800">${_bn(metric.pendingStudents)}</div>
      </div>
    </div>
  `;

  // 2. Members Table
  const memberRows = members.map((m, idx) => `
    <tr class="border-b border-gray-100 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
      <td class="px-3 py-2 font-medium">
        ${m.name}
        <div class="text-[10px] text-gray-500">${m.academicGroup || ''}</div>
      </td>
      <td class="px-3 py-2 text-center">${_bn(m.roll)}</td>
      <td class="px-3 py-2 text-center text-xs">${classesMap?.get(m.classId)?.name || '-'}</td>
      <td class="px-3 py-2 text-center text-xs">${sectionsMap?.get(m.sectionId)?.name || '-'}</td>
      <td class="px-3 py-2 text-center text-xs">
        <span class="px-2 py-0.5 rounded-full border ${_roleBadgeClass(m.role)}">
          ${_prettyRoleBn(m.role)}
        </span>
      </td>
      <td class="px-3 py-2 text-center">${_bn(m.evaluationCount)}</td>
      <td class="px-3 py-2 text-center text-gray-600">${m.avgTaskScore ? m.avgTaskScore.toFixed(1) : '-'}</td>
      <td class="px-3 py-2 text-center text-gray-600">${m.avgTeamScore ? m.avgTeamScore.toFixed(1) : '-'}</td>
      <td class="px-3 py-2 text-center text-gray-600">${m.avgProgressScore ? m.avgProgressScore.toFixed(1) : '-'}</td>
      <td class="px-3 py-2 text-center text-gray-600">${m.avgMcqScore ? m.avgMcqScore.toFixed(1) : '-'}</td>
      <td class="px-3 py-2 text-center font-bold text-indigo-700">${m.avgTotalScore ? m.avgTotalScore.toFixed(1) : '-'}</td>
    </tr>
  `).join('');

  const membersHtml = `
    <div class="mb-8 break-inside-avoid">
      <h3 class="text-lg font-bold text-gray-800 mb-3 border-b pb-2">সদস্যদের সারাংশ</h3>
      <table class="w-full text-xs border border-gray-200">
        <thead class="bg-gray-100 text-gray-600 uppercase">
          <tr>
            <th class="px-3 py-2 text-left">নাম</th>
            <th class="px-3 py-2 text-center">রোল</th>
            <th class="px-3 py-2 text-center">ক্লাস</th>
            <th class="px-3 py-2 text-center">শাখা</th>
            <th class="px-3 py-2 text-center">দায়িত্ব</th>
            <th class="px-3 py-2 text-center">মূল্যায়ন</th>
            <th class="px-3 py-2 text-center">টাস্ক স্কোর</th>
            <th class="px-3 py-2 text-center">টিম স্কোর</th>
            <th class="px-3 py-2 text-center">অগ্রগতি স্কোর</th>
            <th class="px-3 py-2 text-center">MCQ স্কোর</th>
            <th class="px-3 py-2 text-center">গড় স্কোর</th>
          </tr>
        </thead>
        <tbody>${memberRows}</tbody>
      </table>
    </div>
  `;

  // 3. Evaluations History
  const evalRows = evaluations.map((e, idx) => `
    <tr class="border-b border-gray-100 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
      <td class="px-3 py-2 font-medium">${e.taskName}</td>
      <td class="px-3 py-2 text-center">${e.dateLabel}</td>
      <td class="px-3 py-2 text-center">${_bn(e.assessedCount)} / ${_bn(e.assessedCount + e.pendingCount)}</td>
      <td class="px-3 py-2 text-center">${e.avgTaskScore.toFixed(1)}</td>
      <td class="px-3 py-2 text-center font-bold text-indigo-700">
        ${e.averagePercentage.toFixed(1)}%
        ${e.problemRecovered ? '<div class="mt-1 text-[9px] text-red-600 font-semibold"><i class="fas fa-check-circle text-[8px]"></i> Problem Resolved</div>' : ''}
      </td>
    </tr>
  `).join('');

  const evalsHtml = `
    <div class="mb-8 break-inside-avoid">
      <h3 class="text-lg font-bold text-gray-800 mb-3 border-b pb-2">মূল্যায়ন ইতিহাস</h3>
      <table class="w-full text-xs border border-gray-200">
        <thead class="bg-gray-100 text-gray-600 uppercase">
          <tr>
            <th class="px-3 py-2 text-left">এসাইনমেন্ট</th>
            <th class="px-3 py-2 text-center">তারিখ</th>
            <th class="px-3 py-2 text-center">অংশগ্রহণ</th>
            <th class="px-3 py-2 text-center">গড় টাস্ক</th>
            <th class="px-3 py-2 text-center">গড় %</th>
          </tr>
        </thead>
        <tbody>${evalRows}</tbody>
      </table>
    </div>
  `;

  const html = `
    <div class="font-bengali">
      <div class="text-center mb-8 border-b-2 border-gray-100 pb-6">
        <h1 class="text-2xl font-bold text-indigo-700 mb-2">স্মার্ট গ্রুপ ইভালুয়েটর</h1>
        <h2 class="text-xl font-semibold text-gray-700">গ্রুপ বিশ্লেষণ ড্যাশবোর্ড: ${groupName}</h2>
        <div class="flex justify-center gap-4 mt-2 text-sm text-gray-500">
          <span>তারিখ: ${date}</span>
          <span>সদস্য: ${_bn(metric.studentCount)} জন</span>
        </div>
      </div>
      
      ${cardsHtml}
      ${membersHtml}
      ${evalsHtml}
      
      <div class="mt-8 text-xs text-gray-400 text-center border-t pt-2">
        রিপোর্ট জেনারেটেড বাই স্মার্ট গ্রুপ ইভালুয়েটর সিস্টেম
      </div>
    </div>
  `;

  await _printHTML(html);
  uiManager.showToast('প্রিন্ট ডায়ালগ ওপেন হচ্ছে...', 'info');
}

/**
 * Generates "Filtered Student List PDF"
 */
export async function generateStudentListPDF(students, activeFilters, evaluations, groupMap, extraMap, taskMap, classesMap, sectionsMap) {
  const date = new Date().toLocaleDateString('bn-BD');
  
  // Helper to get filter text
  const getFilterText = () => {
      const parts = [];
      if (activeFilters.group !== 'all') parts.push(`গ্রুপ: ${groupMap.get(activeFilters.group)?.name || activeFilters.group}`);
      if (activeFilters.academicGroup !== 'all') parts.push(`বিভাগ: ${activeFilters.academicGroup}`);
      if (activeFilters.session !== 'all') parts.push(`সেশন: ${activeFilters.session}`);
      if (activeFilters.gender !== 'all') parts.push(`লিঙ্গ: ${activeFilters.gender}`);
      if (activeFilters.role !== 'all') parts.push(`দায়িত্ব: ${activeFilters.role}`);
      // Assignment is handled separately in header title
      
      // Add Extra Filters
      if (activeFilters.extra && activeFilters.extra.length > 0) {
          const extraNames = activeFilters.extra.map(id => extraMap.get(id) || id).join(', ');
          parts.push(`অগ্রগতি: ${extraNames}`);
      }
      
      return parts.length > 0 ? parts.join(' | ') : 'সকল শিক্ষার্থী';
  };

  // Get Assignment Name
  let assignmentName = '';
  if (activeFilters.assignment !== 'all' && taskMap) {
      assignmentName = taskMap.get(activeFilters.assignment)?.name || '';
  }

  const rows = students.map((s, index) => {
      const groupName = groupMap.get(s.groupId)?.name || '-';
      
      // Calculate Scores
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
      const avgDisplay = studentEvaluations.length ? _bn(avg) : '-';
      
      let specificDisplay = '-';
      if (activeFilters.assignment !== 'all') {
          const assignEval = studentEvaluations.find(e => e.taskId === activeFilters.assignment);
          if (assignEval) {
              specificDisplay = _bn(assignEval.totalScore);
          }
      }

      return `
        <tr class="border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
          <td class="py-2 px-3 text-center text-gray-500">${_bn(index + 1)}</td>
          <td class="py-2 px-3 text-left">${s.name}</td>
          <td class="py-2 px-3 text-center">${_bn(s.roll)}</td>
          <td class="py-2 px-3 text-center">${classesMap?.get(s.classId)?.name || '-'}</td>
          <td class="py-2 px-3 text-center">${sectionsMap?.get(s.sectionId)?.name || '-'}</td>
          <td class="py-2 px-3 text-center">${s.gender || '-'}</td>
          <td class="py-2 px-3 text-center">${groupName}</td>
          <td class="py-2 px-3 text-center">${s.academicGroup || '-'}</td>
          <td class="py-2 px-3 text-center">${s.session || '-'}</td>
          <td class="py-2 px-3 text-center">${s.role === 'member' ? 'সদস্য' : (s.role || '-')}</td>
          <td class="py-2 px-3 text-center">${avgDisplay}</td>
          ${activeFilters.assignment !== 'all' ? `<td class="py-2 px-3 text-center font-bold">${specificDisplay}</td>` : ''}
        </tr>
      `;
  }).join('');

  const html = `
    <div class="font-bengali">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-blue-700 mb-2">স্মার্ট গ্রুপ ইভালুয়েটর</h1>
        <h2 class="text-xl font-semibold text-gray-700">শিক্ষার্থী তালিকা রিপোর্ট</h2>
        ${assignmentName ? `<h3 class="text-lg font-medium text-blue-600 mt-1">${assignmentName}</h3>` : ''}
        <div class="flex flex-col items-center gap-1 mt-2">
            <p class="text-sm text-gray-600 font-medium text-center px-4">${getFilterText()}</p>
            <p class="text-xs text-gray-500">তারিখ: ${date} | মোট শিক্ষার্থী: ${_bn(students.length)} জন</p>
        </div>
      </div>
      
      <table class="w-full border-collapse border border-gray-300 text-xs">
        <thead>
          <tr class="bg-gray-100 text-gray-700">
            <th class="py-2 px-3 text-center font-semibold border border-gray-300 w-12">#</th>
            <th class="py-2 px-3 text-left font-semibold border border-gray-300">নাম</th>
            <th class="py-2 px-3 text-center font-semibold border border-gray-300">রোল</th>
            <th class="py-2 px-3 text-center font-semibold border border-gray-300">ক্লাস</th>
            <th class="py-2 px-3 text-center font-semibold border border-gray-300">শাখা</th>
            <th class="py-2 px-3 text-center font-semibold border border-gray-300">লিঙ্গ</th>
            <th class="py-2 px-3 text-center font-semibold border border-gray-300">গ্রুপ</th>
            <th class="py-2 px-3 text-center font-semibold border border-gray-300">বিভাগ</th>
            <th class="py-2 px-3 text-center font-semibold border border-gray-300">সেশন</th>
            <th class="py-2 px-3 text-center font-semibold border border-gray-300">দায়িত্ব</th>
            <th class="py-2 px-3 text-center font-semibold border border-gray-300">গড় স্কোর</th>
            ${activeFilters.assignment !== 'all' ? `<th class="py-2 px-3 text-center font-semibold border border-gray-300">এসাইনমেন্ট</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      
      <div class="mt-8 text-xs text-gray-400 text-center border-t pt-2">
        রিপোর্ট জেনারেটেড বাই স্মার্ট গ্রুপ ইভালুয়েটর সিস্টেম
      </div>
    </div>
  `;

  await _printHTML(html);
}
