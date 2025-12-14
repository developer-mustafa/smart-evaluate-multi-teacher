// js/components/admin.js

// Dependencies
let stateManager, uiManager, dataService, helpers, app, authService, permissionHelper;

// DOM Elements
const elements = {};

// Debouncer for search
let adminSearchDebouncer;

// Store ID of admin being edited
let currentEditingAdminId = null;

/**
 * Initializes the Admin component.
 * @param {object} dependencies - Passed from app.js.
 * @returns {object} - Public methods.
 */
export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  dataService = dependencies.services.dataService;
  authService = dependencies.services.auth.authServiceInstance;
  permissionHelper = dependencies.utils.permissionHelper;
  helpers = dependencies.utils;
  app = dependencies.app;

  adminSearchDebouncer = helpers.createDebouncer(300);

  _cacheDOMElements();
  _setupEventListeners();

  console.log('✅ Admin component initialized.');

  return {
    render,
  };
}

/**
 * Renders the Admin Management page.
 * Fetches admin data (only if super-admin) and renders stats + list.
 */
export async function render() {
  if (!elements.page) {
    console.error('❌ Admin render failed: Page element #page-admin-management not found.');
    return;
  }
  console.log('Rendering Admin Management page...');
  uiManager.showLoading('অ্যাডমিন তালিকা লোড হচ্ছে...');

  try {
    const currentUserData = stateManager.get('currentUserData');

    // --- Security Check ---
    // This check is also in app.js, but re-checking here is good practice.
    if (currentUserData?.type !== 'super-admin') {
      _renderStats([]); // Clear stats
      uiManager.displayEmptyMessage(elements.adminManagementContent, 'এই পেজটি দেখার জন্য আপনার অনুমতি নেই।');
      console.warn('Admin Page: Non-super-admin tried to render.');
      return;
    }

    // Fetch the list of all users/admins
    const admins = await dataService.loadAdmins();
    stateManager.set('admins', admins || []); // Ensure it's an array

    _renderStats(admins);
    _renderAdminList(); // Renders the list based on state and filters
  } catch (error) {
    console.error('❌ Error rendering admin management page:', error);
    _renderStats([]); // Clear stats on error
    uiManager.displayEmptyMessage(
      elements.adminManagementContent,
      `অ্যাডমিন তালিকা লোড করতে সমস্যা হয়েছে: ${error.message}`
    );
  } finally {
    uiManager.hideLoading();
  }
}

/**
 * Caches DOM elements for the Admin page.
 * @private
 */
function _cacheDOMElements() {
  elements.page = document.getElementById('page-admin-management');
  if (elements.page) {
    // Statistics Cards
    elements.totalUsers = elements.page.querySelector('#totalUsers');
    elements.superAdminCount = elements.page.querySelector('#superAdminCount');
    elements.adminCount = elements.page.querySelector('#adminCount');
    elements.userCount = elements.page.querySelector('#userCount');
    // Controls
    elements.adminSearchInput = elements.page.querySelector('#adminSearchInput');
    elements.addAdminBtn = elements.page.querySelector('#addAdminBtn');
    // Table Container
    elements.adminManagementContent = elements.page.querySelector('#adminManagementContent');
  } else {
    console.error('❌ Admin init failed: #page-admin-management element not found!');
  }
}

/**
 * Sets up event listeners for the Admin page.
 * @private
 */
function _setupEventListeners() {
  if (!elements.page) return;

  // Search Input
  uiManager.addListener(elements.adminSearchInput, 'input', (e) => {
    const searchTerm = e.target.value.trim();
    adminSearchDebouncer(() => {
      stateManager.updateFilters('adminManagement', { searchTerm: searchTerm.toLowerCase() });
      _renderAdminList(); // Re-render list based on search
    });
  });

  // Add Admin Button
  uiManager.addListener(elements.addAdminBtn, 'click', _handleAddAdmin);

  // Event delegation for Edit/Delete buttons in the table
  uiManager.addListener(elements.adminManagementContent, 'click', (e) => {
    const editBtn = e.target.closest('.edit-admin-btn');
    const deleteBtn = e.target.closest('.delete-admin-btn');
    const currentUserId = stateManager.get('currentUser')?.uid;

    if (editBtn) {
      _handleEditAdmin(editBtn.dataset.id);
    } else if (deleteBtn) {
      const idToDelete = deleteBtn.dataset.id;
      if (idToDelete === currentUserId) {
        uiManager.showToast('আপনি নিজের অ্যাকাউন্ট ডিলিট করতে পারবেন না।', 'warning');
        return;
      }
      _handleDeleteAdmin(idToDelete);
    }
  });
}

/**
 * Updates the statistics cards.
 * @param {Array<object>} admins - The list of all users/admins.
 * @private
 */
function _renderStats(admins = []) {
  const total = admins.length;
  const superAdmins = admins.filter((a) => a.type === 'super-admin').length;
  const normalAdmins = admins.filter((a) => a.type === 'admin').length;
  const users = admins.filter((a) => a.type === 'user').length;

  if (elements.totalUsers) elements.totalUsers.textContent = helpers.convertToBanglaNumber(total);
  if (elements.superAdminCount) elements.superAdminCount.textContent = helpers.convertToBanglaNumber(superAdmins);
  if (elements.adminCount) elements.adminCount.textContent = helpers.convertToBanglaNumber(normalAdmins);
  if (elements.userCount) elements.userCount.textContent = helpers.convertToBanglaNumber(users);
}

/**
 * Renders the list of admins/users based on state and filters.
 * @private
 */
function _renderAdminList() {
  if (!elements.adminManagementContent) return;

  const admins = stateManager.get('admins');
  const searchTerm = stateManager.getFilterSection('adminManagement')?.searchTerm || '';
  const currentUserId = stateManager.get('currentUser')?.uid;

  const filteredAdmins = (admins || []).filter((admin) => {
    if (!searchTerm) return true;
    const emailMatch = (admin.email || '').toLowerCase().includes(searchTerm);
    const typeMatch = (admin.type || '').toLowerCase().includes(searchTerm);
    return emailMatch || typeMatch;
  });

  // Sort by email
  filteredAdmins.sort((a, b) => (a.email || '').localeCompare(b.email || ''));

  uiManager.clearContainer(elements.adminManagementContent);

  if (filteredAdmins.length === 0) {
    uiManager.displayEmptyMessage(elements.adminManagementContent, 'কোনো অ্যাডমিন/ব্যবহারকারী পাওয়া যায়নি।');
    return;
  }

  // Build table HTML
  let tableHtml = `
        <div class="overflow-x-auto">
            <table class="w-full min-w-[700px] border-collapse">
                <thead>
                    <tr class="bg-gray-100 dark:bg-gray-700">
                        <th class="th">ইমেইল</th>
                        <th class="th">টাইপ</th>
                        <th class="th text-center">পারমিশন</th>
                        <th class="th text-center">কার্যক্রম</th>
                    </tr>
                </thead>
                <tbody>
    `;

  filteredAdmins.forEach((admin) => {
    const typeMap = { 'super-admin': 'সুপার অ্যাডমিন', admin: 'অ্যাডমিন', user: 'ব্যবহারকারী' };
    const typeText = typeMap[admin.type] || admin.type;
    const permissions = admin.permissions || {};
    const canDelete = admin.id !== currentUserId; // Can't delete self

    let permissionIcons = '';
    if (admin.type === 'super-admin') {
      permissionIcons = '<i class="fas fa-star text-yellow-500" title="সকল পারমিশন"></i>';
    } else if (admin.type === 'admin') {
      permissionIcons += permissions.read ? '<i class="fas fa-eye text-green-500 mx-1" title="রিড"></i>' : '';
      permissionIcons += permissions.write ? '<i class="fas fa-plus text-blue-500 mx-1" title="রাইট"></i>' : '';
      permissionIcons += permissions.edit ? '<i class="fas fa-edit text-purple-500 mx-1" title="এডিট"></i>' : '';
      permissionIcons += permissions.delete ? '<i class="fas fa-trash text-red-500 mx-1" title="ডিলিট"></i>' : '';
    } else {
      // user
      permissionIcons = permissions.read
        ? '<i class="fas fa-eye text-green-500 mx-1" title="রিড"></i>'
        : '<i class="fas fa-eye-slash text-gray-400 mx-1" title="রিড নেই"></i>';
    }

    tableHtml += `
            <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="td p-3">${admin.email}</td>
                <td class="td p-3">${typeText}</td>
                <td class="td p-3 text-center">${permissionIcons || '-'}</td>
                <td class="td p-3 text-center whitespace-nowrap">
                    <button data-id="${
                      admin.id
                    }" class="edit-admin-btn btn btn-light btn-sm p-1 mx-1" aria-label="সম্পাদনা">
                        <i class="fas fa-edit pointer-events-none"></i>
                    </button>
                    ${
                      canDelete
                        ? `
                    <button data-id="${admin.id}" class="delete-admin-btn btn btn-danger btn-sm p-1 mx-1" aria-label="ডিলিট">
                        <i class="fas fa-trash pointer-events-none"></i>
                    </button>
                    `
                        : `
                    <span class="inline-block p-1 mx-1" title="নিজেকে ডিলিট করা যাবে না">
                        <i class="fas fa-trash text-gray-400"></i>
                    </span>
                    `
                    }
                </td>
            </tr>
        `;
  });

  tableHtml += `</tbody></table></div>`;
  elements.adminManagementContent.innerHTML = tableHtml;
}

/**
 * Shows the modal for adding a new admin/user.
 * @private
 */
function _handleAddAdmin() {
  currentEditingAdminId = null; // Ensure it's null for adding
  // Pass null data, and the save handler function
  uiManager.showAdminModal('নতুন অ্যাডমিন/ব্যবহারকারী যোগ করুন', null, _saveAdminHandler);
}

/**
 * Shows the modal for editing an existing admin/user.
 * @param {string} adminId - The ID of the admin to edit.
 * @private
 */
function _handleEditAdmin(adminId) {
  // Permission check
  if (!permissionHelper?.canEdit()) {
    uiManager.showToast('আপনার admin সম্পাদনা করার অনুমতি নেই।', 'warning');
    return;
  }

  const adminData = stateManager.get('admins').find((a) => a.id === adminId);
  if (!adminData) {
    uiManager.showToast('ব্যবহারকারী খুঁজে পাওয়া যায়নি।', 'error');
    return;
  }
  currentEditingAdminId = adminId; // Set the ID for editing
  uiManager.showAdminModal('অ্যাডমিন/ব্যবহারকারী সম্পাদনা', adminData, _saveAdminHandler);
}

/**
 * Handles the delete confirmation for an admin/user.
 * @param {string} adminId - The ID of the admin to delete.
 * @private
 */
function _handleDeleteAdmin(adminId) {
  // Permission check
  if (!permissionHelper?.canDelete()) {
    uiManager.showToast('আপনার admin মুছে ফেলার অনুমতি নেই।', 'warning');
    return;
  }

  const adminData = stateManager.get('admins').find((a) => a.id === adminId);
  if (!adminData) {
    uiManager.showToast('ব্যবহারকারী খুঁজে পাওয়া যায়নি।', 'error');
    return;
  }

  // Extra safety: prevent deletion of super-admins
  if (adminData.type === 'super-admin') {
    uiManager.showToast('সুপার অ্যাডমিন অ্যাকাউন্ট ডিলিট করা যাবে না।', 'warning');
    return;
  }

  const message = `আপনি কি নিশ্চিত যে আপনি "${adminData.email}" (${adminData.type}) কে ডিলিট করতে চান? এটি শুধু Firestore থেকে ডকুমেন্ট ডিলিট করবে, Firebase Auth অ্যাকাউন্ট নয়।`;

  uiManager.showDeleteModal('ব্যবহারকারী ডিলিট নিশ্চিতকরণ', message, async () => {
    uiManager.showLoading('ডিলিট করা হচ্ছে...');
    try {
      // 1. Delete Firestore admin document
      await dataService.deleteAdmin(adminId);

      // 2. Note: Deleting the Firebase Auth user requires Admin SDK
      console.warn(
        `Firestore document for ${adminData.email} deleted. Corresponding Firebase Auth user MUST be deleted manually or via Cloud Function.`
      );
      uiManager.showToast('Firestore ডকুমেন্ট ডিলিট হয়েছে। Auth ইউজার ম্যানুয়ালি ডিলিট করুন।', 'warning', 5000);

      // 3. Refresh data
      await app.refreshAllData(); // Will re-call render()
    } catch (error) {
      console.error('❌ Error deleting admin:', error);
      uiManager.showToast(`ডিলিট করতে সমস্যা হয়েছে: ${error.message}`, 'error');
    } finally {
      uiManager.hideLoading();
    }
  });
}

/**
 * Callback function executed when the "Save" button in the admin modal is clicked.
 * Handles both adding new admins and updating existing ones.
 * @private
 */
async function _saveAdminHandler() {
  // Get data from modal form (elements cached in uiManager)
  const email = uiManager.elements.adminEmail?.value.trim();
  const password = uiManager.elements.adminPassword?.value; // Don't trim password
  const type = uiManager.elements.adminTypeSelect?.value;
  const permissions = {
    read: uiManager.elements.permissionRead?.checked || false,
    write: uiManager.elements.permissionWrite?.checked || false,
    edit: uiManager.elements.permissionEdit?.checked || false,
    delete: uiManager.elements.permissionDelete?.checked || false,
  };

  // --- Validation ---
  if (!helpers.validateEmail(email)) {
    uiManager.showToast('সঠিক ইমেইল ঠিকানা লিখুন।', 'warning');
    return;
  }
  if (!currentEditingAdminId && (!password || password.length < 6)) {
    // New admin requires password
    uiManager.showToast('নতুন ব্যবহারকারীর জন্য কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড আবশ্যক।', 'warning');
    return;
  }
  if (currentEditingAdminId && password && password.length < 6) {
    // If changing password
    uiManager.showToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।', 'warning');
    return;
  }
  // --- End Validation ---

  // Prepare data based on type
  let dataToSave = {
    email: email, // Email might be disabled, but read it anyway
    type: type,
    permissions:
      type === 'super-admin'
        ? { read: true, write: true, edit: true, delete: true }
        : type === 'admin'
        ? { read: permissions.read, write: permissions.write, edit: false, delete: false } // Admin: only read & write
        : { read: true, write: false, edit: false, delete: false }, // 'user' default
  };

  const action = currentEditingAdminId ? 'আপডেট' : 'যোগ';
  uiManager.showLoading(`ব্যবহারকারী ${action} করা হচ্ছে...`);

  try {
    if (currentEditingAdminId) {
      // --- Update Existing Admin ---
      // Only update Firestore document (type/permissions)
      // Changing auth properties (email/password) client-side is complex/insecure
      await dataService.updateAdmin(currentEditingAdminId, dataToSave);
      if (password) {
        console.warn(
          `Password change requested for ${email} but NOT PERFORMED. This requires Admin SDK or re-authentication.`
        );
        uiManager.showToast('পারমিশন আপডেট হয়েছে। পাসওয়ার্ড পরিবর্তন সমর্থিত নয়।', 'warning');
      } else {
        uiManager.showToast('ব্যবহারকারী সফলভাবে আপডেট হয়েছে।', 'success');
      }
    } else {
      // --- Add New Admin ---
      // IMPORTANT: Creating a new Firebase Auth user client-side will automatically sign in as that user,
      // logging out the current admin. This is a Firebase limitation.
      // Proper solution: Use Firebase Admin SDK (server-side) via Cloud Function.
      
      // Show warning to user
      const confirmCreate = confirm(
        `⚠️ গুরুত্বপূর্ণ নোটিশ:\n\n` +
        `নতুন admin/user তৈরি করলে আপনি স্বয়ংক্রিয়ভাবে লগআউট হয়ে যাবেন।\n` +
        `এটি Firebase এর একটি সীমাবদ্ধতা।\n\n` +
        `আপনি কি এগিয়ে যেতে চান?`
      );
      
      if (!confirmCreate) {
        uiManager.hideLoading();
        return;
      }
      
      await authService.registerWithEmail(email, password, type);
      // registerWithEmail already creates the firestore doc with default permissions for 'admin'/'user'
      // If super-admin, we might need to update permissions *after* creation
      if (type === 'super-admin') {
        // Need to find the user's UID to update the doc
        const newAdminUser = await dataService.loadAdmins(); // Re-fetch all
        const newUser = newAdminUser.find((u) => u.email === email);
        if (newUser) {
          await dataService.updateAdmin(newUser.id, { permissions: dataToSave.permissions });
        }
      }
      // authService.register shows its own success toast
      uiManager.showToast(`ব্যবহারকারী ${email} সফলভাবে তৈরি হয়েছে। আপনি স্বয়ংক্রিয়ভাবে লগআউট হয়েছেন।`, 'warning', 5000);
    }

    await app.refreshAllData(); // Refresh state
    uiManager.hideModal(uiManager.elements.adminModal);
  } catch (error) {
    console.error(`❌ Error ${action}ing admin:`, error);
    // Don't hide loading, let user see error in modal
    uiManager.showToast(`ব্যবহারকারী ${action} করতে সমস্যা: ${error.message}`, 'error');
  } finally {
    // Hide loading only if action was successful (or if error isn't shown in modal)
    // uiManager.hideLoading(); // Let's hide it regardless
    uiManager.hideLoading();
  }
}
