// js/services/dataService.js
import { db, serverTimestamp } from '../config/firebase.js';
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, limit, writeBatch, getDoc, setDoc 
} from 'firebase/firestore';
import cacheManager from '../managers/cacheManager.js';

// --- Configuration ---
const CACHE_KEYS = {
  GROUPS: 'groups_data',
  STUDENTS: 'students_data',
  TASKS: 'tasks_data',
  EVALUATIONS: 'evaluations_data',
  ADMINS: 'admins_data',
  CLASSES: 'classes_data',
  SECTIONS: 'sections_data',
  SUBJECTS: 'subjects_data',
  TEACHERS: 'teachers_data',
};

// --- Local Utility Helpers ---
function normalizeString(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value).trim();
  return '';
}

function normalizeName(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : '';
}

function hasCachedNameConflict(cacheKey, normalizedName, excludeId = null) {
  if (!normalizedName) return false;
  const cached = cacheManager.get(cacheKey);
  if (!Array.isArray(cached) || cached.length === 0) return false;
  return cached.some((item) => {
    if (!item || (excludeId && item.id === excludeId)) return false;
    const candidate =
      typeof item.nameLower === 'string' && item.nameLower
        ? item.nameLower
        : normalizeName(item.name);
    return candidate === normalizedName;
  });
}

// --- NEW: Server Metadata Updater ---
/**
 * ডাটাবেজে কোনো পরিবর্তন হলে এই ফাংশনটি সার্ভারের 
 * 'settings/status' ডকুমেন্ট আপডেট করবে।
 * এতে অন্য ইউজারদের অ্যাপ বুঝবে যে নতুন ডাটা এসেছে।
 */
async function updateServerMetadata() {
  try {
    const metaRef = doc(db, 'settings', 'status');
    // lastUpdated ফিল্ডে বর্তমান সময় সেট করা হচ্ছে
    await setDoc(metaRef, { lastUpdated: Date.now() }, { merge: true });
    console.log('🔄 Server metadata updated (Sync Triggered).');
  } catch (e) {
    console.error('Failed to update server metadata:', e);
    // মেটাডাটা আপডেট ফেল করলেও আমরা এরর থ্রো করব না, যাতে মেইন অপারেশন ঠিক থাকে
  }
}

// --- Generic Helper Functions ---
async function loadData(collectionName, cacheKey, options = {}) {
  const fetchFunction = async () => {
    try {
      let q = collection(db, collectionName);
      if (options.orderByField) {
        q = query(q, orderBy(options.orderByField, options.orderByDirection || 'asc'));
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`❌ Error loading ${collectionName}:`, error);
      throw new Error(`Failed to load ${collectionName}. Check connection/permissions.`);
    }
  };

  return await cacheManager.getSmartData(cacheKey, fetchFunction);
}

// --- Generic CRUD Operations (exported for direct use) ---

export async function addDocument(collectionName, data, cacheKey = null) {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (cacheKey) {
      cacheManager.clear(cacheKey);
    }
    await updateServerMetadata();

    console.log(`✅ Document added to ${collectionName} (${docRef.id})`);
    return docRef.id;
  } catch (error) {
    console.error(`❌ Error adding document to ${collectionName}:`, error);
    throw new Error(`Failed to add item to ${collectionName}.`);
  }
}

export async function updateDocument(collectionName, docId, data, cacheKey = null) {
  if (!docId) throw new Error('Document ID required for update.');
  try {
    await updateDoc(doc(db, collectionName, docId), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      
    // ১. লোকাল ক্যাশ ক্লিয়ার
    if (cacheKey) {
      cacheManager.clear(cacheKey);
    }
    // ২. সার্ভার মেটাডাটা আপডেট
    await updateServerMetadata();

    console.log(`✅ Document updated in ${collectionName} (${docId})`);
    if (collectionName === 'admins') {
      cacheManager.clear(`admin_${docId}`);
    }
  } catch (error) {
    console.error(`❌ Error updating document ${docId} in ${collectionName}:`, error);
    throw new Error(`Failed to update item in ${collectionName}.`);
  }
}

export async function deleteDocument(collectionName, docId, cacheKey = null) {
  if (!docId) throw new Error('Document ID required for deletion.');
  try {
    await deleteDoc(doc(db, collectionName, docId));
    
    // ১. লোকাল ক্যাশ ক্লিয়ার
    cacheManager.clear(cacheKey);
    // ২. সার্ভার মেটাডাটা আপডেট
    await updateServerMetadata();

    console.log(`✅ Document deleted from ${collectionName} (${docId})`);
    if (collectionName === 'admins') {
      cacheManager.clear(`admin_${docId}`);
    }
  } catch (error) {
    console.error(`❌ Error deleting document ${docId} in ${collectionName}:`, error);
    throw new Error(`Failed to delete item from ${collectionName}.`);
  }
}

// --- Backup & Restore Helpers ---

export async function restoreCollection(collectionName, dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) return;

  const batchSize = 450; 
  const chunks = [];
  
  for (let i = 0; i < dataArray.length; i += batchSize) {
    chunks.push(dataArray.slice(i, i + batchSize));
  }

  console.log(`Starting restore for ${collectionName}: ${dataArray.length} items in ${chunks.length} batches.`);

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((item) => {
      if (!item.id) return; 
      const docRef = doc(db, collectionName, item.id);
      batch.set(docRef, { ...item, updatedAt: serverTimestamp() }, { merge: true });
    });

    try {
      await batch.commit();
      console.log(`✅ Restored batch of ${chunk.length} items to ${collectionName}`);
    } catch (error) {
      console.error(`❌ Error restoring batch to ${collectionName}:`, error);
      throw new Error(`Failed to restore data to ${collectionName}.`);
    }
  }
  
  // Clear cache and update metadata once at the end
  const cacheKeyMap = {
    groups: CACHE_KEYS.GROUPS,
    students: CACHE_KEYS.STUDENTS,
    tasks: CACHE_KEYS.TASKS,
    evaluations: CACHE_KEYS.EVALUATIONS,
    admins: CACHE_KEYS.ADMINS,
    classes: CACHE_KEYS.CLASSES,
    sections: CACHE_KEYS.SECTIONS,
    subjects: CACHE_KEYS.SUBJECTS,
    teachers: CACHE_KEYS.TEACHERS,
  };
  if (cacheKeyMap[collectionName]) {
    cacheManager.clear(cacheKeyMap[collectionName]);
  }
  await updateServerMetadata();
}

export async function clearCollection(collectionName) {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    if (snapshot.empty) return;

    const batchSize = 450;
    const docs = snapshot.docs;
    const chunks = [];

    for (let i = 0; i < docs.length; i += batchSize) {
      chunks.push(docs.slice(i, i + batchSize));
    }

    console.log(`Clearing ${collectionName}: ${docs.length} items...`);

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
    
    console.log(`✅ Cleared collection ${collectionName}`);
    
    // Clear cache
    const cacheKeyMap = {
      groups: CACHE_KEYS.GROUPS,
      students: CACHE_KEYS.STUDENTS,
      classes: CACHE_KEYS.CLASSES,
      sections: CACHE_KEYS.SECTIONS,
      subjects: CACHE_KEYS.SUBJECTS,
      teachers: CACHE_KEYS.TEACHERS,
    };
    if (cacheKeyMap[collectionName]) {
      cacheManager.clear(cacheKeyMap[collectionName]);
    }
    await updateServerMetadata();

  } catch (error) {
    console.error(`❌ Error clearing collection ${collectionName}:`, error);
    throw new Error(`Failed to clear ${collectionName}.`);
  }
}

// --- Specific Data Functions (No changes needed inside these, they call the helpers above) ---

// Groups
export const loadGroups = () => loadData('groups', CACHE_KEYS.GROUPS, { orderByField: 'name' });
export const addGroup = (data = {}) => {
  const name = normalizeString(data.name);
  if (!name) throw new Error('Group name is required.');
  const payload = { ...data, name, nameLower: normalizeName(name) };
  return addDocument('groups', payload, CACHE_KEYS.GROUPS);
};
export const updateGroup = (id, data = {}) => {
  if (!id) throw new Error('Group ID required for update.');
  const payload = { ...data };
  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    const name = normalizeString(data.name);
    if (!name) throw new Error('Group name cannot be empty.');
    payload.name = name;
    payload.nameLower = normalizeName(name);
  }
  return updateDocument('groups', id, payload, CACHE_KEYS.GROUPS);
};
export const deleteGroup = (id) => deleteDocument('groups', id, CACHE_KEYS.GROUPS);

// Students
export const loadStudents = () => loadData('students', CACHE_KEYS.STUDENTS, { orderByField: 'name' });
export const addStudent = (data) => addDocument('students', data, CACHE_KEYS.STUDENTS);
export const updateStudent = (id, data) => updateDocument('students', id, data, CACHE_KEYS.STUDENTS);
export const batchUpdateStudents = async (studentIds, updateData) => {
  if (!studentIds || studentIds.length === 0) return;
  const batch = writeBatch(db);
  studentIds.forEach((id) => {
    const studentRef = doc(db, 'students', id);
    batch.update(studentRef, { ...updateData, updatedAt: serverTimestamp() });
  });
  try {
    await batch.commit();
    cacheManager.clear(CACHE_KEYS.STUDENTS);
    // Batch update এর পরেও মেটাডাটা আপডেট করতে হবে
    await updateServerMetadata(); 
    console.log(`✅ Batch updated ${studentIds.length} students.`);
  } catch (error) {
    console.error('❌ Error batch updating students:', error);
    throw new Error('Failed to update student group assignments.');
  }
};
export const deleteStudent = (id) => deleteDocument('students', id, CACHE_KEYS.STUDENTS);

// Subjects
export const updateSubject = (id, data) => updateDocument('subjects', id, data, CACHE_KEYS.SUBJECTS);
export const deleteSubject = (id) => deleteDocument('subjects', id, CACHE_KEYS.SUBJECTS);

// --- Teachers (Multi-Teacher System) ---
// loadTeachers moved below with filter support
export const addTeacher = (data) => addDocument('teachers', data, CACHE_KEYS.TEACHERS);
export const updateTeacher = (id, data) => updateDocument('teachers', id, data, CACHE_KEYS.TEACHERS);
// Soft delete - mark teacher as deleted instead of removing
export async function deleteTeacher(id) {
  await updateDocument('teachers', id, {
    deleted: true,
    deletedAt: new Date().toISOString(),
    active: false
  });
  cacheManager.clear(CACHE_KEYS.TEACHERS);
}

// Restore deleted teacher
export async function restoreTeacher(id) {
  await updateDocument('teachers', id, {
    deleted: false,
    deletedAt: null,
    active: true,
    restoredAt: new Date().toISOString()
  });
  cacheManager.clear(CACHE_KEYS.TEACHERS);
}

// Load teachers with optional filter (active/deleted/all)
export async function loadTeachers(filter = 'active') {
  const allTeachers = await loadData('teachers', CACHE_KEYS.TEACHERS, { orderByField: 'name' });
  
  if (filter === 'active') {
    return allTeachers.filter(t => !t.deleted);
  } else if (filter === 'deleted') {
    return allTeachers.filter(t => t.deleted === true);
  }
  
  return allTeachers; // 'all'
}

/**
 * Get teacher by Firebase Auth UID
 */
export async function getTeacherByUid(uid) {
  if (!uid) {
    console.warn('getTeacherByUid called without uid');
    return null;
  }
  const cacheKey = `teacher_${uid}`;
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;
  
  try {
    const docSnap = await getDoc(doc(db, 'teachers', uid));
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };
      cacheManager.set(cacheKey, data, 15); // Cache for 15 mins
      return data;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching teacher data for uid ${uid}:`, error);
    return null;
  }
}

/**
 * Load groups filtered by teacher ID
 */
export async function loadGroupsByTeacher(teacherId) {
  if (!teacherId) return [];
  try {
    const q = query(collection(db, 'groups'), where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`❌ Error loading groups for teacher ${teacherId}:`, error);
    return [];
  }
}

/**
 * Load students filtered by class and section
 */
export async function loadStudentsByClassAndSection(classId, sectionId) {
  if (!classId || !sectionId) return [];
  try {
    const q = query(
      collection(db, 'students'),
      where('classId', '==', classId),
      where('sectionId', '==', sectionId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`❌ Error loading students for class ${classId}, section ${sectionId}:`, error);
    return [];
  }
}

// Tasks
export const loadTasks = () => loadData('tasks', CACHE_KEYS.TASKS, { orderByField: 'date', orderByDirection: 'desc' });
export const addTask = (data = {}) => {
  const name = normalizeString(data.name);
  if (!name) throw new Error('Task name is required.');
  const payload = { ...data, name, nameLower: normalizeName(name) };
  return addDocument('tasks', payload, CACHE_KEYS.TASKS);
};
export const updateTask = (id, data = {}) => {
  if (!id) throw new Error('Task ID required for update.');
  const payload = { ...data };
  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    const name = normalizeString(data.name);
    if (!name) throw new Error('Task name cannot be empty.');
    payload.name = name;
    payload.nameLower = normalizeName(name);
  }
  return updateDocument('tasks', id, payload, CACHE_KEYS.TASKS);
};
export const deleteTask = (id) => deleteDocument('tasks', id, CACHE_KEYS.TASKS);

// Evaluations
export const loadEvaluations = () =>
  loadData('evaluations', CACHE_KEYS.EVALUATIONS, { orderByField: 'taskDate', orderByDirection: 'desc' });
export const addEvaluation = (data) => addDocument('evaluations', data, CACHE_KEYS.EVALUATIONS);
export const updateEvaluation = (id, data) => updateDocument('evaluations', id, data, CACHE_KEYS.EVALUATIONS);
export const deleteEvaluation = (id) => deleteDocument('evaluations', id, CACHE_KEYS.EVALUATIONS);
export const batchDeleteEvaluations = async (evaluationIds) => {
  if (!evaluationIds || evaluationIds.length === 0) return;
  const batch = writeBatch(db);
  evaluationIds.forEach((id) => {
    const evalRef = doc(db, 'evaluations', id);
    batch.delete(evalRef);
  });
  try {
    await batch.commit();
    cacheManager.clear(CACHE_KEYS.EVALUATIONS);
    await updateServerMetadata();
    console.log(`✅ Batch deleted ${evaluationIds.length} evaluations.`);
  } catch (error) {
    console.error('❌ Error batch deleting evaluations:', error);
    throw new Error('Failed to delete associated evaluations.');
  }
};
export async function getEvaluationById(id) {
  if (!id) throw new Error('Evaluation ID is required.');
  try {
    const docSnap = await getDoc(doc(db, 'evaluations', id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      console.warn(`Evaluation with ID ${id} not found.`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching evaluation ${id}:`, error);
    throw new Error('Failed to fetch evaluation details.');
  }
}

// Admins
export const loadAdmins = () => loadData('admins', CACHE_KEYS.ADMINS, { orderByField: 'email' });
export const updateAdmin = (id, data) => updateDocument('admins', id, data, CACHE_KEYS.ADMINS);
export const deleteAdmin = (id) => deleteDocument('admins', id, CACHE_KEYS.ADMINS);
export async function getAdminData(userId) {
  if (!userId) {
    console.warn('getAdminData called without userId');
    return null;
  }
  const cacheKey = `admin_${userId}`;
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;
  try {
    const docSnap = await getDoc(doc(db, 'admins', userId));
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };
      cacheManager.set(cacheKey, data, 15); // Cache admin data for 15 mins
      return data;
    } else {
      return null; 
    }
  } catch (error) {
    console.error(`❌ Error fetching admin data for user ${userId}:`, error);
    return null;
  }
}

// Classes, Sections, Subjects
export const loadClasses = () => loadData('classes', CACHE_KEYS.CLASSES, { orderByField: 'name' });
export const loadSections = () => loadData('sections', CACHE_KEYS.SECTIONS, { orderByField: 'name' });
export const loadSubjects = () => loadData('subjects', CACHE_KEYS.SUBJECTS, { orderByField: 'name' });

// --- Specific Queries ---
export async function checkStudentUniqueness(roll, academicGroup, excludeId = null) {
  const normalizedRoll = normalizeString(roll);
  const normalizedGroup = normalizeString(academicGroup);
  if (!normalizedRoll || !normalizedGroup) {
    throw new Error('Roll and Academic Group required.');
  }
  try {
    let q = query(
      collection(db, 'students'),
      where('roll', '==', normalizedRoll),
      where('academicGroup', '==', normalizedGroup),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return false;
    if (excludeId && snapshot.docs[0].id === excludeId) return false;
    return true;
  } catch (error) {
    console.error('❌ Error checking student uniqueness:', error);
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error('Firestore composite index missing: students(roll ASC, academicGroup ASC).');
      throw new Error('ডাটাবেস কনফিগারেশন প্রয়োজন (Student Index missing)।');
    }
    throw new Error('Failed to check duplicate students.');
  }
}

export const checkGroupNameExists = async (name, excludeId = null) => {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return false;
  if (hasCachedNameConflict(CACHE_KEYS.GROUPS, normalizedName, excludeId)) {
    return true;
  }
  try {
    let q = query(collection(db, 'groups'), where('nameLower', '==', normalizedName), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return false;
    if (excludeId && snapshot.docs[0].id === excludeId) return false;
    return true;
  } catch (error) {
    console.error('❌ Error checking group name uniqueness:', error);
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error('Firestore index missing: groups(nameLower ASC).');
      throw new Error('ডাটাবেস কনফিগারেশন প্রয়োজন (Group Index missing)।');
    }
    throw new Error('Failed to check duplicate group name.');
  }
};

export const checkTaskNameExists = async (name, excludeId = null) => {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return false;
  if (hasCachedNameConflict(CACHE_KEYS.TASKS, normalizedName, excludeId)) {
    return true;
  }
  try {
    let q = query(collection(db, 'tasks'), where('nameLower', '==', normalizedName), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return false;
    if (excludeId && snapshot.docs[0].id === excludeId) return false;
    return true;
  } catch (error) {
    console.error('❌ Error checking task name uniqueness:', error);
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error('Firestore index missing: tasks(nameLower ASC).');
      throw new Error('ডাটাবেস কনফিগারেশন প্রয়োজন (Task Index missing)।');
    }
    throw new Error('টাস্কের নাম যাচাই করতে সমস্যা হয়েছে।');
  }
};

// --- Global Settings ---
export const loadGlobalSettings = async () => {
  try {
    const docRef = doc(db, 'settings', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error('❌ Error loading global settings:', error);
    return null;
  }
};

export const saveGlobalSettings = async (settings) => {
  try {
    const docRef = doc(db, 'settings', 'global');
    await setDoc(docRef, {
      ...settings,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    await updateServerMetadata();
    console.log('✅ Global settings saved.');
  } catch (error) {
    console.error('❌ Error saving global settings:', error);
    throw new Error('Failed to save global settings.');
  }
};