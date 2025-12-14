// js/components/export.js

// Dependencies
let stateManager, uiManager, dataService, helpers, app;

// DOM Elements
const elements = {};

// Column labels
const TASK_DATE_LABEL = 'তারিখ';
const EVALUATION_DATE_LABEL = 'টাস্কের তারিখ';

// Reusable labels for Evaluations CSV (Bangla, used in both single CSV and ZIP)
const EVAL_LABELS = {
  TASK_NAME: 'কাজের নাম',
  GROUP_NAME: 'গ্রুপের নাম',
  STUDENT_NAME: 'শিক্ষার্থীর নাম',
  ROLL: 'রোল',
  TASK_SCORE: 'টাস্ক স্কোর',
  TEAM_SCORE: 'টিম স্কোর',
  MCQ_SCORE: 'MCQ স্কোর',
  ADDITIONAL_SCORE: 'অতিরিক্ত স্কোর',
  TOTAL_SCORE: 'মোট স্কোর',
  MAX_SCORE: 'সর্বোচ্চ স্কোর',
  COMMENTS: 'মন্তব্য',
  ACADEMIC_GROUP: 'একাডেমিক গ্রুপ',
  STUDENT_ROLE: 'শিক্ষার্থীর দায়িত্ব',
};

// Google Drive Config
let tokenClient;
let gapiInited = false;
let gisInited = false;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
let driveAccessToken = null;

// Credentials provided by user
const GOOGLE_API_KEY = 'AIzaSyC3b1KNu4que0CR_E2ve7laRP_vC3ghYCA';
const GOOGLE_CLIENT_ID = '528853580065-9rhps4e6qhhot629gjqqiolul9a2luum.apps.googleusercontent.com';

/**
 * Initializes the Export component.
 * @param {object} dependencies - Passed from app.js.
 * @returns {object} - Public methods.
 */
export function init(dependencies) {
  stateManager = dependencies.managers.stateManager;
  uiManager = dependencies.managers.uiManager;
  dataService = dependencies.services.dataService;
  helpers = dependencies.utils;
  app = dependencies.app;

  _cacheDOMElements();
  _renderBackupRestoreUI(); // Render new UI section
  _setupEventListeners();
  _initGoogleDrive(); // Initialize Google Drive API

  console.log('✅ Export component initialized.');

  return { render };
}

/**
 * Renders the Export page (#page-export).
 */
export function render() {
  if (!elements.page) {
    console.error('❌ Export render failed: Page element #page-export not found.');
    return;
  }
  console.log('Rendering Export page...');
  _updateStats();
  _populateAssignmentFilter();
}

/**
 * Populates the assignment filter dropdown.
 * @private
 */
function _populateAssignmentFilter() {
  if (!elements.exportAssignmentFilter) return;

  const tasks = stateManager.get('tasks') || [];
  const currentVal = elements.exportAssignmentFilter.value;

  while (elements.exportAssignmentFilter.options.length > 1) {
    elements.exportAssignmentFilter.remove(1);
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateB - dateA;
  });

  sortedTasks.forEach(task => {
    const option = document.createElement('option');
    option.value = task.id;
    option.textContent = task.name;
    elements.exportAssignmentFilter.appendChild(option);
  });

  if (currentVal && Array.from(elements.exportAssignmentFilter.options).some(o => o.value === currentVal)) {
    elements.exportAssignmentFilter.value = currentVal;
  }
}

/**
 * Caches DOM elements for the Export page.
 * @private
 */
function _cacheDOMElements() {
  elements.page = document.getElementById('page-export');
  if (elements.page) {
    elements.exportStudentsCSVBtn = elements.page.querySelector('#exportStudentsCSVBtn');
    elements.exportGroupsCSVBtn = elements.page.querySelector('#exportGroupsCSVBtn');
    elements.exportEvaluationsCSVBtn = elements.page.querySelector('#exportEvaluationsCSVBtn');
    elements.exportAllDataJSONBtn = elements.page.querySelector('#exportAllDataJSONBtn');
    elements.exportAllDataZipBtn = elements.page.querySelector('#exportAllDataZipBtn');
    elements.exportGroupFullDetailsPDFBtn = elements.page.querySelector('#exportGroupFullDetailsPDFBtn');
    elements.exportAssignmentFilter = elements.page.querySelector('#exportAssignmentFilter');

    elements.totalStudentsCount = elements.page.querySelector('#totalStudentsCount');
    elements.totalGroupsCount = elements.page.querySelector('#totalGroupsCount');
    elements.totalEvaluationsCount = elements.page.querySelector('#totalEvaluationsCount');
    elements.lastExportTime = elements.page.querySelector('#lastExportTime');

    // Backup & Restore Container (will be injected)
    elements.backupRestoreContainer = elements.page.querySelector('#backupRestoreContainer');
    if (!elements.backupRestoreContainer) {
      // Create container if not exists (append to end of page)
      const container = document.createElement('div');
      container.id = 'backupRestoreContainer';
      container.className = 'mt-8';
      elements.page.appendChild(container);
      elements.backupRestoreContainer = container;
    }
  } else {
    console.error('❌ Export init failed: #page-export element not found!');
  }
}

/**
 * Renders the Backup & Restore UI section dynamically.
 * @private
 */
function _renderBackupRestoreUI() {
  if (!elements.backupRestoreContainer) return;

  elements.backupRestoreContainer.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">
          <i class="fas fa-database mr-2 text-indigo-500"></i>ব্যাকআপ এবং রিস্টোর
        </h3>
        <span class="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Advanced</span>
      </div>
      
      <div class="p-6 space-y-6">
        <!-- Local Restore -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-3">
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">লোকাল ব্যাকআপ</h4>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              আপনার সম্পূর্ণ ডেটা JSON ফাইল হিসেবে ডাউনলোড করুন অথবা আগের ব্যাকআপ থেকে রিস্টোর করুন।
            </p>
            <div class="space-y-3">
              <button id="downloadLocalBackupBtn" class="btn btn-primary w-full">
                <i class="fas fa-download mr-2"></i>ব্যাকআপ ডাউনলোড করুন (JSON)
              </button>
              
              <div class="relative">
                <div class="absolute inset-0 flex items-center" aria-hidden="true">
                  <div class="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div class="relative flex justify-center">
                  <span class="bg-white dark:bg-gray-800 px-2 text-xs text-gray-500 dark:text-gray-400">অথবা রিস্টোর করুন</span>
                </div>
              </div>

              <div class="flex gap-2">
                <input type="file" id="restoreJSONInput" accept=".json" class="hidden" />
                <button id="triggerRestoreBtn" class="btn btn-secondary w-full">
                  <i class="fas fa-upload mr-2"></i>JSON ফাইল আপলোড করুন
                </button>
              </div>
            </div>
          </div>

          <!-- Google Drive -->
          <div class="space-y-3 border-l pl-0 md:pl-6 border-gray-200 dark:border-gray-700">
            <!-- Google Drive Sync -->
            <div class="space-y-3">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Google Drive Sync</h4>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                আপনার ব্যাকআপ সেভ এবং রিস্টোর করতে কানেক্ট করুন।
              </p>
              
              <div id="gdriveAuthSection">
                <button id="gdriveConnectBtn" class="btn btn-dark w-full">
                  <i class="fab fa-google-drive mr-2"></i>Google Drive কানেক্ট করুন
                </button>
              </div>

              <div id="gdriveActionsSection" class="hidden space-y-3">
                <!-- User Info & Status -->
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <img id="gdriveUserAvatar" src="" alt="User" class="w-8 h-8 rounded-full hidden">
                      <div>
                        <p id="gdriveUserEmail" class="text-xs font-medium text-gray-700 dark:text-gray-300">Connected</p>
                        <p class="text-[10px] text-green-600 dark:text-green-400 flex items-center">
                          <i class="fas fa-circle text-[6px] mr-1"></i>Active
                        </p>
                      </div>
                    </div>
                    <button id="gdriveDisconnectBtn" class="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors" title="Disconnect">
                      <i class="fas fa-sign-out-alt"></i>
                    </button>
                  </div>
                  
                  <div class="text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between items-center">
                    <span>Last Backup:</span>
                    <span id="gdriveLastBackupTime" class="font-mono">Checking...</span>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <button id="gdriveUploadBtn" class="btn btn-success w-full text-xs">
                    <i class="fas fa-cloud-upload-alt mr-1"></i>আপলোড
                  </button>
                  <button id="gdriveRestoreBtn" class="btn btn-warning w-full text-xs">
                    <i class="fas fa-cloud-download-alt mr-1"></i>রিস্টোর
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Cache new elements
  elements.downloadLocalBackupBtn = elements.backupRestoreContainer.querySelector('#downloadLocalBackupBtn');
  elements.restoreJSONInput = elements.backupRestoreContainer.querySelector('#restoreJSONInput');
  elements.triggerRestoreBtn = elements.backupRestoreContainer.querySelector('#triggerRestoreBtn');
  elements.gdriveConnectBtn = elements.backupRestoreContainer.querySelector('#gdriveConnectBtn');
  elements.gdriveDisconnectBtn = elements.backupRestoreContainer.querySelector('#gdriveDisconnectBtn');
  elements.gdriveUploadBtn = elements.backupRestoreContainer.querySelector('#gdriveUploadBtn');
  elements.gdriveRestoreBtn = elements.backupRestoreContainer.querySelector('#gdriveRestoreBtn');
  elements.gdriveAuthSection = elements.backupRestoreContainer.querySelector('#gdriveAuthSection');
  elements.gdriveActionsSection = elements.backupRestoreContainer.querySelector('#gdriveActionsSection');
  
  // New Elements
  elements.gdriveUserAvatar = elements.backupRestoreContainer.querySelector('#gdriveUserAvatar');
  elements.gdriveUserEmail = elements.backupRestoreContainer.querySelector('#gdriveUserEmail');
  elements.gdriveLastBackupTime = elements.backupRestoreContainer.querySelector('#gdriveLastBackupTime');
}

/**
 * Sets up event listeners for all export buttons.
 * @private
 */
function _setupEventListeners() {
  if (!elements.page) return;

  // Existing Exports
  uiManager.addListener(elements.exportStudentsCSVBtn, 'click', _handleExportStudentsCSV);
  uiManager.addListener(elements.exportGroupsCSVBtn, 'click', _handleExportGroupsCSV);
  uiManager.addListener(elements.exportEvaluationsCSVBtn, 'click', _handleExportEvaluationsCSV);
  uiManager.addListener(elements.exportAllDataJSONBtn, 'click', _handleExportAllDataJSON);
  uiManager.addListener(elements.exportAllDataZipBtn, 'click', _handleExportAllDataZip);

  uiManager.addListener(elements.exportGroupFullDetailsPDFBtn, 'click', () => {
    if (app.components.analysis?.generateGroupWiseFullDetailsPDF) {
      uiManager.showToast('গ্রুপ ভিত্তিক বিস্তারিত ফলাফল PDF তৈরি হচ্ছে...', 'info');
      const filterTaskId = elements.exportAssignmentFilter ? elements.exportAssignmentFilter.value : 'all';
      app.components.analysis.generateGroupWiseFullDetailsPDF(filterTaskId);
    } else {
      uiManager.showToast('ফাংশনটি এখনো বিশ্লেষণ মডিউলে যুক্ত করা হয়নি।', 'error');
    }
  });

  // Local Restore
  if (elements.downloadLocalBackupBtn) {
    uiManager.addListener(elements.downloadLocalBackupBtn, 'click', _handleExportAllDataJSON);
  }
  if (elements.triggerRestoreBtn && elements.restoreJSONInput) {
    uiManager.addListener(elements.triggerRestoreBtn, 'click', () => elements.restoreJSONInput.click());
    uiManager.addListener(elements.restoreJSONInput, 'change', (e) => {
      const file = e.target.files[0];
      if (file) _handleRestoreJSON(file);
      e.target.value = ''; // Reset
    });
  }

  // Google Drive
  if (elements.gdriveConnectBtn) {
    uiManager.addListener(elements.gdriveConnectBtn, 'click', _handleDriveAuth);
  }
  if (elements.gdriveDisconnectBtn) {
    uiManager.addListener(elements.gdriveDisconnectBtn, 'click', _handleDriveDisconnect);
  }
  if (elements.gdriveUploadBtn) {
    uiManager.addListener(elements.gdriveUploadBtn, 'click', _handleDriveUpload);
  }
  if (elements.gdriveRestoreBtn) {
    uiManager.addListener(elements.gdriveRestoreBtn, 'click', _handleDriveRestore);
  }
}

// --- Google Drive Integration ---

function _initGoogleDrive() {
  const script1 = document.createElement('script');
  script1.src = "https://apis.google.com/js/api.js";
  script1.onload = () => {
    gapi.load('client', async () => {
      gapiInited = true;
      _checkDriveReady();
    });
  };
  document.head.appendChild(script1);

  const script2 = document.createElement('script');
  script2.src = "https://accounts.google.com/gsi/client";
  script2.onload = () => {
    gisInited = true;
    _checkDriveReady();
  };
  document.head.appendChild(script2);
}

function _checkDriveReady() {
  if (gapiInited && gisInited) {
    console.log('Google APIs loaded.');
    // Check for persisted token
    const storedToken = localStorage.getItem('gdrive_access_token');
    if (storedToken) {
      console.log('Restoring Drive session from storage...');
      driveAccessToken = storedToken;
      // Ideally we should check validity, but for now we'll assume it's valid or fail gracefully later
      // Set token for gapi if needed (though we use fetch mostly)
      // gapi.client.setToken({ access_token: storedToken }); // Removed to prevent TypeError on hard reload
      
      _updateDriveUI(true);
      _fetchUserInfo(storedToken);
      _fetchLastBackupTime(storedToken);
    }
  }
}

async function _handleDriveAuth() {
  try {
    await gapi.client.init({
      // apiKey: GOOGLE_API_KEY, // Not strictly needed when using Access Token via fetch
      discoveryDocs: [], 
    });
    
    // We will use raw fetch for Drive operations to avoid discovery doc 502 errors
    // await gapi.client.load('drive', 'v3');

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: '', // defined later
    });

    // Request access
    tokenClient.callback = async (resp) => {
      if (resp.error) {
        throw resp;
      }
      console.log('Granted Scopes:', resp.scope); // Debugging
      // Fix: hasGrantedAllScopes expects individual scopes as arguments, not a single space-separated string
      if (!google.accounts.oauth2.hasGrantedAllScopes(resp, ...SCOPES.split(' '))) {
        uiManager.showToast('Google Drive পারমিশন দেওয়া হয়নি।', 'error');
        return;
      }
      
      // Save token explicitly as requested
      driveAccessToken = resp.access_token;
      localStorage.setItem('gdrive_access_token', resp.access_token); // Persist token
      
      _updateDriveUI(true);
      uiManager.showToast('Google Drive সংযুক্ত হয়েছে!', 'success');
      
      // Fetch User Info & Last Backup
      _fetchUserInfo(resp.access_token);
      _fetchLastBackupTime(resp.access_token);
    };


    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent', scope: SCOPES });
    } else {
      tokenClient.requestAccessToken({ prompt: 'consent', scope: SCOPES }); // Force consent
    }
  } catch (err) {
    console.error('Drive Auth Error:', err);
    uiManager.showToast('Google Drive কানেকশন ব্যর্থ হয়েছে।', 'error');
  }
}

function _updateDriveUI(isConnected) {
  if (isConnected) {
    elements.gdriveAuthSection.classList.add('hidden');
    elements.gdriveActionsSection.classList.remove('hidden');
  } else {
    elements.gdriveAuthSection.classList.remove('hidden');
    elements.gdriveActionsSection.classList.add('hidden');
  }
}

function _handleDriveDisconnect() {
  uiManager.showDeleteModal(
    'Disconnect Drive?', 
    'আপনি কি নিশ্চিত যে আপনি Google Drive ডিসকানেক্ট করতে চান?', 
    () => {
      _performDisconnect();
      uiManager.showToast('Google Drive ডিসকানেক্ট করা হয়েছে।', 'info');
    }
  );
}

function _performDisconnect() {
  const token = gapi.client.getToken();
  const tokenToRevoke = token?.access_token || driveAccessToken;
  
  if (tokenToRevoke) {
    // Revoke can be async, but we don't strictly need to await it for UI update
    google.accounts.oauth2.revoke(tokenToRevoke, () => {
      console.log('Access token revoked');
    });
  }
  gapi.client.setToken(null);
  driveAccessToken = null;
  localStorage.removeItem('gdrive_access_token'); // Clear persisted token
  _updateDriveUI(false);
}

async function _fetchUserInfo(accessToken) {
  try {
    console.log('Fetching user info...');
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    
    if (response.status === 401) {
       console.warn('User info fetch 401: Token invalid. Disconnecting...');
       _performDisconnect();
       return;
    }

    if (response.ok) {
      const userData = await response.json();
      console.log('User Data received:', userData);
      
      if (elements.gdriveUserEmail) {
        elements.gdriveUserEmail.textContent = userData.email;
        // Only show toast if it's a fresh connection (heuristic: we might not want to spam on reload)
        // But for now, keeping it simple.
      }
      
      if (elements.gdriveUserAvatar) {
        elements.gdriveUserAvatar.src = userData.picture || '';
        elements.gdriveUserAvatar.classList.toggle('hidden', !userData.picture);
      }
    } else {
      console.warn('User info fetch failed:', response.status);
      // Do not show toast for background checks to avoid annoyance
    }
  } catch (error) {
    console.error('Error fetching user info:', error);
  }
}

async function _getOrCreateBackupFolder(accessToken) {
  const folderName = 'Smart Evaluate Backup System';
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
  
  try {
    // 1. Search for existing folder
    const searchResp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    
    if (searchResp.status === 401) {
        throw new Error('401 Unauthorized');
    }

    if (!searchResp.ok) throw new Error('Folder search failed');
    
    const searchData = await searchResp.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
    
    // 2. Create if not exists
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });
    
    if (!createResp.ok) throw new Error('Folder creation failed');
    
    const createData = await createResp.json();
    return createData.id;
    
  } catch (error) {
    console.error('Error getting/creating backup folder:', error);
    throw error;
  }
}

async function _fetchLastBackupTime(accessToken) {
  try {
    if (elements.gdriveLastBackupTime) elements.gdriveLastBackupTime.textContent = 'Checking...';
    
    // Get folder ID first
    let folderId;
    try {
      folderId = await _getOrCreateBackupFolder(accessToken);
    } catch (e) {
      // If folder search fails with 401, it will be caught here or in _getOrCreateBackupFolder
      // We should check if the error was due to 401
      if (e.message && e.message.includes('401')) {
         console.warn('Backup folder check 401. Disconnecting...');
         _performDisconnect();
         return;
      }
      console.warn('Could not get backup folder for checking time, falling back to root search', e);
    }

    let q = "mimeType = 'application/json' and trashed = false";
    if (folderId) {
      q += ` and '${folderId}' in parents`;
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&pageSize=1&fields=files(createdTime)`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    
    if (response.status === 401) {
        console.warn('Last backup fetch 401. Disconnecting...');
        _performDisconnect();
        return;
    }

    if (response.ok) {
      const data = await response.json();
      if (data.files && data.files.length > 0) {
        const lastTime = new Date(data.files[0].createdTime).toLocaleString('bn-BD'); // Bangla locale
        if (elements.gdriveLastBackupTime) elements.gdriveLastBackupTime.textContent = lastTime;
      } else {
        if (elements.gdriveLastBackupTime) elements.gdriveLastBackupTime.textContent = 'No backup found';
      }
    }
  } catch (error) {
    console.error('Error fetching last backup time:', error);
    if (elements.gdriveLastBackupTime) elements.gdriveLastBackupTime.textContent = 'Error';
  }
}

async function _handleDriveUpload() {
  uiManager.showLoading('Google Drive-এ আপলোড হচ্ছে...');
  try {
    const token = gapi.client.getToken();
    const accessToken = token?.access_token || driveAccessToken;

    if (!accessToken) {
      uiManager.showToast('দয়া করে আবার কানেক্ট করুন।', 'error');
      uiManager.hideLoading();
      return;
    }
    const { groups, students, tasks, evaluations, admins } = stateManager.getState();
    const allData = {
      exportDate: new Date().toISOString(),
      groups,
      students,
      tasks,
      evaluations,
      admins: stateManager.get('currentUserData')?.type === 'super-admin' ? admins : undefined,
    };
    
    const fileContent = JSON.stringify(allData, null, 2);
    const fileName = `smart_evaluator_backup_${new Date().toISOString().split('T')[0]}.json`;

    // Get or Create Folder
    const folderId = await _getOrCreateBackupFolder(accessToken);

    const file = new Blob([fileContent], { type: 'application/json' });
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId] // Save in specific folder
    };

    // const accessToken = gapi.client.getToken().access_token; // Already defined above
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
      body: form,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Drive API Error Details:', data);
      throw new Error(data.error?.message || 'Upload failed');
    }

    if (data.id) {
      uiManager.showToast('ব্যাকআপ সফলভাবে ড্রাইভে আপলোড হয়েছে!', 'success');
      // Update last backup time immediately
      _fetchLastBackupTime(accessToken);
    } else {
      throw new Error('Upload failed');
    }

  } catch (error) {
    console.error('Drive Upload Error:', error);
    uiManager.showToast('ড্রাইভে আপলোড ব্যর্থ হয়েছে।', 'error');
  } finally {
    uiManager.hideLoading();
  }
}

async function _handleDriveRestore() {
  // 1. List JSON files
  uiManager.showLoading('ব্যাকআপ ফাইল খোঁজা হচ্ছে...');
  try {
    const token = gapi.client.getToken();
    const accessToken = token?.access_token || driveAccessToken;

    if (!accessToken) {
      uiManager.showToast('দয়া করে আবার কানেক্ট করুন।', 'error');
      uiManager.hideLoading();
      return;
    }

    // Get folder ID first
    let folderId;
    try {
      folderId = await _getOrCreateBackupFolder(accessToken);
    } catch (e) {
      console.warn('Could not get backup folder for restore, falling back to root search', e);
    }

    let q = "mimeType = 'application/json' and trashed = false";
    if (folderId) {
      q += ` and '${folderId}' in parents`;
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&pageSize=10&fields=files(id, name, createdTime)`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    
    const result = await response.json();
    const files = result.files;

    if (!files || files.length === 0) {
      uiManager.showToast('কোনো ব্যাকআপ ফাইল পাওয়া যায়নি।', 'info');
      uiManager.hideLoading();
      return;
    }

    // 2. Prompt to choose file
    const latestFile = files[0];
    const confirmMsg = `সর্বশেষ ব্যাকআপ ফাইল পাওয়া গেছে:\nনাম: ${latestFile.name}\nতারিখ: ${new Date(latestFile.createdTime).toLocaleString('bn-BD')}`;
    
    uiManager.hideLoading(); // Hide loading before showing modal

    uiManager.showConfirmModal(
      'ব্যাকআপ রিস্টোর',
      confirmMsg,
      async () => {
        // Restore Logic inside callback
        uiManager.showLoading('ডেটা রিস্টোর করা হচ্ছে...');
        try {
          const fileId = latestFile.id;
          const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
          });
          
          if (!downloadResponse.ok) throw new Error('Download failed');
          
          const backupData = await downloadResponse.json();
          await _performRestore(backupData); // Await _performRestore as it's async
          uiManager.showToast('ডেটা সফলভাবে রিস্টোর হয়েছে!', 'success');
          // Update last backup time
          _fetchLastBackupTime(accessToken);
        } catch (error) {
          console.error('Restore Error:', error);
          uiManager.showToast('রিস্টোর ব্যর্থ হয়েছে।', 'error');
        } finally {
          uiManager.hideLoading();
        }
      },
      'রিস্টোর করুন',
      'btn-warning'
    );
  } catch (error) {
    console.error('Drive Restore Error:', error);
    uiManager.showToast('ড্রাইভ থেকে রিস্টোর ব্যর্থ হয়েছে।', 'error');
  } finally {
    // To avoid double-hiding or hiding prematurely, we can remove this outer hideLoading
    // or make it conditional, but for simplicity, the instruction implies it's handled by the modal flow.
    // However, if an error occurs BEFORE the modal (e.g. fetch fails), we must hide it.
    // Since hideLoading is safe to call multiple times, we will enable it here.
    uiManager.hideLoading(); 
  }
}

// --- Local Restore Logic ---

async function _handleRestoreJSON(file) {
  uiManager.showLoading('ব্যাকআপ ফাইল যাচাই করা হচ্ছে...');
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      await _performRestore(json);
    } catch (error) {
      console.error('JSON Parse Error:', error);
      uiManager.showToast('অবৈধ JSON ফাইল।', 'error');
      uiManager.hideLoading();
    }
  };
  reader.readAsText(file);
}

async function _performRestore(data) {
  uiManager.showLoading('ডেটা রিস্টোর হচ্ছে... দয়া করে অপেক্ষা করুন।');
  try {
    // Validate structure
    if (!data.students && !data.groups && !data.tasks) {
      throw new Error('ব্যাকআপ ফাইলে প্রয়োজনীয় ডেটা নেই।');
    }

    // Restore Collections sequentially
    if (data.groups) await dataService.restoreCollection('groups', data.groups);
    if (data.students) await dataService.restoreCollection('students', data.students);
    if (data.tasks) await dataService.restoreCollection('tasks', data.tasks);
    if (data.evaluations) await dataService.restoreCollection('evaluations', data.evaluations);
    if (data.admins) await dataService.restoreCollection('admins', data.admins);

    uiManager.showToast('✅ ডেটা সফলভাবে রিস্টোর হয়েছে! পেজ রিফ্রেশ হচ্ছে...', 'success');
    
    // Reload after short delay
    setTimeout(() => {
      window.location.reload();
    }, 2000);

  } catch (error) {
    console.error('Restore Error:', error);
    uiManager.showToast(`রিস্টোর ব্যর্থ: ${error.message}`, 'error');
    uiManager.hideLoading();
  }
}

// --- Existing Export Handlers (Unchanged logic, just kept for completeness) ---

function _updateStats() {
  const { students, groups, evaluations } = stateManager.getState();
  const setText = (el, val) => {
    if (el) el.textContent = helpers.convertToBanglaNumber(val);
  };

  setText(elements.totalStudentsCount, students?.length || 0);
  setText(elements.totalGroupsCount, groups?.length || 0);
  setText(elements.totalEvaluationsCount, evaluations?.length || 0);

  const lastExport = localStorage.getItem('lastExportTimestamp');
  if (elements.lastExportTime) {
    elements.lastExportTime.textContent = lastExport
      ? new Date(lastExport).toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit' })
      : '-';
  }
}

async function _handleExportStudentsCSV() {
  uiManager.showLoading('শিক্ষার্থী CSV এক্সপোর্ট হচ্ছে...');
  try {
    const students = stateManager.get('students') || [];
    const groups = stateManager.get('groups') || [];
    const groupsMap = new Map(groups.map((g) => [g.id, g.name]));

    const dataToExport = students
      .map((s) => ({
        নাম: s.name,
        রোল: s.roll,
        লিঙ্গ: s.gender,
        'একাডেমিক গ্রুপ': s.academicGroup,
        সেশন: s.session,
        যোগাযোগ: s.contact || '',
        'গ্রুপের নাম': groupsMap.get(s.groupId) || '',
        'দায়িত্ব কোড': s.role || '',
      }))
      .sort((a, b) => (a['নাম'] || '').localeCompare(b['নাম'] || '', 'bn'));

    if (dataToExport.length === 0) {
      uiManager.showToast('এক্সপোর্ট করার মতো শিক্ষার্থীর ডেটা নেই।', 'info');
      return;
    }

    const csv = Papa.unparse(dataToExport, { header: true });
    _triggerDownload(csv, 'students_export.csv', 'text/csv;charset=utf-8;');
    uiManager.showToast('শিক্ষার্থী CSV ফাইল ডাউনলোড শুরু হয়েছে।', 'success');
  } catch (error) {
    console.error('❌ Error exporting students CSV:', error);
    uiManager.showToast(`CSV এক্সপোর্ট করতে সমস্যা: ${error.message}`, 'error');
  } finally {
    uiManager.hideLoading();
    _updateLastExportTime();
  }
}

async function _handleExportGroupsCSV() {
  uiManager.showLoading('গ্রুপ CSV এক্সপোর্ট হচ্ছে...');
  try {
    const groups = stateManager.get('groups') || [];
    const students = stateManager.get('students') || [];

    const dataToExport = groups
      .map((g) => ({
        'গ্রুপের নাম': g.name,
        'শিক্ষার্থী সংখ্যা': students.filter((s) => s.groupId === g.id).length,
      }))
      .sort((a, b) => (a['গ্রুপের নাম'] || '').localeCompare(b['গ্রুপের নাম'] || '', 'bn'));

    if (dataToExport.length === 0) {
      uiManager.showToast('এক্সপোর্ট করার মতো গ্রুপের ডেটা নেই।', 'info');
      return;
    }

    const csv = Papa.unparse(dataToExport, { header: true });
    _triggerDownload(csv, 'groups_export.csv', 'text/csv;charset=utf-8;');
    uiManager.showToast('গ্রুপ CSV ফাইল ডাউনলোড শুরু হয়েছে।', 'success');
  } catch (error) {
    console.error('❌ Error exporting groups CSV:', error);
    uiManager.showToast(`CSV এক্সপোর্ট করতে সমস্যা: ${error.message}`, 'error');
  } finally {
    uiManager.hideLoading();
    _updateLastExportTime();
  }
}

async function _handleExportEvaluationsCSV() {
  uiManager.showLoading('মূল্যায়ন CSV এক্সপোর্ট হচ্ছে...');
  try {
    const evaluations = stateManager.get('evaluations') || [];
    const students = stateManager.get('students') || [];
    const tasks = stateManager.get('tasks') || [];
    const groups = stateManager.get('groups') || [];

    const studentsMap = new Map(students.map((s) => [s.id, s]));
    const tasksMap = new Map(tasks.map((t) => [t.id, t]));
    const groupsMap = new Map(groups.map((g) => [g.id, g.name]));

    const dataToExport = [];

    evaluations.forEach((ev) => {
      const task = tasksMap.get(ev.taskId);
      const groupName = groupsMap.get(ev.groupId) || ev.groupName || '';
      const taskName = task?.name || ev.taskName || '';
      const taskDate = task?.date || ev.taskDate || '';
      const { display: taskDateDisplay, sortValue: taskDateSort } = _normalizeDateForExport(taskDate);
      const maxScore =
        Number.parseFloat(ev.maxPossibleScore) ||
        Number.parseFloat(task?.maxScore) ||
        (typeof TOTAL_MAX_SCORE !== 'undefined' ? TOTAL_MAX_SCORE : '');

      if (ev?.scores && typeof ev.scores === 'object') {
        Object.entries(ev.scores).forEach(([studentId, scoreData = {}]) => {
          const student = studentsMap.get(String(studentId));
          if (!student) return;

          const row = {
            [EVAL_LABELS.TASK_NAME]: taskName,
            [EVAL_LABELS.GROUP_NAME]: groupName,
            [EVAL_LABELS.STUDENT_NAME]: student.name ?? '',
            [EVAL_LABELS.ROLL]: student.roll ?? '',
            [EVAL_LABELS.ACADEMIC_GROUP]: student.academicGroup ?? '',
            [EVAL_LABELS.STUDENT_ROLE]: student.role ?? '',
            [EVAL_LABELS.TASK_SCORE]: scoreData.taskScore ?? '',
            [EVAL_LABELS.TEAM_SCORE]: scoreData.teamScore ?? '',
            [EVAL_LABELS.MCQ_SCORE]: scoreData.mcqScore ?? '',
            [EVAL_LABELS.ADDITIONAL_SCORE]: scoreData.additionalScore ?? '',
            [EVAL_LABELS.TOTAL_SCORE]: scoreData.totalScore ?? '',
            [EVAL_LABELS.MAX_SCORE]: maxScore ?? '',
            [EVAL_LABELS.COMMENTS]: scoreData.comments ?? '',
            [EVALUATION_DATE_LABEL]: taskDateDisplay ?? '',
            __sortDate: taskDateSort ?? Number.NEGATIVE_INFINITY,
          };

          dataToExport.push(row);
        });
      }
    });

    if (dataToExport.length === 0) {
      uiManager.showToast('এক্সপোর্ট করার মতো মূল্যায়নের ডেটা নেই।', 'info');
      return;
    }

    dataToExport.sort((a, b) => {
      const diff = (b.__sortDate ?? Number.NEGATIVE_INFINITY) - (a.__sortDate ?? Number.NEGATIVE_INFINITY);
      if (diff !== 0) return diff;

      const groupDiff = String(a[EVAL_LABELS.GROUP_NAME] || '').localeCompare(
        String(b[EVAL_LABELS.GROUP_NAME] || ''),
        'bn'
      );
      if (groupDiff !== 0) return groupDiff;

      return String(a[EVAL_LABELS.ROLL] || '').localeCompare(String(b[EVAL_LABELS.ROLL] || ''), undefined, {
        numeric: true,
      });
    });

    dataToExport.forEach((row) => delete row.__sortDate);

    const csv = Papa.unparse(dataToExport, { header: true });
    _triggerDownload(csv, 'evaluations_export.csv', 'text/csv;charset=utf-8;');
    uiManager.showToast('মূল্যায়ন CSV ফাইল ডাউনলোড শুরু হয়েছে।', 'success');
  } catch (error) {
    console.error('❌ Error exporting evaluations CSV:', error);
    uiManager.showToast(`CSV এক্সপোর্ট করতে সমস্যা: ${error.message}`, 'error');
  } finally {
    uiManager.hideLoading();
    _updateLastExportTime();
  }
}

function _handleExportAllDataJSON() {
  uiManager.showLoading('JSON ফাইল তৈরি হচ্ছে...');
  try {
    const { groups, students, tasks, evaluations, admins } = stateManager.getState();
    const allData = {
      exportDate: new Date().toISOString(),
      groups,
      students,
      tasks,
      evaluations,
      admins: stateManager.get('currentUserData')?.type === 'super-admin' ? admins : undefined,
    };

    const jsonString = JSON.stringify(allData, null, 2);
    _triggerDownload(jsonString, 'smart_evaluator_backup.json', 'application/json;charset=utf-8;');
    uiManager.showToast('সমস্ত ডেটার JSON ফাইল ডাউনলোড শুরু হয়েছে।', 'success');
  } catch (error) {
    console.error('❌ Error exporting all data JSON:', error);
    uiManager.showToast(`JSON এক্সপোর্ট করতে সমস্যা: ${error.message}`, 'error');
  } finally {
    uiManager.hideLoading();
    _updateLastExportTime();
  }
}

async function _handleExportAllDataZip() {
  const JSZip = window.JSZip;
  if (!JSZip) {
    uiManager.showToast('ZIP লাইব্রেরি (JSZip) লোড করা নেই।', 'error');
    console.error('JSZip library not found. Please include it in index.html');
    return;
  }

  uiManager.showLoading('ZIP ফাইল তৈরি হচ্ছে...');
  try {
    const zip = new JSZip();
    const { groups = [], students = [], tasks = [], evaluations = [] } = stateManager.getState();
    const bom = '\uFEFF';

    // 1. Students CSV
    const groupsMap = new Map(groups.map((g) => [g.id, g.name]));
    const studentsData = students
      .map((s) => ({
        নাম: s.name,
        রোল: s.roll,
        লিঙ্গ: s.gender,
        'একাডেমিক গ্রুপ': s.academicGroup,
        সেশন: s.session,
        যোগাযোগ: s.contact || '',
        'গ্রুপের নাম': groupsMap.get(s.groupId) || '',
        'দায়িত্ব কোড': s.role || '',
      }))
      .sort((a, b) => (a['নাম'] || '').localeCompare(b['নাম'] || '', 'bn'));
    if (studentsData.length > 0) zip.file('students.csv', bom + Papa.unparse(studentsData));

    // 2. Groups CSV
    const groupsData = groups
      .map((g) => ({
        'গ্রুপের নাম': g.name,
        'শিক্ষার্থী সংখ্যা': students.filter((s) => s.groupId === g.id).length,
      }))
      .sort((a, b) => (a['গ্রুপের নাম'] || '').localeCompare(b['গ্রুপের নাম'] || '', 'bn'));
    if (groupsData.length > 0) zip.file('groups.csv', bom + Papa.unparse(groupsData));

    // 3. Tasks CSV
    const tasksData = tasks
      .map((t) => {
        const { display: taskDateDisplay, sortValue: taskDateSort } = _normalizeDateForExport(t.date);
        const row = {
          'টাস্কের নাম': t.name,
          'মোট সর্বোচ্চ স্কোর': t.maxScore,
          ব্রেকডাউন_টাস্ক: t.maxScoreBreakdown?.task,
          ব্রেকডাউন_টিম: t.maxScoreBreakdown?.team,
          ব্রেকডাউন_অতিরিক্ত: t.maxScoreBreakdown?.additional,
          ব্রেকডাউন_MCQ: t.maxScoreBreakdown?.mcq,
          বিবরণ: t.description || '',
        };
        row[TASK_DATE_LABEL] = taskDateDisplay;
        row.__sortDate = taskDateSort;
        return row;
      })
      .sort((a, b) => {
        const diff = (b.__sortDate ?? Number.NEGATIVE_INFINITY) - (a.__sortDate ?? Number.NEGATIVE_INFINITY);
        if (diff !== 0) return diff;
        return String(a['টাস্কের নাম'] || '').localeCompare(String(b['টাস্কের নাম'] || ''), 'bn');
      });
    tasksData.forEach((row) => delete row.__sortDate);
    if (tasksData.length > 0) zip.file('tasks.csv', bom + Papa.unparse(tasksData));

    // 4. Evaluations CSV (Detailed)
    const studentsMap = new Map(students.map((s) => [s.id, s]));
    const tasksMap = new Map(tasks.map((t) => [t.id, t]));
    const evaluationsData = [];

    evaluations.forEach((ev) => {
      const task = tasksMap.get(ev.taskId);
      const groupName = groupsMap.get(ev.groupId) || ev.groupName || '';
      const taskName = task?.name || ev.taskName || '';
      const taskDate = task?.date || ev.taskDate || '';
      const { display: taskDateDisplay, sortValue: taskDateSort } = _normalizeDateForExport(taskDate);
      const maxScore =
        Number.parseFloat(ev.maxPossibleScore) ||
        Number.parseFloat(task?.maxScore) ||
        (typeof TOTAL_MAX_SCORE !== 'undefined' ? TOTAL_MAX_SCORE : '');

      if (ev?.scores && typeof ev.scores === 'object') {
        Object.entries(ev.scores).forEach(([studentId, scoreData = {}]) => {
          const student = studentsMap.get(studentId);
          if (!student) return;

          const row = {
            [EVAL_LABELS.TASK_NAME]: taskName,
            [EVAL_LABELS.GROUP_NAME]: groupName,
            [EVAL_LABELS.STUDENT_NAME]: student.name ?? '',
            [EVAL_LABELS.ROLL]: student.roll ?? '',
            [EVAL_LABELS.ACADEMIC_GROUP]: student.academicGroup ?? '',
            [EVAL_LABELS.STUDENT_ROLE]: student.role ?? '',
            [EVAL_LABELS.TASK_SCORE]: scoreData.taskScore ?? '',
            [EVAL_LABELS.TEAM_SCORE]: scoreData.teamScore ?? '',
            [EVAL_LABELS.MCQ_SCORE]: scoreData.mcqScore ?? '',
            [EVAL_LABELS.ADDITIONAL_SCORE]: scoreData.additionalScore ?? '',
            [EVAL_LABELS.TOTAL_SCORE]: scoreData.totalScore ?? '',
            [EVAL_LABELS.MAX_SCORE]: maxScore ?? '',
            [EVAL_LABELS.COMMENTS]: scoreData.comments ?? '',
          };

          row[EVALUATION_DATE_LABEL] = taskDateDisplay ?? '';
          row.__sortDate = taskDateSort ?? Number.NEGATIVE_INFINITY;

          evaluationsData.push(row);
        });
      }
    });

    if (evaluationsData.length > 0) {
      evaluationsData.sort((a, b) => {
        const diff = (b.__sortDate ?? Number.NEGATIVE_INFINITY) - (a.__sortDate ?? Number.NEGATIVE_INFINITY);
        if (diff !== 0) return diff;

        const groupDiff = String(a[EVAL_LABELS.GROUP_NAME] || '').localeCompare(
          String(b[EVAL_LABELS.GROUP_NAME] || ''),
          'bn'
        );
        if (groupDiff !== 0) return groupDiff;

        return String(a[EVAL_LABELS.ROLL] || '').localeCompare(String(b[EVAL_LABELS.ROLL] || ''), undefined, {
          numeric: true,
        });
      });

      evaluationsData.forEach((row) => delete row.__sortDate);

      zip.file('evaluations_detailed.csv', bom + Papa.unparse(evaluationsData));
    }

    const content = await zip.generateAsync({ type: 'blob' });
    _triggerDownload(content, `smart_evaluator_backup_${new Date().toISOString().split('T')[0]}.zip`);
    uiManager.showToast('সমস্ত ডেটার ZIP ফাইল ডাউনলোড শুরু হয়েছে।', 'success');
  } catch (error) {
    console.error('❌ Error exporting all data ZIP:', error);
    uiManager.showToast(`ZIP এক্সপোর্ট করতে সমস্যা: ${error.message}`, 'error');
  } finally {
    uiManager.hideLoading();
    _updateLastExportTime();
  }
}

function _normalizeDateForExport(value) {
  if (value === null || value === undefined || value === '') {
    return { display: '', sortValue: Number.NEGATIVE_INFINITY };
  }

  let dateObj = null;
  if (value instanceof Date) {
    dateObj = value;
  } else if (typeof value === 'number') {
    dateObj = new Date(value);
  } else if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) dateObj = new Date(parsed);
  } else if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try {
        dateObj = value.toDate();
      } catch {
        dateObj = null;
      }
    } else if (typeof value.seconds === 'number') {
      dateObj = new Date(value.seconds * 1000);
    }
  }

  const display = helpers?.formatTimestamp
    ? helpers.formatTimestamp(dateObj || value)
    : dateObj
    ? dateObj.toISOString().split('T')[0]
    : String(value ?? '');

  let sortValue = Number.NEGATIVE_INFINITY;
  if (dateObj instanceof Date && !Number.isNaN(dateObj.getTime())) {
    sortValue = dateObj.getTime();
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    sortValue = value;
  } else if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) sortValue = parsed;
  }

  return { display: display || '', sortValue };
}

function _triggerDownload(content, fileName, contentType = '') {
  const finalContent = contentType.startsWith('text/csv') && typeof content === 'string' ? `\uFEFF${content}` : content;
  const blob = finalContent instanceof Blob ? finalContent : new Blob([finalContent], { type: contentType });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 100);
}

function _updateLastExportTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit' });
  if (elements.lastExportTime) {
    elements.lastExportTime.textContent = timeString;
  }
  localStorage.setItem('lastExportTimestamp', now.toISOString());
}
