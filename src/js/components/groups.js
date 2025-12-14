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
 * নতুন গ্রুপ যোগ করার লজিক।
 * @private
 */
async function _handleAddGroup() {
  // Permission check
  if (!permissionHelper?.canWrite()) {
    uiManager.showToast('আপনার নতুন গ্রুপ যোগ করার অনুমতি নেই।', 'warning');
    return;
  }

  const groupName = elements.groupNameInput?.value.trim();
  if (!groupName) {
    uiManager.showToast('গ্রুপের নাম লিখুন।', 'warning');
    return;
  }
  if (groupName.length > 50) {
    uiManager.showToast('গ্রুপের নাম ৫০ অক্ষরের কম হতে হবে।', 'warning');
    return;
  }

  uiManager.showLoading('গ্রুপ যোগ করা হচ্ছে...');
  try {
    // চেক করি এই নামে গ্রুপ আছে কিনা
    const exists = await dataService.checkGroupNameExists(groupName);
    if (exists) {
      uiManager.showToast('এই নামে একটি গ্রুপ ইতিমধ্যে বিদ্যমান।', 'warning');
      uiManager.hideLoading();
      return;
    }

    const newData = { name: groupName };
    await dataService.addGroup(newData); // ডেটাবেসে যোগ (dataService nameLower যোগ করবে)

    await app.refreshAllData(); // সমস্ত ডেটা রিফ্রেশ (সহজ উপায়)

    if (elements.groupNameInput) elements.groupNameInput.value = ''; // ইনপুট ক্লিয়ার
    uiManager.showToast('গ্রুপ সফলভাবে যোগ করা হয়েছে।', 'success');
  } catch (error) {
    console.error('❌ Error adding group:', error);
    uiManager.showToast(`গ্রুপ যোগ করতে সমস্যা হয়েছে: ${error.message}`, 'error');
  } finally {
    uiManager.hideLoading();
  }
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
  const options = groups
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
