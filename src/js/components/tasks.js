// js/components/tasks.js

// Dependencies
let stateManager, uiManager, dataService, helpers, app, permissionHelper;

// DOM Elements
const elements = {};

// Default score breakdown (based on slide + MCQ request)
const DEFAULT_SCORE_BREAKDOWN = {
  task: 20,
  team: 15,
  additional: 25,
  mcq: 40,
};
const DEFAULT_TOTAL_SCORE = 100; // 20 + 15 + 25 + 40
const DEFAULT_TASK_TIME = '11:55';
const TASK_TIME_FIELD_CANDIDATES = [
  'scheduledTime',
  'scheduleTime',
  'assignmentTime',
  'assignmentClock',
  'time',
  'startTime',
  'timeSlot',
  'meetingTime',
];
const TASK_STATUS_OPTIONS = [
  { value: 'upcoming', label: 'আপকামিং এসাইনমেন্ট' },
  { value: 'ongoing', label: 'চলমান এসাইনমেন্ট' },
  { value: 'completed', label: 'কমপ্লিট এসাইনমেন্ট' },
];
const TASK_STATUS_META = {
  upcoming: {
    label: 'আপকামিং',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
  },
  ongoing: {
    label: 'চলমান',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  },
  completed: {
    label: 'কমপ্লিট',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
};
const TASK_STATUS_VALUES = TASK_STATUS_OPTIONS.map((opt) => opt.value);

/**
 * Initializes the Tasks component.
 * @param {object} dependencies - Passed from app.js.
 * @returns {object} - Public methods.
 */
export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  dataService = dependencies.services.dataService;
  permissionHelper = dependencies.utils.permissionHelper;
  helpers = dependencies.utils;
  app = dependencies.app;

  _cacheDOMElements();
  _setupEventListeners();

  console.log('✅ Tasks component initialized.');

  return {
    render,
    populateTaskSelects, // For evaluation component
  };
}

/**
 * Renders the Tasks page (#page-tasks).
 */
export function render() {
  if (!elements.page) return;
  const tasks = stateManager.get('tasks');
  
  // Filter for only upcoming tasks
  const upcomingTasks = tasks.filter(task => _getTaskStatus(task) === 'upcoming');
  
  _renderTasksList(upcomingTasks);
  // Reset add form breakdown fields to default when page renders
  _setBreakdownInputs(DEFAULT_SCORE_BREAKDOWN, ''); // '' prefix for add form
}

/**
 * Caches DOM elements for the Tasks page.
 * @private
 */
function _cacheDOMElements() {
  elements.page = document.getElementById('page-tasks');
  if (!elements.page) {
    console.error('❌ Tasks page element (#page-tasks) not found!');
    return;
  }

  elements.taskNameInput = elements.page.querySelector('#taskNameInput');

  // Score Breakdown Inputs
  elements.maxTaskScoreInput = elements.page.querySelector('#maxTaskScoreInput');
  elements.maxTeamScoreInput = elements.page.querySelector('#maxTeamScoreInput');
  elements.maxAdditionalScoreInput = elements.page.querySelector('#maxAdditionalScoreInput');
  elements.maxMcqScoreInput = elements.page.querySelector('#maxMcqScoreInput');
  elements.totalMaxScoreDisplay = elements.page.querySelector('#totalMaxScoreDisplay');

  elements.taskDescriptionInput = elements.page.querySelector('#taskDescriptionInput');
  elements.taskDateInput = elements.page.querySelector('#taskDateInput');
  elements.taskTimeInput = elements.page.querySelector('#taskTimeInput');
  elements.taskStatusInput = elements.page.querySelector('#taskStatusInput');
  elements.addTaskBtn = elements.page.querySelector('#addTaskBtn');
  elements.tasksListContainer = elements.page.querySelector('#tasksList');

  if (!elements.maxTaskScoreInput || !elements.totalMaxScoreDisplay) {
    console.warn('Tasks: One or more score breakdown elements are missing in the HTML.');
  }
  if (elements.taskStatusInput && !elements.taskStatusInput.value) {
    elements.taskStatusInput.value = 'upcoming';
  }
  if (elements.taskTimeInput && !elements.taskTimeInput.value) {
    elements.taskTimeInput.value = DEFAULT_TASK_TIME;
  }
}

/**
 * Sets up event listeners for the Tasks page.
 * @private
 */
function _setupEventListeners() {
  if (!elements.page) return;

  uiManager.addListener(elements.addTaskBtn, 'click', _handleAddTask);

  // Add listeners to breakdown inputs to update total display
  const breakdownInputs = [
    elements.maxTaskScoreInput,
    elements.maxTeamScoreInput,
    elements.maxAdditionalScoreInput,
    elements.maxMcqScoreInput,
  ];
  breakdownInputs.forEach((input) => {
    uiManager.addListener(input, 'input', () => _updateTotalMaxScoreDisplay(''));
  });

  // Event delegation for Edit/Delete buttons
  uiManager.addListener(elements.tasksListContainer, 'click', (e) => {
    const editBtn = e.target.closest('.edit-task-btn');
    const deleteBtn = e.target.closest('.delete-task-btn');
    if (editBtn) _handleEditTask(editBtn.dataset.id);
    else if (deleteBtn) _handleDeleteTask(deleteBtn.dataset.id);
  });

  uiManager.addListener(elements.tasksListContainer, 'change', (e) => {
    const select = e.target.closest('.task-status-select');
    if (select) {
      e.stopPropagation();
      _handleInlineStatusChange(select);
    }
  });
}

/**
 * Helper to convert various date types to a comparable YYYY-MM-DD string.
 * @param {string|Date|object} dateInput - The date to convert.
 * @returns {string} A string in YYYY-MM-DD format or an empty string.
 * @private
 */
function _getComparableDateString(dateInput) {
  if (!dateInput) return ''; // Handle null, undefined, empty string
  try {
    if (typeof dateInput === 'string') {
      return dateInput.split('T')[0]; // Handle ISO or YYYY-MM-DD strings
    }
    if (dateInput instanceof Date) {
      return dateInput.toISOString().split('T')[0]; // Convert Date object
    }
    if (typeof dateInput.toDate === 'function') {
      // Firestore Timestamp
      return dateInput.toDate().toISOString().split('T')[0];
    }
  } catch (e) {
    console.warn('Unsupported date type for comparison:', dateInput, e);
  }
  return ''; // Fallback
}

function _normalizeTimeString(value) {
  const parsed = _parseFlexibleTimeString(value);
  if (!parsed) return null;
  const hour = String(parsed.hour).padStart(2, '0');
  const minute = String(parsed.minute).padStart(2, '0');
  return `${hour}:${minute}`;
}

function _parseFlexibleTimeString(rawValue) {
  if (rawValue === undefined || rawValue === null) return null;
  const raw = String(rawValue).trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  const match = normalized.match(/(\d{1,2})(?::(\d{1,2}))?\s*(am|pm|a\.m\.|p\.m\.)?/);
  if (!match) {
    if (/^\d{3,4}$/.test(normalized)) {
      const digits = normalized.padStart(4, '0');
      const hour = parseInt(digits.slice(0, 2), 10);
      const minute = parseInt(digits.slice(2), 10);
      if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
        return {
          hour: Math.min(Math.max(hour, 0), 23),
          minute: Math.min(Math.max(minute, 0), 59),
        };
      }
    }
    return null;
  }

  let hour = parseInt(match[1], 10);
  let minute = match[2] ? parseInt(match[2], 10) : 0;
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const meridiem = match[3];
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

function _combineDateAndTime(dateValue, timeValue) {
  const datePart = _getComparableDateString(dateValue);
  if (!datePart) return '';
  const timePart = _normalizeTimeString(timeValue) || DEFAULT_TASK_TIME;
  try {
    const combined = new Date(`${datePart}T${timePart}:00`);
    if (!Number.isNaN(combined.getTime())) {
      return combined.toISOString();
    }
  } catch {
    // fall through
  }
  return dateValue || '';
}

function _getTaskTimeValue(task) {
  if (!task) return DEFAULT_TASK_TIME;
  for (const key of TASK_TIME_FIELD_CANDIDATES) {
    if (!Object.prototype.hasOwnProperty.call(task, key)) continue;
    const normalized = _normalizeTimeString(task[key]);
    if (normalized) return normalized;
  }
  const dateObj = _parseDateInput(task.date);
  if (dateObj && !Number.isNaN(dateObj.getTime())) {
    const hour = dateObj.getHours();
    const minute = dateObj.getMinutes();
    if (hour || minute) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }
  return DEFAULT_TASK_TIME;
}

/** Updates the total max score display */
function _updateTotalMaxScoreDisplay(formPrefix = '') {
  const taskScore = parseFloat(document.getElementById(`${formPrefix}maxTaskScoreInput`)?.value) || 0;
  const teamScore = parseFloat(document.getElementById(`${formPrefix}maxTeamScoreInput`)?.value) || 0;
  const additionalScore = parseFloat(document.getElementById(`${formPrefix}maxAdditionalScoreInput`)?.value) || 0;
  const mcqScore = parseFloat(document.getElementById(`${formPrefix}maxMcqScoreInput`)?.value) || 0;
  const total = taskScore + teamScore + additionalScore + mcqScore;

  const displayElement = document.getElementById(`${formPrefix}totalMaxScoreDisplay`);
  if (displayElement) {
    displayElement.textContent = helpers.convertToBanglaNumber(total);
  }
  return total;
}

/** Sets score breakdown input values */
function _setBreakdownInputs(scores, formPrefix = '') {
  const taskInput = document.getElementById(`${formPrefix}maxTaskScoreInput`);
  const teamInput = document.getElementById(`${formPrefix}maxTeamScoreInput`);
  const addInput = document.getElementById(`${formPrefix}maxAdditionalScoreInput`);
  const mcqInput = document.getElementById(`${formPrefix}maxMcqScoreInput`);

  // Use provided scores or fall back to defaults
  if (taskInput) taskInput.value = scores?.task ?? DEFAULT_SCORE_BREAKDOWN.task;
  if (teamInput) teamInput.value = scores?.team ?? DEFAULT_SCORE_BREAKDOWN.team;
  if (addInput) addInput.value = scores?.additional ?? DEFAULT_SCORE_BREAKDOWN.additional;
  if (mcqInput) mcqInput.value = scores?.mcq ?? DEFAULT_SCORE_BREAKDOWN.mcq;

  _updateTotalMaxScoreDisplay(formPrefix);
}

/** Renders the list of tasks */
function _renderTasksList(tasks) {
  if (!elements.tasksListContainer) return;
  uiManager.clearContainer(elements.tasksListContainer);
  if (!tasks || tasks.length === 0) {
    uiManager.displayEmptyMessage(elements.tasksListContainer, '???? ????? ??? ??? ?????');
    return;
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    const dateStrA = _getComparableDateString(a.date);
    const dateStrB = _getComparableDateString(b.date);
    return dateStrB.localeCompare(dateStrA);
  });

  const html = sortedTasks
    .map((task) => {
      const formattedDate = helpers.formatTimestamp(task.date) || '????? ???';
      const totalMaxScore = task.maxScoreBreakdown
        ? (parseFloat(task.maxScoreBreakdown.task) || 0) +
          (parseFloat(task.maxScoreBreakdown.team) || 0) +
          (parseFloat(task.maxScoreBreakdown.additional) || 0) +
          (parseFloat(task.maxScoreBreakdown.mcq) || 0)
        : parseFloat(task.maxScore) || DEFAULT_TOTAL_SCORE;

      const maxScoreText = helpers.convertToBanglaNumber(totalMaxScore);
      const description = task.description
        ? `<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${helpers.truncateText(task.description, 100)}</p>`
        : '';

      const breakdown = task.maxScoreBreakdown || {};
      const breakdownTitle =
        `?????????: ?????-${helpers.convertToBanglaNumber(breakdown.task ?? 'N/A')}, ` +
        `???-${helpers.convertToBanglaNumber(breakdown.team ?? 'N/A')}, ` +
        `????????-${helpers.convertToBanglaNumber(breakdown.additional ?? 'N/A')}, ` +
        `MCQ-${helpers.convertToBanglaNumber(breakdown.mcq ?? 'N/A')}`;

      const statusValue = _getTaskStatus(task);
      const statusMeta = TASK_STATUS_META[statusValue] || TASK_STATUS_META.upcoming;
      const statusBadge = `<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badge}">
        <i class="fas fa-circle text-[6px]"></i>${statusMeta.label}
      </span>`;

      return `
        <div class="card p-4 space-y-4">
          <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div class="flex-grow" title="${breakdownTitle}">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-lg font-semibold text-gray-900 dark:text-white">${helpers.ensureBengaliText(task.name)}</h4>
                ${statusBadge}
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                ?????: ${formattedDate} | ??? ???????? ?????: ${maxScoreText}
              </p>
              ${description}
            </div>
            <div class="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-end gap-2">
              <label class="text-xs font-semibold text-gray-500 dark:text-gray-400">স্টেটাস আপডেট</label>
              <select
                class="task-status-select form-input text-sm font-medium"
                data-id="${task.id}"
                data-current-status="${statusValue}"
                aria-label="টাস্ক স্টেটাস পরিবর্তন"
              >
                ${_buildStatusOptions(statusValue)}
              </select>
              <div class="flex space-x-2 justify-end">
                <button data-id="${task.id}" class="edit-task-btn btn btn-light btn-sm py-1 px-2" aria-label="????????">
                  <i class="fas fa-edit pointer-events-none"></i>
                </button>
                <button data-id="${task.id}" class="delete-task-btn btn btn-danger btn-sm py-1 px-2" aria-label="?????">
                  <i class="fas fa-trash pointer-events-none"></i>
                </button>
              </div>
            </div>
          </div>
        </div>`;
    })
    .join('');
  elements.tasksListContainer.innerHTML = html;
}


/** Handles adding a new task */
async function _handleAddTask() {
  // Permission check
  if (!permissionHelper?.canWrite()) {
    uiManager.showToast('আপনার নতুন টাস্ক যোগ করার অনুমতি নেই।', 'warning');
    return;
  }

  const title = elements.taskTitleInput?.value.trim();
  const description = elements.taskDescriptionInput?.value.trim();
  const dateInput = elements.taskDateInput?.value;
  const rawTimeValue = elements.taskTimeInput?.value;
  const normalizedTime = _normalizeTimeString(rawTimeValue) || DEFAULT_TASK_TIME;
  const combinedDateTime = _combineDateAndTime(dateInput, normalizedTime);
  const statusInput = _validateStatusInput(elements.taskStatusInput?.value);
  const status = statusInput || _deriveStatusFromDate(combinedDateTime);

  const maxScores = {
    task: parseFloat(elements.maxTaskScoreInput?.value) || 0,
    team: parseFloat(elements.maxTeamScoreInput?.value) || 0,
    additional: parseFloat(elements.maxAdditionalScoreInput?.value) || 0,
    mcq: parseFloat(elements.maxMcqScoreInput?.value) || 0,
  };
  const totalMaxScore = maxScores.task + maxScores.team + maxScores.additional + maxScores.mcq;

  if (!name) {
    uiManager.showToast('টাস্কের নাম আবশ্যক।', 'warning');
    return;
  }
  if (totalMaxScore <= 0 || Object.values(maxScores).some((s) => s < 0)) {
    uiManager.showToast('সর্বোচ্চ স্কোরের প্রতিটি অংশ ০ বা তার বেশি হতে হবে এবং যোগফল ০ এর বেশি হতে হবে।', 'warning');
    return;
  }
  if (!date) {
    uiManager.showToast('টাস্কের তারিখ নির্বাচন করুন।', 'warning');
    return;
  }

  uiManager.showLoading('টাস্ক যাচাই করা হচ্ছে...');
  try {
    const exists = await dataService.checkTaskNameExists(name);
    if (exists) {
      uiManager.showToast('এই নামে একটি টাস্ক ইতিমধ্যে বিদ্যমান।', 'warning');
      uiManager.hideLoading();
      return;
    }
  } catch (error) {
    uiManager.showToast(`নাম যাচাই করতে সমস্যা: ${error.message}`, 'error');
    uiManager.hideLoading();
    return;
  }

  const newTaskData = {
    name,
    description,
    date: combinedDateTime || dateInput,
    scheduledTime: normalizedTime,
    maxScore: totalMaxScore,
    maxScoreBreakdown: maxScores,
    status,
    nameLower: name.toLowerCase(),
  };

  uiManager.showLoading('টাস্ক যোগ করা হচ্ছে...');
  try {
    await dataService.addTask(newTaskData);
    await app.refreshAllData();
    if (elements.taskNameInput) elements.taskNameInput.value = '';
    _setBreakdownInputs(DEFAULT_SCORE_BREAKDOWN, ''); // Reset breakdown inputs
    if (elements.taskDescriptionInput) elements.taskDescriptionInput.value = '';
    if (elements.taskDateInput) elements.taskDateInput.value = '';
    if (elements.taskTimeInput) elements.taskTimeInput.value = DEFAULT_TASK_TIME;
    if (elements.taskStatusInput) elements.taskStatusInput.value = 'upcoming';
    uiManager.showToast('টাস্ক সফলভাবে যোগ করা হয়েছে।', 'success');
  } catch (error) {
    uiManager.showToast(`টাস্ক যোগ করতে সমস্যা: ${error.message}`, 'error');
  } finally {
    uiManager.hideLoading();
  }
}

function _getTaskStatus(task) {
  return _normalizeStatus(task?.status, task?.date);
}

function _normalizeStatus(value, dateInput) {
  if (TASK_STATUS_VALUES.includes(value)) return value;
  return _deriveStatusFromDate(dateInput);
}

function _validateStatusInput(value) {
  return TASK_STATUS_VALUES.includes(value) ? value : null;
}

function _deriveStatusFromDate(dateInput) {
  const dateObj = _parseDateInput(dateInput);
  if (!dateObj) return 'upcoming';
  const today = new Date();
  const cmpTask = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const cmpToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (cmpTask.getTime() === cmpToday.getTime()) return 'ongoing';
  if (cmpTask > cmpToday) return 'upcoming';
  return 'completed';
}

function _parseDateInput(dateInput) {
  if (!dateInput) return null;
  try {
    if (typeof dateInput.toDate === 'function') return dateInput.toDate();
    if (typeof dateInput === 'number') return new Date(dateInput);
    return new Date(dateInput);
  } catch {
    return null;
  }
}

function _buildStatusOptions(selected) {
  return TASK_STATUS_OPTIONS.map(
    (option) =>
      `<option value="${option.value}" ${option.value === selected ? 'selected' : ''}>${option.label}</option>`
  ).join('');
}

/** Handles editing a task */
function _handleEditTask(taskId) {
  // Permission check
  if (!permissionHelper?.canEdit()) {
    uiManager.showToast('আপনার টাস্ক সম্পাদনা করার অনুমতি নেই।', 'warning');
    return;
  }

  const task = stateManager.get('tasks').find((t) => t.id === taskId);
  if (!task) {
    uiManager.showToast('টাস্কটি পাওয়া যায়নি।', 'error');
    return;
  }

  // Use existing breakdown or default if not present
  const currentBreakdown = task.maxScoreBreakdown || DEFAULT_SCORE_BREAKDOWN;
  // Calculate total based on breakdown or task.maxScore
  const currentTotal = task.maxScoreBreakdown
    ? (parseFloat(currentBreakdown.task) || 0) +
      (parseFloat(currentBreakdown.team) || 0) +
      (parseFloat(currentBreakdown.additional) || 0) +
      (parseFloat(currentBreakdown.mcq) || 0)
    : task.maxScore || DEFAULT_TOTAL_SCORE;
  const dateValue = _getComparableDateString(task.date) || '';
  const timeValue = _getTaskTimeValue(task);
  const currentStatus = _getTaskStatus(task);

  const contentHTML = `
        <div class="space-y-4">
            <div><label for="editTaskName" class="label">টাস্ক নাম*</label><input id="editTaskName" type="text" value="${
              task.name || ''
            }" class="form-input" maxlength="100"></div>
            <fieldset class="border p-3 rounded dark:border-gray-600">
                 <legend class="text-sm font-medium px-1">সর্বোচ্চ স্কোর ব্রেকডাউন*</legend>
                 <div class="grid grid-cols-2 gap-3 mt-2">
                    <div><label for="editmaxTaskScoreInput" class="label text-xs">টাস্ক</label><input id="editmaxTaskScoreInput" type="number" min="0" step="any" value="${
                      currentBreakdown.task ?? 0
                    }" class="form-input breakdown-input"></div>
                    <div><label for="editmaxTeamScoreInput" class="label text-xs">টিম</label><input id="editmaxTeamScoreInput" type="number" min="0" step="any" value="${
                      currentBreakdown.team ?? 0
                    }" class="form-input breakdown-input"></div>
                    <div><label for="editmaxAdditionalScoreInput" class="label text-xs">অতিরিক্ত</label><input id="editmaxAdditionalScoreInput" type="number" min="0" step="any" value="${
                      currentBreakdown.additional ?? 0
                    }" class="form-input breakdown-input"></div>
                    <div><label for="editmaxMcqScoreInput" class="label text-xs">MCQ</label><input id="editmaxMcqScoreInput" type="number" min="0" step="any" value="${
                      currentBreakdown.mcq ?? 0
                    }" class="form-input breakdown-input"></div>
                 </div>
                 <p class="text-sm mt-3 text-gray-600 dark:text-gray-400">মোট সর্বোচ্চ স্কোর: <strong id="edittotalMaxScoreDisplay">${helpers.convertToBanglaNumber(
                   currentTotal
                 )}</strong></p>
            </fieldset>
            <div><label for="editTaskDescription" class="label">বিবরণ</label><textarea id="editTaskDescription" class="form-input" rows="3">${
              task.description || ''
            }</textarea></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label for="editTaskDate" class="label">?????*</label><input id="editTaskDate" type="date" value="${dateValue}" class="form-input"></div>
              <div><label for="editTaskTime" class="label">???????? (ঐচ্ছিক)</label><input id="editTaskTime" type="time" value="${timeValue}" class="form-input"></div>
            </div>
            <div><label for="editTaskStatus" class="label">স্টেটাস</label><select id="editTaskStatus" class="form-input">
              ${_buildStatusOptions(currentStatus)}
            </select></div>
        </div>`;

  uiManager.showEditModal('টাস্ক সম্পাদনা', contentHTML, async () => {
    // Save Callback
    const updatedName = document.getElementById('editTaskName')?.value.trim();
    const updatedDescription = document.getElementById('editTaskDescription')?.value.trim();
    const updatedDate = document.getElementById('editTaskDate')?.value;
    const updatedTimeRaw = document.getElementById('editTaskTime')?.value;
    const updatedTime = _normalizeTimeString(updatedTimeRaw) || DEFAULT_TASK_TIME;
    const combinedUpdatedDate = _combineDateAndTime(updatedDate, updatedTime);
    const updatedStatus =
      _validateStatusInput(document.getElementById('editTaskStatus')?.value) || _deriveStatusFromDate(combinedUpdatedDate);
    const updatedMaxScores = {
      task: parseFloat(document.getElementById('editmaxTaskScoreInput')?.value) || 0,
      team: parseFloat(document.getElementById('editmaxTeamScoreInput')?.value) || 0,
      additional: parseFloat(document.getElementById('editmaxAdditionalScoreInput')?.value) || 0,
      mcq: parseFloat(document.getElementById('editmaxMcqScoreInput')?.value) || 0,
    };
    const updatedTotalMaxScore =
      updatedMaxScores.task + updatedMaxScores.team + updatedMaxScores.additional + updatedMaxScores.mcq;

    if (
      !updatedName ||
      updatedTotalMaxScore <= 0 ||
      !updatedDate ||
      Object.values(updatedMaxScores).some((s) => s < 0)
    ) {
      uiManager.showToast('নাম, তারিখ এবং স্কোরের (>=0) যোগফল ০ এর বেশি হতে হবে।', 'warning');
      return;
    }

    uiManager.showLoading('যাচাই করা হচ্ছে...');
    try {
      const nameExists = await dataService.checkTaskNameExists(updatedName, taskId);
      if (nameExists) {
        uiManager.showToast('এই নামে অন্য টাস্ক আছে।', 'warning');
        uiManager.hideLoading();
        return;
      }
    } catch (error) {
      uiManager.showToast(`নাম যাচাই করতে সমস্যা: ${error.message}`, 'error');
      uiManager.hideLoading();
      return;
    }

    const updatedData = {
      name: updatedName,
      description: updatedDescription,
      date: combinedUpdatedDate || updatedDate,
      scheduledTime: updatedTime,
      maxScore: updatedTotalMaxScore,
      maxScoreBreakdown: updatedMaxScores,
      status: updatedStatus,
      nameLower: updatedName.toLowerCase(),
    };

    uiManager.showLoading('আপডেট হচ্ছে...');
    try {
      await dataService.updateTask(taskId, updatedData);
      await app.refreshAllData();
      uiManager.hideModal(uiManager.elements.editModal);
      uiManager.showToast('টাস্ক আপডেট হয়েছে।', 'success');
    } catch (error) {
      uiManager.showToast(`আপডেট ত্রুটি: ${error.message}`, 'error');
    } finally {
      uiManager.hideLoading();
    }
  });

  // Add listeners to update total score in modal
  const modalContent = uiManager.elements.editModalContent;
  if (modalContent) {
    modalContent.querySelectorAll('.breakdown-input').forEach((input) => {
      input.oninput = () => _updateTotalMaxScoreDisplay('edit');
    });
    _updateTotalMaxScoreDisplay('edit'); // Initial total calc
  }
}

/** Handles task deletion */
async function _handleDeleteTask(taskId) {
  // Permission check
  if (!permissionHelper?.canDelete()) {
    uiManager.showToast('আপনার টাস্ক মুছে ফেলার অনুমতি নেই।', 'warning');
    return;
  }

  const task = stateManager.get('tasks').find((t) => t.id === taskId);
  if (!task) {
    uiManager.showToast('টাস্কটি পাওয়া যায়নি।', 'error');
    return;
  }
  const evaluationsForTask = stateManager.get('evaluations').filter((e) => e.taskId === taskId);
  let message = `"${task.name}" টাস্ক ডিলিট করতে চান?`;
  if (evaluationsForTask.length > 0)
    message += `\n\n(এর সাথে ${helpers.convertToBanglaNumber(evaluationsForTask.length)} টি মূল্যায়ন ডিলিট হবে!)`;

  uiManager.showDeleteModal('টাস্ক ডিলিট', message, async () => {
    uiManager.showLoading('ডিলিট হচ্ছে...');
    try {
      if (evaluationsForTask.length > 0 && dataService.batchDeleteEvaluations) {
        await dataService.batchDeleteEvaluations(evaluationsForTask.map((e) => e.id));
      } else if (evaluationsForTask.length > 0) {
        // Fallback
        for (const evaluation of evaluationsForTask) await dataService.deleteEvaluation(evaluation.id);
      }
      await dataService.deleteTask(taskId);
      await app.refreshAllData();
      uiManager.showToast('টাস্ক ডিলিট হয়েছে।', 'success');
    } catch (error) {
      uiManager.showToast(`ডিলিট ত্রুটি: ${error.message}`, 'error');
    } finally {
      uiManager.hideLoading();
    }
  });
}

async function _handleInlineStatusChange(selectEl) {
  const taskId = selectEl?.dataset.id;
  const nextValue = _validateStatusInput(selectEl?.value);
  const previousValue = selectEl?.dataset.currentStatus || _validateStatusInput(selectEl?.value);

  if (!taskId || !nextValue || nextValue === previousValue) return;

  selectEl.disabled = true;
  uiManager.showLoading('স্টেটাস আপডেট হচ্ছে...');
  try {
    await dataService.updateTask(taskId, { status: nextValue });
    selectEl.dataset.currentStatus = nextValue;
    await app.refreshAllData();
    uiManager.showToast('স্টেটাস আপডেট হয়েছে', 'success');
  } catch (error) {
    uiManager.showToast(`স্টেটাস আপডেট ব্যর্থ: ${error.message}`, 'error');
    if (previousValue) selectEl.value = previousValue;
  } finally {
    selectEl.disabled = false;
    uiManager.hideLoading();
  }
}
/** Populates select dropdowns with task options */
function populateTaskSelects(selectElementIds, defaultOptionText = 'টাস্ক নির্বাচন করুন') {
  const tasks = stateManager.get('tasks');
  if (!tasks) {
    console.warn('populateTaskSelects: Tasks not loaded yet.');
    return;
  }

  const options = tasks
    .map((t) => ({
      value: t.id,
      text: `${helpers.ensureBengaliText(t.name)} (${helpers.formatTimestamp(t.date) || 'N/A'})`,
      date: _getComparableDateString(t.date), // Add date string for sorting
    }))
    .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date string descending

  selectElementIds.forEach((id) => {
    const selectElement = document.getElementById(id);
    if (selectElement) {
      uiManager.populateSelect(selectElement, options, defaultOptionText);
      if (selectElement.options[0] && selectElement.options[0].value === '') {
        selectElement.options[0].disabled = true;
      }
    } else {
      console.warn(`populateTaskSelects: Element #${id} not found.`);
    }
  });
}

