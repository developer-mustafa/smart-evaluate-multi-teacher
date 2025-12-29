// js/components/groups.js

// নির্ভরতা (Dependencies)
let stateManager, uiManager, dataService, helpers, app, permissionHelper;

// DOM এলিমেন্ট
const elements = {};

/**
 * Groups কম্পোনেন্ট শুরু করে (Initialize)।
 * @param {object} dependencies - অ্যাপ্লিকেশন থেকে পাস করা ম্যানেজার এবং সার্ভিস।
 * @returns {object} - এই কম্পোনেন্টের পাবলিক মেথড (যেমন render)।
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

  console.log('✅ Groups component initialized.');

  return {
    render,
    populateGroupSelects, // অন্যান্য কম্পোনেন্টকে গ্রুপ সিলেক্ট পপুলেট করতে দেওয়ার জন্য
  };
}

/**
 * Groups পেজ রেন্ডার করে।
 * এটি stateManager থেকে গ্রুপ তালিকা নিয়ে uiManager-কে দিয়ে তালিকাটি দেখায়।
 */
export function render() {
  if (!elements.page) {
    console.error('❌ Groups render failed: Page element #page-groups not found.');
    return;
  }
  console.log('Rendering Groups page...');
  const groups = stateManager.get('groups');
  _renderGroupsList(groups);
}

/**
 * এই পেজের DOM এলিমেন্টগুলো ক্যাশ করে।
 * @private
 */
function _cacheDOMElements() {
  elements.page = document.getElementById('page-groups');
  if (!elements.page) {
    console.error('❌ Groups init failed: #page-groups element not found!');
    return;
  }
  elements.groupNameInput = elements.page.querySelector('#groupNameInput');
  elements.addGroupBtn = elements.page.querySelector('#addGroupBtn');
  elements.groupsList = elements.page.querySelector('#groupsList');
}

/**
 * গ্রুপ যোগ করা, সম্পাদনা করা এবং ডিলিট করার জন্য ইভেন্ট লিসেনার সেট আপ করে।
 * @private
 */
function _setupEventListeners() {
  if (!elements.page) return;

  // "গ্রুপ যোগ করুন" বাটন ক্লিক
  uiManager.addListener(elements.addGroupBtn, 'click', _handleAddGroup);

  // গ্রুপ তালিকায় ইভেন্ট ডেলিগেশন (Edit/Delete বাটনের জন্য)
  uiManager.addListener(elements.groupsList, 'click', (e) => {
    const editBtn = e.target.closest('.edit-group-btn');
    const deleteBtn = e.target.closest('.delete-group-btn');

    if (editBtn) {
      const groupId = editBtn.dataset.id;
      _handleEditGroup(groupId);
    } else if (deleteBtn) {
      const groupId = deleteBtn.dataset.id;
      _handleDeleteGroup(groupId);
    }
  });
}

/**
 * গ্রুপ তালিকা UI-তে রেন্ডার করে।
 * @param {Array<object>} groups - stateManager থেকে পাওয়া গ্রুপ তালিকা।
 * @private
 */
function _renderGroupsList(groups) {
  if (!elements.groupsList) {
    console.warn('Groups render: groupsList element not found.');
    return;
  }

  uiManager.clearContainer(elements.groupsList);

  if (!groups || groups.length === 0) {
    uiManager.displayEmptyMessage(elements.groupsList, 'কোনো গ্রুপ যোগ করা হয়নি।');
    return;
  }

  // নাম অনুযায়ী সর্ট করে (যদিও dataService থেকে সর্টেড আসার কথা)
  const sortedGroups = [...groups].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'bn'));
  const students = stateManager.get('students') || []; // Ensure students array exists

  const html = sortedGroups
    .map((group) => {
      // এই গ্রুপের শিক্ষার্থীর সংখ্যা গণনা
      const studentCount = students.filter((s) => s.groupId === group.id).length;

      return `
        <div class="card p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
                <h4 class="text-lg font-semibold text-gray-800 dark:text-white">${helpers.ensureBengaliText(
                  group.name
                )}</h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    শিক্ষার্থী সংখ্যা: ${helpers.convertToBanglaNumber(studentCount)}
                </p>
            </div>
            <div class="flex space-x-2 mt-3 sm:mt-0 self-end sm:self-auto">
                <button data-id="${group.id}" 
                        class="edit-group-btn btn btn-light btn-sm py-1 px-2"
                        aria-label="গ্রুপ সম্পাদনা করুন">
                    <i class="fas fa-edit pointer-events-none"></i>
                </button>
                <button data-id="${group.id}" 
                        class="delete-group-btn btn btn-danger btn-sm py-1 px-2"
                        aria-label="গ্রুপ ডিলিট করুন">
                    <i class="fas fa-trash pointer-events-none"></i>
                </button>
            </div>
        </div>
        `;
    })
    .join('');

  elements.groupsList.innerHTML = html;
}

/**
 * নতুন গ্রুপ যোগ করার লজিক - এখন student selection modal দেখাবে।
 * @private
 */
async function _handleAddGroup() {
  // Permission check
  if (!permissionHelper?.canWrite()) {
    uiManager.showToast('আপনার নতুন গ্রুপ যোগ করার অনুমতি নেই।', 'warning');
    return;
  }

  _showStudentSelectionModal();
}

/**
 * Student selection modal তৈরি এবং দেখানো
 * @private
 */
function _showStudentSelectionModal() {
  const students = stateManager.get('students') || [];
  const classes = stateManager.get('classes') || [];
  const sections = stateManager.get('sections') || [];
  
  // Selected students tracking
  let selectedStudents = new Set();
  let filteredStudents = [...students];
  
  const modalHTML = `
    <div id="studentSelectionModal" class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">নতুন গ্রুপ তৈরি করুন</h3>
          <button id="btnCloseStudentModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <!-- Search and Filters -->
          <div class="space-y-3">
            <input 
              id="studentSearch" 
              type="text" 
              placeholder="শিক্ষার্থী খুঁজুন (নাম বা রোল)..." 
              class="form-input w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
            
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select id="filterClass" class="form-input px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                <option value="">সকল ক্লাস</option>
                ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
              
              <select id="filterSection" class="form-input px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                <option value="">সকল শাখা</option>
                ${sections.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
              
              <select id="filterAcademicGroup" class="form-input px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                <option value="">সকল গ্রুপ</option>
                <option value="বিজ্ঞান">বিজ্ঞান</option>
                <option value="ব্যবসায়">ব্যবসায়</option>
                <option value="মানবিক">মানবিক</option>
              </select>
            </div>
          </div>
          
          <!-- Select All and Count -->
          <div class="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="selectAllStudents" class="form-checkbox rounded">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">সকল শিক্ষার্থী নির্বাচন করুন</span>
            </label>
            <span id="selectedCount" class="text-sm font-semibold text-indigo-600 dark:text-indigo-400">নির্বাচিত: ০</span>
          </div>
          
          <!-- Students List -->
          <div id="studentsList" class="space-y-2 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <!-- Will be populated by JavaScript -->
          </div>
          
          <!-- Group Details Form -->
          <div class="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">গ্রুপের নাম *</label>
              <input 
                id="groupNameInput" 
                type="text" 
                placeholder="যেমন: বিজ্ঞান গ্রুপ - A" 
                class="form-input w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                maxlength="50"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">বিবরণ (ঐচ্ছিক)</label>
              <textarea 
                id="groupDescInput" 
                rows="2" 
                placeholder="গ্রুপ সম্পর্কে সংক্ষিপ্ত বিবরণ..."
                class="form-input w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              ></textarea>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button id="btnCancelGroupCreate" class="flex-1 px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium">
            বাতিল
          </button>
          <button id="btnCreateGroup" class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm">
            গ্রুপ তৈরি করুন
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to DOM
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer.firstElementChild);
  
  // Get modal elements
  const modal = document.getElementById('studentSelectionModal');
  const studentsList = document.getElementById('studentsList');
  const searchInput = document.getElementById('studentSearch');
  const filterClass = document.getElementById('filterClass');
  const filterSection = document.getElementById('filterSection');
  const filterAcademicGroup = document.getElementById('filterAcademicGroup');
  const selectAllCheckbox = document.getElementById('selectAllStudents');
  const selectedCountEl = document.getElementById('selectedCount');
  const btnClose = document.getElementById('btnCloseStudentModal');
  const btnCancel = document.getElementById('btnCancelGroupCreate');
  const btnCreate = document.getElementById('btnCreateGroup');
  
  // Render students function
  function renderStudents() {
    if (filteredStudents.length === 0) {
      studentsList.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-8">কোনো শিক্ষার্থী পাওয়া যায়নি</p>';
      return;
    }
    
    studentsList.innerHTML = filteredStudents.map(student => {
      const className = classes.find(c => c.id === student.classId)?.name || '-';
      const sectionName = sections.find(s => s.id === student.sectionId)?.name || '-';
      const isSelected = selectedStudents.has(student.id);
      
      return `
        <label class="flex items-center gap-3 p-3 rounded-lg border ${isSelected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700'} hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
          <input 
            type="checkbox" 
            class="student-checkbox form-checkbox rounded" 
            data-student-id="${student.id}"
            ${isSelected ? 'checked' : ''}
          >
          <div class="flex-1">
            <div class="font-medium text-gray-900 dark:text-white">${student.name}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              রোল: ${student.roll} • ${className} • ${sectionName} • ${student.academicGroup || '-'}
            </div>
          </div>
        </label>
      `;
    }).join('');
    
    updateSelectedCount();
  }
  
  // Filter function
  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const classFilter = filterClass.value;
    const sectionFilter = filterSection.value;
    const groupFilter = filterAcademicGroup.value;
    
    filteredStudents = students.filter(student => {
      const matchesSearch = !searchTerm || 
        student.name.toLowerCase().includes(searchTerm) ||
        student.roll.toString().includes(searchTerm);
      const matchesClass = !classFilter || student.classId === classFilter;
      const matchesSection = !sectionFilter || student.sectionId === sectionFilter;
      const matchesGroup = !groupFilter || student.academicGroup === groupFilter;
      
      return matchesSearch && matchesClass && matchesSection && matchesGroup;
    });
    
    renderStudents();
  }
  
  // Update selected count
  function updateSelectedCount() {
    const count = selectedStudents.size;
    selectedCountEl.textContent = `নির্বাচিত: ${helpers.convertToBanglaNumber(count)}`;
    
    // Update select all checkbox
    const allCheckboxes = Array.from(studentsList.querySelectorAll('.student-checkbox'));
    const allChecked = allCheckboxes.length > 0 && allCheckboxes.every(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;
  }
  
  // Event Listeners
  searchInput.addEventListener('input', applyFilters);
  filterClass.addEventListener('change', applyFilters);
  filterSection.addEventListener('change', applyFilters);
  filterAcademicGroup.addEventListener('change', applyFilters);
  
  selectAllCheckbox.addEventListener('change', (e) => {
    const checkboxes = studentsList.querySelectorAll('.student-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
      const studentId = cb.dataset.studentId;
      if (e.target.checked) {
        selectedStudents.add(studentId);
      } else {
        selectedStudents.delete(studentId);
      }
    });
    renderStudents();
  });
  
  studentsList.addEventListener('change', (e) => {
    if (e.target.classList.contains('student-checkbox')) {
      const studentId = e.target.dataset.studentId;
      if (e.target.checked) {
        selectedStudents.add(studentId);
      } else {
        selectedStudents.delete(studentId);
      }
      updateSelectedCount();
    }
  });
  
  // Close handlers
  const closeModal = () => {
    modal.remove();
  };
  
  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Create group handler
  btnCreate.addEventListener('click', async () => {
    const groupName = document.getElementById('groupNameInput').value.trim();
    const groupDesc = document.getElementById('groupDescInput').value.trim();
    
    if (!groupName) {
      uiManager.showToast('গ্রুপের নাম লিখুন।', 'warning');
      return;
    }
    
    if (selectedStudents.size === 0) {
      uiManager.showToast('অন্তত একজন শিক্ষার্থী নির্বাচন করুন।', 'warning');
      return;
    }
    
    uiManager.showLoading('গ্রুপ তৈরি হচ্ছে...');
    try {
      // Check if group name exists
      const exists = await dataService.checkGroupNameExists(groupName);
      if (exists) {
        uiManager.showToast('এই নামে একটি গ্রুপ ইতিমধ্যে বিদ্যমান।', 'warning');
        uiManager.hideLoading();
        return;
      }
      
      const groupData = {
        name: groupName,
        description: groupDesc,
        studentIds: Array.from(selectedStudents),
        createdAt: new Date().toISOString()
      };
      
      // Create group
      const newGroupId = await dataService.addGroup(groupData);
      
      // Update students' groupId
      const studentIdsArray = Array.from(selectedStudents);
      await dataService.batchUpdateStudents(studentIdsArray, { groupId: newGroupId });
      
      await app.refreshAllData();
      
      closeModal();
      uiManager.showToast(`গ্রুপ সফলভাবে তৈরি হয়েছে (${selectedStudents.size} জন শিক্ষার্থী যুক্ত)।`, 'success');
    } catch (error) {
      console.error('❌ Error creating group:', error);
      uiManager.showToast(`গ্রুপ তৈরি করতে সমস্যা হয়েছে: ${error.message}`, 'error');
    } finally {
      uiManager.hideLoading();
    }
  });
  
  // Initial render
  applyFilters();
}

/**
 * গ্রুপ সম্পাদনা করার জন্য মোডাল দেখায়।
 * @param {string} groupId - গ্রুপের ID।
 * @private
 */
function _handleEditGroup(groupId) {
  // Permission check
  if (!permissionHelper?.canEdit()) {
    uiManager.showToast('আপনার গ্রুপ সম্পাদনা করার অনুমতি নেই।', 'warning');
    return;
  }

  const group = stateManager.get('groups').find((g) => g.id === groupId);
  if (!group) {
    uiManager.showToast('গ্রুপটি পাওয়া যায়নি।', 'error');
    return;
  }

  // মোডালের জন্য HTML কন্টেন্ট
  const contentHTML = `
        <div>
            <label class="label" for="editGroupNameInput">গ্রুপের নাম</label>
            <input id="editGroupNameInput" type="text" 
                   class="form-input w-full" 
                   value="${group.name || ''}"
                   maxlength="50" />
        </div>
    `;

  uiManager.showEditModal('গ্রুপ সম্পাদনা', contentHTML, async () => {
    // এটি হলো 'saveCallback' ফাংশন
    const newNameInput = document.getElementById('editGroupNameInput');
    const newName = newNameInput?.value.trim();

    if (!newName) {
      uiManager.showToast('গ্রুপের নাম খালি রাখা যাবে না।', 'warning');
      return; // মোডাল বন্ধ করি না
    }
    if (newName === group.name) {
      uiManager.hideModal(uiManager.elements.editModal);
      return;
    }

    uiManager.showLoading('আপডেট করা হচ্ছে...');
    try {
      // চেক করি নতুন নামটি অন্য গ্রুপের সাথে মিলে যায় কিনা
      const exists = await dataService.checkGroupNameExists(newName, groupId);
      if (exists) {
        uiManager.showToast('এই নামে আরেকটি গ্রুপ ইতিমধ্যে বিদ্যমান।', 'warning');
        uiManager.hideLoading();
        return; // মোডাল বন্ধ করি না
      }

      await dataService.updateGroup(groupId, { name: newName });
      await app.refreshAllData();

      uiManager.hideModal(uiManager.elements.editModal);
      uiManager.showToast('গ্রুপ সফলভাবে আপডেট করা হয়েছে।', 'success');
    } catch (error) {
      console.error('❌ Error updating group:', error);
      uiManager.showToast(`আপডেট করতে সমস্যা হয়েছে: ${error.message}`, 'error');
    } finally {
      uiManager.hideLoading();
    }
  });
}

/**
 * গ্রুপ ডিলিট করার জন্য কনফার্মেশন মোডাল দেখায়।
 * @param {string} groupId - গ্রুপের ID।
 * @private
 */
function _handleDeleteGroup(groupId) {
  // Permission check
  if (!permissionHelper?.canDelete()) {
    uiManager.showToast('আপনার গ্রুপ মুছে ফেলার অনুমতি নেই।', 'warning');
    return;
  }

  const group = stateManager.get('groups').find((g) => g.id === groupId);
  if (!group) {
    uiManager.showToast('গ্রুপটি পাওয়া যায়নি।', 'error');
    return;
  }

  const studentCount = stateManager.get('students').filter((s) => s.groupId === groupId).length;
  let message = `আপনি কি নিশ্চিত যে আপনি "${group.name}" গ্রুপটি ডিলিট করতে চান?`;
  if (studentCount > 0) {
    message += ` (এই গ্রুপে ${helpers.convertToBanglaNumber(
      studentCount
    )} জন শিক্ষার্থী রয়েছে। গ্রুপ ডিলিট করলে শিক্ষার্থীদের গ্রুপ অ্যাসাইনমেন্ট মুছে যাবে!)`;
  }

  uiManager.showDeleteModal('গ্রুপ ডিলিট নিশ্চিতকরণ', message, async () => {
    // 'confirmCallback'
    uiManager.showLoading('ডিলিট করা হচ্ছে...');
    try {
      // ১. এই গ্রুপের সকল শিক্ষার্থীর 'groupId' আপডেট করে null/empty করি
      const studentsToUpdate = stateManager
        .get('students')
        .filter((s) => s.groupId === groupId)
        .map((s) => s.id);

      if (studentsToUpdate.length > 0) {
        // dataService থেকে ব্যাচ আপডেট ফাংশন ব্যবহার করি
        await dataService.batchUpdateStudents(studentsToUpdate, { groupId: '', role: '' });
      }

      // ২. গ্রুপ ডিলিট করি
      await dataService.deleteGroup(groupId);

      await app.refreshAllData(); // সমস্ত ডেটা রিফ্রেশ

      uiManager.showToast('গ্রুপ সফলভাবে ডিলিট করা হয়েছে।', 'success');
    } catch (error) {
      console.error('❌ Error deleting group:', error);
      uiManager.showToast(`গ্রুপ ডিলিট করতে সমস্যা হয়েছে: ${error.message}`, 'error');
    } finally {
      uiManager.hideLoading();
    }
  });
}

/**
 * অ্যাপ্লিকেশন জুড়ে সমস্ত গ্রুপ `<select>` ড্রপডাউন পপুলেট করে।
 * @param {Array<string>} selectElementIds - ['id1', 'id2', ...]
 * @param {string} [defaultOptionText='সকল গ্রুপ'] - প্রথম অপশনের টেক্সট
 */
export function populateGroupSelects(selectElementIds, defaultOptionText = 'সকল গ্রুপ') {
  const groups = stateManager.get('groups');
  const user = stateManager.get('currentUserData');
  
  console.log('🔍 populateGroupSelects called');
  console.log('Total groups:', groups?.length || 0);
  console.log('User type:', user?.type);
  
  let filteredGroups = groups;

  if (user && user.type === 'teacher') {
      const students = stateManager.get('students') || [];
      const teacher = stateManager.get('currentTeacher');
      const assignedClasses = teacher?.assignedClasses || [];
      // Note: We're NOT filtering by section - teachers get ALL groups from their assigned classes
      
      console.log('👨‍🏫 Teacher filtering:');
      console.log('Assigned classes:', assignedClasses);
      console.log('Total students:', students.length);

      // Get all group IDs that have at least one student from teacher's assigned classes
      // Note: Students have groupId field, not groups having studentIds array
      const relevantGroupIds = new Set(
          students
              .filter(s => assignedClasses.includes(s.classId) && s.groupId)
              .map(s => s.groupId)
      );
      
      console.log('Relevant group IDs:', relevantGroupIds.size);
      console.log('Sample group IDs:', Array.from(relevantGroupIds).slice(0, 5));

      // Filter groups by checking if their ID is in the relevant group IDs set
      filteredGroups = groups.filter(g => {
          const isRelevant = relevantGroupIds.has(g.id);
          if (isRelevant) {
              console.log('✅ Group included:', g.name, '(ID:', g.id, ')');
          } else {
              console.log('❌ Group excluded (no students from assigned class):', g.name);
          }
          return isRelevant;
      });
      
      console.log('Filtered groups for teacher:', filteredGroups.length);
  }

  const options = filteredGroups
    .map((g) => ({
      value: g.id,
      text: helpers.ensureBengaliText(g.name),
    }))
    .sort((a, b) => a.text.localeCompare(b.text, 'bn')); // বাংলা নামে সর্ট

  selectElementIds.forEach((id) => {
    const selectElement = document.getElementById(id);
    if (selectElement) {
      // 'all' ভ্যালু পাস করি যদি ডিফল্ট টেক্সট 'সকল...' হয়
      const defaultValue = defaultOptionText.includes('সকল') || defaultOptionText.includes('All') ? 'all' : '';
      uiManager.populateSelect(selectElement, options, defaultOptionText, selectElement.value || defaultValue);
      // 'নির্বাচন করুন' অপশন থাকলে তা disabled করি
      if (defaultOptionText.includes('নির্বাচন') && selectElement.options[0]) {
        selectElement.options[0].disabled = true;
      }
    } else {
      // console.warn(`populateGroupSelects: Element with ID "${id}" not found.`);
    }
  });
}
