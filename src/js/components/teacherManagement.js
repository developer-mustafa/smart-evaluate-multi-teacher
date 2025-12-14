// js/components/teacherManagement.js

import uiManager from '../managers/uiManager.js';
import stateManager from '../managers/stateManager.js';

let managers, services, utils;
let editingTeacherId = null;
let currentView = 'active'; // 'active' or 'deleted'

export function init(dependencies) {
  managers = dependencies.managers;
  services = dependencies.services;
  utils = dependencies.utils;
  
  console.log('Teacher Management component initialized.');
  return { render };
}

function render() {
  console.log('Rendering Teacher Management page...');
  
  const container = document.getElementById('page-teacher-management');
  if (!container) {
    console.error('Teacher Management container not found.');
    return;
  }

  // Check permission (Super Admin only)
  const user = managers.stateManager.get('currentUserData');
  if (!user || user.type !== 'super-admin') {
    container.innerHTML = '<div class="text-center text-red-500 mt-10 p-6">⚠️ শুধুমাত্র সুপার এডমিন শিক্ষক ম্যানেজমেন্ট দেখতে পারবেন।</div>';
    return;
  }

  container.innerHTML = getHTML();
  attachListeners();
  renderTable();
}

function getHTML() {
  return `
    <div class="max-w-7xl mx-auto">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">শিক্ষক ম্যানেজমেন্ট</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">শিক্ষক তৈরি এবং ক্লাস/শাখা/বিষয় নির্ধারণ করুন</p>
        </div>
        <button id="btnAddTeacher" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
          <i class="fas fa-plus"></i>নতুন শিক্ষক
        </button>
      </div>

      <!-- View Toggle -->
      <div class="mb-4 flex gap-2 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700 inline-flex">
        <button id="btnShowActive" class="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-indigo-600 text-white">
          সক্রিয় শিক্ষক
        </button>
        <button id="btnShowDeleted" class="px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          নিষ্ক্রিয় শিক্ষক
        </button>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">নাম</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">ইমেইল</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">ক্লাস</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">শাখা</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">বিষয়</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody id="teachersTableBody" class="divide-y divide-y-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Teacher Modal -->
    <div id="teacherModal" class="fixed inset-0 z-[9999] hidden bg-black/50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 id="modalTitle" class="text-xl font-bold text-gray-900 dark:text-white">নতুন শিক্ষক</h3>
          <button id="btnCloseModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        <form id="teacherForm" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">নাম *</label>
            <input id="inputName" type="text" required class="form-input w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="শিক্ষকের নাম">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ইমেইল *</label>
            <input id="inputEmail" type="email" required class="form-input w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="teacher@example.com">
          </div>
          <div id="passwordField">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">পাসওয়ার্ড *</label>
            <input id="inputPassword" type="password" minlength="6" class="form-input w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="কমপক্ষে ৬ অক্ষর">
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">* নতুন শিক্ষকের জন্য প্রয়োজন</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ক্লাস</label>
            <select id="selectClasses" multiple class="form-select w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-32"></select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Ctrl/Cmd + ক্লিক করে একাধিক সিলেক্ট করুন</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">শাখা</label>
            <select id="selectSections" multiple class="form-select w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-32"></select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">বিষয়</label>
            <select id="selectSubjects" multiple class="form-select w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-32"></select>
          </div>
          <div class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" id="btnCancelForm" class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors">বাতিল</button>
            <button type="submit" class="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">সংরক্ষণ</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function attachListeners() {
  document.getElementById('btnAddTeacher')?.addEventListener('click', openAddModal);
  document.getElementById('teacherForm')?.addEventListener('submit', handleSubmit);
  document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
  document.getElementById('btnCancelForm')?.addEventListener('click', closeModal);
  document.getElementById('teacherModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'teacherModal') closeModal();
  });

  // View toggle buttons
  document.getElementById('btnShowActive')?.addEventListener('click', () => {
    currentView = 'active';
    updateViewToggleButtons();
    renderTable();
  });
  
  document.getElementById('btnShowDeleted')?.addEventListener('click', () => {
    currentView = 'deleted';
    updateViewToggleButtons();
    renderTable();
  });

  // Table delegation
  document.getElementById('teachersTableBody')?.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    const { action, id } = target.dataset;
    if (action === 'edit') openEditModal(id);
    else if (action === 'delete') deleteTeacher(id);
    else if (action === 'restore') restoreTeacher(id);
  });
}

function renderTable() {
  const allTeachers = managers.stateManager.get('teachers') || [];
  // Filter based on current view
  const teachers = currentView === 'active' 
    ? allTeachers.filter(t => !t.deleted)
    : allTeachers.filter(t => t.deleted === true);
    
  const classes = managers.stateManager.get('classes') || [];
  const sections = managers.stateManager.get('sections') || [];
  const subjects = managers.stateManager.get('subjects') || [];
  const tbody = document.getElementById('teachersTableBody');
  if (!tbody) return;

  if (teachers.length === 0) {
    const message = currentView === 'active' ? 'কোনো সক্রিয় শিক্ষক পাওয়া যায়নি' : 'কোনো নিষ্ক্রিয় শিক্ষক পাওয়া যায়নি';
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">${message}</td></tr>`;
    return;
  }

  tbody.innerHTML = teachers.map(t => {
    const cls = (t.assignedClasses || []).map(id => classes.find(c => c.id === id)?.name || '?').join(', ') || '-';
    const sec = (t.assignedSections || []).map(id => sections.find(s => s.id === id)?.name || '?').join(', ') || '-';
    const sub = (t.assignedSubjects || []).map(id => subjects.find(s => s.id === id)?.name || '?').join(', ') || '-';
    
    // Different buttons based on view
    const actionButtons = currentView === 'active' 
      ? `
        <button data-action="edit" data-id="${t.id}" class="px-3 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"><i class="fas fa-pencil-alt mr-1"></i>এডিট</button>
        <button data-action="delete" data-id="${t.id}" class="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"><i class="fas fa-trash-alt mr-1"></i>ডিলিট</button>
      `
      : `
        <button data-action="restore" data-id="${t.id}" class="px-3 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"><i class="fas fa-undo mr-1"></i>পুনরুদ্ধার করুন</button>
      `;
    
    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
        <td class="px-4 py-3 text-sm">${escape(t.name || t.email)}</td>
        <td class="px-4 py-3 text-sm">${escape(t.email)}</td>
        <td class="px-4 py-3 text-sm">${cls}</td>
        <td class="px-4 py-3 text-sm">${sec}</td>
        <td class="px-4 py-3 text-sm">${sub}</td>
        <td class="px-4 py-3 text-sm">
          <div class="flex gap-2">
            ${actionButtons}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function updateViewToggleButtons() {
  const btnActive = document.getElementById('btnShowActive');
  const btnDeleted = document.getElementById('btnShowDeleted');
  
  if (currentView === 'active') {
    btnActive?.classList.add('bg-indigo-600', 'text-white');
    btnActive?.classList.remove('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
    
    btnDeleted?.classList.remove('bg-indigo-600', 'text-white');
    btnDeleted?.classList.add('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
  } else {
    btnDeleted?.classList.add('bg-indigo-600', 'text-white');
    btnDeleted?.classList.remove('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
    
    btnActive?.classList.remove('bg-indigo-600', 'text-white');
    btnActive?.classList.add('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
  }
}

function openAddModal() {
  editingTeacherId = null;
  document.getElementById('modalTitle').textContent = 'নতুন শিক্ষক';
  document.getElementById('teacherForm').reset();
  document.getElementById('passwordField').classList.remove('hidden');
  document.getElementById('inputPassword').required = true;
  populateSelects();
  document.getElementById('teacherModal').classList.remove('hidden');
}

function openEditModal(id) {
  const teachers = managers.stateManager.get('teachers');
  const teacher = teachers.find(t => t.id === id);
  if (!teacher) return;

  editingTeacherId = id;
  document.getElementById('modalTitle').textContent = 'শিক্ষক এডিট';
  document.getElementById('inputName').value = teacher.name || '';
  document.getElementById('inputEmail').value = teacher.email || '';
  document.getElementById('passwordField').classList.add('hidden');
  document.getElementById('inputPassword').required = false;
  
  populateSelects();
  setSelected('selectClasses', teacher.assignedClasses || []);
  setSelected('selectSections', teacher.assignedSections || []);
  setSelected('selectSubjects', teacher.assignedSubjects || []);
  
  document.getElementById('teacherModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('teacherModal').classList.add('hidden');
  editingTeacherId = null;
}

function populateSelects() {
  const classes = managers.stateManager.get('classes') || [];
  const sections = managers.stateManager.get('sections') || [];
  const subjects = managers.stateManager.get('subjects') || [];

  document.getElementById('selectClasses').innerHTML = classes.map(c => `<option value="${c.id}">${escape(c.name)}</option>`).join('');
  document.getElementById('selectSections').innerHTML = sections.map(s => `<option value="${s.id}">${escape(s.name)}</option>`).join('');
  document.getElementById('selectSubjects').innerHTML = subjects.map(s => `<option value="${s.id}">${escape(s.name)}</option>`).join('');
}

function setSelected(selectId, values) {
  const select = document.getElementById(selectId);
  Array.from(select.options).forEach(opt => {
    opt.selected = values.includes(opt.value);
  });
}

function getSelected(selectId) {
  return Array.from(document.getElementById(selectId).selectedOptions).map(opt => opt.value);
}

async function handleSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('inputName').value.trim();
  const email = document.getElementById('inputEmail').value.trim();
  const password = document.getElementById('inputPassword').value;
  const assignedClasses = getSelected('selectClasses');
  const assignedSections = getSelected('selectSections');
  const assignedSubjects = getSelected('selectSubjects');

  if (!name || !email) {
    managers.uiManager.showToast('নাম এবং ইমেইল প্রয়োজন', 'warning');
    return;
  }

  if (!editingTeacherId && (!password || password.length < 6)) {
    managers.uiManager.showToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে', 'warning');
    return;
  }

  managers.uiManager.showLoading(editingTeacherId ? 'আপডেট হচ্ছে...' : 'শিক্ষক তৈরি হচ্ছে...');

  try {
    if (editingTeacherId) {
      await services.dataService.updateTeacher(editingTeacherId, { name, assignedClasses, assignedSections, assignedSubjects });
      managers.uiManager.showToast('শিক্ষক আপডেট হয়েছে', 'success');
    } else {
      await services.authService.registerTeacher(email, password, { name, assignedClasses, assignedSections, assignedSubjects });
      managers.uiManager.showToast('শিক্ষক তৈরি হয়েছে', 'success');
    }
    
    const teachers = await services.dataService.loadTeachers('all');
    managers.stateManager.set('teachers', teachers);
    closeModal();
    renderTable();
  } catch (error) {
    console.error('Error saving teacher:', error);
    managers.uiManager.showToast(`ত্রুটি: ${error.message}`, 'error');
  } finally {
    managers.uiManager.hideLoading();
  }
}

async function deleteTeacher(id) {
  console.log('🔴 Delete teacher called, ID:', id);
  const teachers = managers.stateManager.get('teachers');
  const teacher = teachers.find(t => t.id === id);
  console.log('🔴 Teacher found:', teacher);
  
  if (!teacher) {
    console.warn('⚠️ Teacher not found');
    return;
  }

  const teacherName = teacher.name || teacher.email;
  
  const confirmed = await showConfirmDialog(
    teacherName + ' ডিলিট করুন',
    '<p>আপনি কি নিশ্চিত? শিক্ষকের অ্যাকাউন্ট নিষ্ক্রিয় হবে এবং login করতে পারবে না।</p>'
  );
  
  console.log('🔴 User confirmed:', confirmed);
  
  if (!confirmed) return;

  console.log('🔴 Starting delete...');
  managers.uiManager.showLoading('ডিলিট হচ্ছে...');

  try {
    console.log('🔴 Calling deleteTeacher service...');
    await services.dataService.deleteTeacher(id);
    console.log('✅ Teacher deleted from Firestore');
    
    const teachers = await services.dataService.loadTeachers('all');
    console.log('🔴 Reloaded teachers:', teachers.length);
    
    managers.stateManager.set('teachers', teachers);
    managers.uiManager.showToast('শিক্ষক ডিলিট হয়েছে', 'success');
    renderTable();
    console.log('✅ UI updated');
  } catch (error) {
    console.error('❌ Error deleting teacher:', error);
    managers.uiManager.showToast(`ডিলিট করতে ব্যর্থ: ${error.message}`, 'error');
  } finally {
    managers.uiManager.hideLoading();
  }
}

async function restoreTeacher(id) {
  console.log('🟢 Restore teacher called, ID:', id);
  const teachers = managers.stateManager.get('teachers');
  const teacher = teachers.find(t => t.id === id);
  
  if (!teacher) {
    console.warn('⚠️ Teacher not found');
    return;
  }

  const teacherName = teacher.name || teacher.email;
  
  const confirmed = await showConfirmDialog(
    teacherName + ' পুনরুদ্ধার করুন',
    '<p>এই শিক্ষককে পুনরুদ্ধার করতে চান? পুনরুদ্ধারের পর শিক্ষক আবার login করতে পারবেন।</p>'
  );
  
  if (!confirmed) return;

  managers.uiManager.showLoading('পুনরুদ্ধার হচ্ছে...');

  try {
    await services.dataService.restoreTeacher(id);
    console.log('✅ Teacher restored');
    
    const teachers = await services.dataService.loadTeachers('all');
    managers.stateManager.set('teachers', teachers);
    managers.uiManager.showToast('শিক্ষক পুনরুদ্ধার হয়েছে', 'success');
    renderTable();
  } catch (error) {
    console.error('❌ Error restoring teacher:', error);
    managers.uiManager.showToast(`পুনরুদ্ধার করতে ব্যর্থ: ${error.message}`, 'error');
  } finally {
    managers.uiManager.hideLoading();
  }
}

function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    const uniqueId = Date.now();
    const modalHTML = `
      <div id="confirmModal-${uniqueId}" class="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">${title}</h3>
          </div>
          <div class="p-6">
            <p class="text-gray-700 dark:text-gray-300">${message}</p>
          </div>
          <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button id="btnCancel-${uniqueId}" class="flex-1 px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors">
              বাতিল
            </button>
            <button id="btnOK-${uniqueId}" class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm">
              ডিলিট করুন
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalHTML;
    document.body.appendChild(modalDiv.firstElementChild);
    
    setTimeout(() => {
      const modal = document.getElementById(`confirmModal-${uniqueId}`);
      const btnOK = document.getElementById(`btnOK-${uniqueId}`);
      const btnCancel = document.getElementById(`btnCancel-${uniqueId}`);
      
      if (!modal || !btnOK || !btnCancel) {
        console.error('Modal elements not found!');
        resolve(false);
        return;
      }
      
      const cleanup = () => {
        if (modal && modal.parentNode) {
          modal.remove();
        }
      };
      
      btnOK.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('✅ Delete confirmed');
        cleanup();
        resolve(true);
      });
      
      btnCancel.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('❌ Delete cancelled');
        cleanup();
        resolve(false);
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          console.log('❌ Delete cancelled (background click)');
          cleanup();
          resolve(false);
        }
      });
      
      btnOK.focus();
    }, 50);
  });
}

function escape(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default { init, render };
