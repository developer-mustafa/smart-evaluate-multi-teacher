// js/components/classManagement.js

import uiManager from '../managers/uiManager.js';
import stateManager from '../managers/stateManager.js';
import { addDocument, updateDocument, deleteDocument } from '../services/dataService.js';
import { loadClasses, loadSections, loadSubjects } from '../services/dataService.js';

class ClassManagement {
  constructor() {
    this.container = null;
    this.initialized = false;
    this.editingId = null;
    this.editingType = null; // 'class', 'section', 'subject'
  }

  init() {
    if (this.initialized) return;
    this.container = document.getElementById('page-class-management');
    if (!this.container) {
      console.warn('page-class-management container not found');
      return;
    }

    console.log('ClassManagement initialized.');
    this.initialized = true;
  }

  async render() {
    if (!this.container) return;
    
    // Check permission (Super Admin only)
    const user = stateManager.get('currentUserData');
    if (!user || user.type !== 'super-admin') {
      this.container.innerHTML = '<div class="text-center text-red-500 mt-10 p-6">⚠️ শুধুমাত্র সুপার এডমিন ক্লাস ম্যানেজমেন্ট দেখতে পারবেন।</div>';
      return;
    }

    this.container.innerHTML = this._getHTML();
    this._attachListeners();
    this._renderList();
  }

  _getHTML() {
    return `
      <div class="max-w-7xl mx-auto">
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">ক্লাস ম্যানেজমেন্ট</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">ক্লাস, শাখা, বিষয়, সেশন পরিচালনা করুন</p>
          </div>
          <button id="btnAddClass" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
            <i class="fas fa-plus"></i>নতুন ক্লাস
          </button>
        </div>
        <div id="classList" class="space-y-4"></div>
      </div>

      <!-- Modal -->
      <div id="classModal" class="fixed inset-0 z-[9999] hidden bg-black/50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 id="modalTitle" class="text-xl font-bold text-gray-900 dark:text-white">নতুন ক্লাস</h3>
            <button id="btnCloseModal" type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <form id="classForm" class="p-6 space-y-4">
            <!-- Name Field -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">নাম *</label>
              <input id="inputName" name="name" type="text" required class="form-input w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="নাম লিখুন">
            </div>

            <!-- Code Field (for classes only) -->
            <div id="codeField">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">কোড</label>
              <input id="inputCode" name="code" type="text" class="form-input w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="যেমন: IX, X, XI">
            </div>

            <!-- Academic Session Field (for classes only) -->
            <div id="sessionField">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">সেশন</label>
              <input id="inputSession" name="session" type="text" class="form-input w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="যেমন: ২০২৪-২০২৫">
            </div>

            <!-- Section Field (for subjects only) -->
            <div id="sectionField" class="hidden">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">শাখা (ঐচ্ছিক)</label>
              <select id="inputSection" name="sectionId" class="form-select w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500">
                <option value="">শাখা নির্বাচন করুন</option>
              </select>
              <p class="text-xs text-gray-500 mt-1">নির্দিষ্ট শাখার জন্য হলে সিলেক্ট করুন, অন্যথায় ফাঁকা রাখুন (পুরো ক্লাসের জন্য)।</p>
            </div>

            <div class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button type="button" id="btnCancelForm" class="flex-1 px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors">
                বাতিল
              </button>
              <button type="submit" id="btnSubmitForm" class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm">
                সংরক্ষণ
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  _attachListeners() {
    const btn = document.getElementById('btnAddClass');
    if (btn) {
      btn.addEventListener('click', () => this._openModal('class'));
    }

    document.getElementById('classForm')?.addEventListener('submit', (e) => this._handleSubmit(e));
    document.getElementById('btnCloseModal')?.addEventListener('click', () => this._closeModal());
    document.getElementById('btnCancelForm')?.addEventListener('click', () => this._closeModal());
    document.getElementById('classModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'classModal') this._closeModal();
    });

    // Event delegation for dynamic buttons
    const list = document.getElementById('classList');
    if (list) {
      list.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;
        const classId = target.dataset.classid; // Note: lowercase 'classid' in dataset

        console.log('🔵 Button clicked:', { action, id, classId });

        if (action === 'editClass') this._openModal('class', id);
        else if (action === 'deleteClass') this._deleteClass(id);
        else if (action === 'addSection') {
          console.log('🔵 Add section for classId:', classId);
          this._openModal('section', null, classId);
        }
        else if (action === 'deleteSection') this._deleteSection(id);
        else if (action === 'addSubject') {
          console.log('🔵 Add subject for classId:', classId);
          this._openModal('subject', null, classId);
        }
        else if (action === 'deleteSubject') this._deleteSubject(id);
      });
    }
  }

  _renderList() {
    const classes = stateManager.get('classes') || [];
    const sections = stateManager.get('sections') || [];
    const subjects = stateManager.get('subjects') || [];
    const list = document.getElementById('classList');
    if (!list) return;

    if (classes.length === 0) {
      list.innerHTML = '<div class="text-center py-16 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"><i class="fas fa-school text-5xl mb-4 opacity-30"></i><p class="text-lg">কোনো ক্লাস পাওয়া যায়নি</p></div>';
      return;
    }

    list.innerHTML = classes.map(cls => {
      const classSections = sections.filter(s => s.classId === cls.id);
      const classSubjects = subjects.filter(s => s.classId === cls.id);

      return `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200">${this._escape(cls.name)}</h3>
            <div class="flex gap-2">
              <button data-action="editClass" data-id="${cls.id}" class="px-3 py-1.5 rounded text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"><i class="fas fa-edit mr-1"></i>এডিট</button>
              <button data-action="deleteClass" data-id="${cls.id}" class="px-3 py-1.5 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"><i class="fas fa-trash mr-1"></i>ডিলিট</button>
            </div>
          </div>
          <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase">শাখা (${classSections.length})</h4>
                <button data-action="addSection" data-classid="${cls.id}" class="text-xs px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 rounded"><i class="fas fa-plus mr-1"></i>যোগ করুন</button>
              </div>
              <div class="space-y-2">
                ${classSections.length ? classSections.map(sec => `
                  <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded border border-gray-100 dark:border-gray-700">
                    <span class="text-sm font-medium dark:text-gray-200">${this._escape(sec.name)}</span>
                    <button data-action="deleteSection" data-id="${sec.id}" class="text-red-500 hover:text-red-700 text-xs"><i class="fas fa-times"></i></button>
                  </div>
                `).join('') : '<p class="text-xs text-gray-400 italic">কোনো শাখা নেই</p>'}
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase">বিষয় (${classSubjects.length})</h4>
                <button data-action="addSubject" data-classid="${cls.id}" class="text-xs px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 rounded"><i class="fas fa-plus mr-1"></i>যোগ করুন</button>
              </div>
              <div class="space-y-2">
                ${classSubjects.length ? classSubjects.map(sub => {
                  const sectionName = sub.sectionId ? (sections.find(s => s.id === sub.sectionId)?.name || '') : '';
                  return `
                  <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded border border-gray-100 dark:border-gray-700">
                    <div class="flex flex-col">
                        <span class="text-sm font-medium dark:text-gray-200">${this._escape(sub.name)}</span>
                        ${sectionName ? `<span class="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded w-fit mt-0.5">${this._escape(sectionName)}</span>` : ''}
                    </div>
                    <button data-action="deleteSubject" data-id="${sub.id}" class="text-red-500 hover:text-red-700 text-xs"><i class="fas fa-times"></i></button>
                  </div>
                `;
                }).join('') : '<p class="text-xs text-gray-400 italic">কোনো বিষয় নেই</p>'}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  _openModal(type, id = null, classId = null) {
    console.log('🔵 Opening modal:', { type, id, classId });
    
    this.editingType = type;
    this.editingId = id;
    this.editingClassId = classId;

    const titles = { class: 'ক্লাস', section: 'শাখা', subject: 'বিষয়' };
    const placeholders = { class: 'ক্লাসের নাম', section: 'শাখার নাম', subject: 'বিষয়ের নাম' };
    
    document.getElementById('modalTitle').textContent = id ? `${titles[type]} এডিট করুন` : `নতুন ${titles[type]}`;
    document.getElementById('inputName').placeholder = placeholders[type];
    
    // Show/hide code, session, and section fields based on type
    const codeField = document.getElementById('codeField');
    const sessionField = document.getElementById('sessionField');
    const sectionField = document.getElementById('sectionField');
    const inputSection = document.getElementById('inputSection');
    
    if (type === 'class') {
      codeField.classList.remove('hidden');
      sessionField.classList.remove('hidden');
      sectionField.classList.add('hidden');
    } else if (type === 'subject') {
      codeField.classList.add('hidden');
      sessionField.classList.add('hidden');
      sectionField.classList.remove('hidden');
      
      // Populate Section Dropdown
      const sections = stateManager.get('sections') || [];
      const relevantSections = sections.filter(s => s.classId === classId);
      
      inputSection.innerHTML = '<option value="">শাখা নির্বাচন করুন (ঐচ্ছিক)</option>' + 
        relevantSections.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    } else {
      codeField.classList.add('hidden');
      sessionField.classList.add('hidden');
      sectionField.classList.add('hidden');
    }
    
    if (id) {
      // Load existing data
      let item;
      if (type === 'class') item = stateManager.get('classes').find(c => c.id === id);
      else if (type === 'section') item = stateManager.get('sections').find(s => s.id === id);
      else if (type === 'subject') item = stateManager.get('subjects').find(s => s.id === id);
      
      document.getElementById('inputName').value = item?.name || '';
      document.getElementById('inputCode').value = item?.code || '';
      document.getElementById('inputSession').value = item?.session || '';
      
      if (type === 'subject' && inputSection) {
          inputSection.value = item?.sectionId || '';
      }
    } else {
      document.getElementById('inputName').value = '';
      document.getElementById('inputCode').value = '';
      document.getElementById('inputSession').value = '';
      if (inputSection) inputSection.value = '';
    }
    
    document.getElementById('classModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('inputName').focus(), 100);
  }

  _closeModal() {
    document.getElementById('classModal').classList.add('hidden');
    this.editingType = null;
    this.editingId = null;
    this.editingClassId = null;
  }

  async _handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🔵 Form submit triggered');
    
    // Use FormData to properly read form values
    const formData = new FormData(e.target);
    const name = (formData.get('name') || '').trim();
    const code = (formData.get('code') || '').trim();
    const session = (formData.get('session') || '').trim();
    const sectionId = (formData.get('sectionId') || '').trim(); // Get sectionId
    
    console.log('🔵 Form values (FormData):', { name, code, session, sectionId });
    
    if (!name) {
      console.log('❌ Name validation failed - name is empty!');
      uiManager.showToast('নাম প্রয়োজন', 'warning');
      return;
    }

    // --- Duplicate Check ---
    const type = this.editingType;
    const editingId = this.editingId;
    const editingClassId = this.editingClassId;
    
    const collectionName = type === 'class' ? 'classes' : type === 'section' ? 'sections' : 'subjects';
    const existingItems = stateManager.get(collectionName) || [];
    
    const isDuplicate = existingItems.some(item => {
        // Skip self if editing
        if (editingId && item.id === editingId) return false;
        
        // Check name match (case-insensitive)
        if (item.name.trim().toLowerCase() === name.toLowerCase()) {
             // For sections/subjects, also check if they belong to the same class
             if (type !== 'class' && item.classId === editingClassId) {
                 // For subjects, also check if section matches (or both are null)
                 if (type === 'subject') {
                     const itemSection = item.sectionId || '';
                     const newSection = sectionId || '';
                     return itemSection === newSection;
                 }
                 return true;
             }
             if (type === 'class') return true;
        }
        return false;
    });

    if (isDuplicate) {
        uiManager.showToast('এই নামের ' + (type === 'class' ? 'ক্লাস' : type === 'section' ? 'শাখা' : 'বিষয়') + ' ইতিমধ্যে বিদ্যমান!', 'warning');
        return;
    }
    // -----------------------

    uiManager.showLoading('সংরক্ষণ হচ্ছে...');

    try {
      const type = this.editingType;
      const editingId = this.editingId;
      const editingClassId = this.editingClassId;

      if (editingId) {
        // Update existing
        const collection = type === 'class' ? 'classes' : type === 'section' ? 'sections' : 'subjects';
        
        const updateData = { name };
        if (code) updateData.code = code;
        if (session) updateData.session = session;
        if (type === 'subject') updateData.sectionId = sectionId || null; // Update sectionId
        
        await updateDocument(collection, editingId, updateData);
        uiManager.showToast('আপডেট সফল', 'success');
      } else {
        // Create new
        const data = { name, createdAt: new Date().toISOString() };
        
        if (code) data.code = code;
        if (session) data.session = session;
        if (type !== 'class') data.classId = editingClassId;
        if (type === 'subject' && sectionId) data.sectionId = sectionId; // Save sectionId

        
        const collection = type === 'class' ? 'classes' : type === 'section' ? 'sections' : 'subjects';
        await addDocument(collection, data);
        uiManager.showToast('তৈরি সফল', 'success');
      }

      // Reload data
      const [classes, sections, subjects] = await Promise.all([
        loadClasses(),
        loadSections(),
        loadSubjects()
      ]);
      
      stateManager.update({ classes, sections, subjects });
      this._closeModal();
      this._renderList();
    } catch (error) {
      console.error('❌ Error saving:', error);
      uiManager.showToast('সংরক্ষণ ব্যর্থ: ' + error.message, 'error');
    } finally {
      uiManager.hideLoading();
    }
  }

  async _deleteClass(id) {
    console.log('🔴 _deleteClass called with ID:', id);
    
    const classes = stateManager.get('classes');
    const classItem = classes.find(c => c.id === id);
    const className = classItem?.name || 'এই ক্লাস';
    
    // Use custom confirmation instead of window.confirm
    const confirmed = await this._showConfirmDialog(
      className + ' ডিলিট করুন',
      'এই ক্লাস এবং সকল শাখা/বিষয় ডিলিট হবে। আপনি কি নিশ্চিত?'
    );
    
    console.log('🔴 User confirmed:', confirmed);
    
    if (!confirmed) {
      console.log('🔴 User cancelled delete');
      return;
    }

    console.log('🔴 Starting delete process...');
    uiManager.showLoading('ডিলিট হচ্ছে...');

    try {
      const sections = stateManager.get('sections').filter(s => s.classId === id);
      const subjects = stateManager.get('subjects').filter(s => s.classId === id);

      console.log('🔴 Deleting:', { class: id, sections: sections.length, subjects: subjects.length });

      await deleteDocument('classes', id);
      await Promise.all([
        ...sections.map(s => deleteDocument('sections', s.id)),
        ...subjects.map(s => deleteDocument('subjects', s.id))
      ]);

      const [classes, sectionsData, subjectsData] = await Promise.all([
        loadClasses(),
        loadSections(),
        loadSubjects()
      ]);
      
      stateManager.update({ classes, sections: sectionsData, subjects: subjectsData });
      uiManager.showToast('ডিলিট সফল', 'success');
      this._renderList();
      console.log('✅ Delete successful');
    } catch (error) {
      console.error('❌ Error deleting:', error);
      uiManager.showToast('ডিলিট ব্যর্থ', 'error');
    } finally {
      uiManager.hideLoading();
    }
  }

  async _deleteSection(id) {
    const sections = stateManager.get('sections');
    const section = sections.find(s => s.id === id);
    const sectionName = section?.name || 'এই শাখা';
    
    const confirmed = await this._showConfirmDialog(
      sectionName + ' ডিলিট করুন',
      'আপনি কি নিশ্চিত?'
    );
    if (!confirmed) return;

    uiManager.showLoading('ডিলিট হচ্ছে...');

    try {
      await deleteDocument('sections', id);
      const sections = await loadSections();
      stateManager.set('sections', sections);
      uiManager.showToast('শাখা ডিলিট হয়েছে', 'success');
      this._renderList();
    } catch (error) {
      console.error('Error deleting section:', error);
      uiManager.showToast('ডিলিট ব্যর্থ', 'error');
    } finally {
      uiManager.hideLoading();
    }
  }

  async _deleteSubject(id) {
    const subjects = stateManager.get('subjects');
    const subject = subjects.find(s => s.id === id);
    const subjectName = subject?.name || 'এই বিষয়';
    
    const confirmed = await this._showConfirmDialog(
      subjectName + ' ডিলিট করুন',
      'আপনি কি নিশ্চিত?'
    );
    if (!confirmed) return;

    uiManager.showLoading('ডিলিট হচ্ছে...');

    try {
      await deleteDocument('subjects', id);
      const subjects = await loadSubjects();
      stateManager.set('subjects', subjects);
      uiManager.showToast('বিষয় ডিলিট হয়েছে', 'success');
      this._renderList();
    } catch (error) {
      console.error('Error deleting subject:', error);
      uiManager.showToast('ডিলিট ব্যর্থ', 'error');
    } finally {
      uiManager.hideLoading();
    }
  }

  _showConfirmDialog(title, message) {
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
      
      // Wait for DOM to be ready
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


  _escape(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const classManagementInstance = new ClassManagement();

export function init() {
  classManagementInstance.init();
  return { render: () => classManagementInstance.render() };
}

export default classManagementInstance;
