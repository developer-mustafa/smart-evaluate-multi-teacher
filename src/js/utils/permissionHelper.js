// js/utils/permissionHelper.js

import stateManager from '../managers/stateManager.js';
import uiManager from '../managers/uiManager.js';

/**
 * Permission Helper Utility
 * Provides centralized permission checking for the application
 */

/**
 * Get current user's permissions
 * @returns {Object} Permissions object { read, write, edit, delete }
 */
export function getUserPermissions() {
  const userData = stateManager.get('currentUserData');
  
  // Super admin has all permissions
  if (userData?.type === 'super-admin') {
    return { read: true, write: true, edit: true, delete: true };
  }
  
  // Return user's specific permissions or defaults
  return userData?.permissions || { read: true, write: false, edit: false, delete: false };
}

/**
 * Get current user type
 * @returns {string} User type: 'super-admin', 'admin', or 'user'
 */
export function getUserType() {
  const userData = stateManager.get('currentUserData');
  return userData?.type || 'user';
}

/**
 * Check if user can read data
 * @returns {boolean}
 */
export function canRead() {
  const permissions = getUserPermissions();
  return permissions.read === true;
}

/**
 * Check if user can write/create new data
 * @returns {boolean}
 */
export function canWrite() {
  const permissions = getUserPermissions();
  return permissions.write === true;
}

/**
 * Check if user can edit existing data
 * @returns {boolean}
 */
export function canEdit() {
  const permissions = getUserPermissions();
  return permissions.edit === true;
}

/**
 * Check if user can delete data
 * @returns {boolean}
 */
export function canDelete() {
  const permissions = getUserPermissions();
  return permissions.delete === true;
}

/**
 * Generic permission checker
 * @param {string} action - 'read', 'write', 'edit', or 'delete'
 * @returns {boolean}
 */
export function hasPermission(action) {
  const permissions = getUserPermissions();
  return permissions[action] === true;
}

/**
 * Enforce permission - show error and return false if no permission
 * @param {string} action - 'read', 'write', 'edit', or 'delete'
 * @param {string} customMessage - Optional custom error message
 * @returns {boolean} True if has permission, false otherwise
 */
export function enforcePermission(action, customMessage = null) {
  if (!hasPermission(action)) {
    const messages = {
      read: 'আপনার এই তথ্য দেখার অনুমতি নেই।',
      write: 'আপনার নতুন তথ্য যোগ করার অনুমতি নেই।',
      edit: 'আপনার তথ্য সম্পাদনা করার অনুমতি নেই।',
      delete: 'আপনার তথ্য মুছে ফেলার অনুমতি নেই।',
    };
    
    const message = customMessage || messages[action] || 'আপনার এই কাজ করার অনুমতি নেই।';
    uiManager.showToast(message, 'warning');
    return false;
  }
  return true;
}

/**
 * Check if user is super admin
 * @returns {boolean}
 */
export function isSuperAdmin() {
  return getUserType() === 'super-admin';
}

/**
 * Check if user is admin or super admin
 * @returns {boolean}
 */
export function isAdmin() {
  const userType = getUserType();
  return userType === 'admin' || userType === 'super-admin';
}

/**
 * Check if user is regular user
 * @returns {boolean}
 */
export function isRegularUser() {
  return getUserType() === 'user';
}

/**
 * Check if user is a teacher
 * @returns {boolean}
 */
export function isTeacher() {
  return getUserType() === 'teacher';
}

/**
 * Check if user can manage teachers (Super Admin only)
 * @returns {boolean}
 */
export function canManageTeachers() {
  return isSuperAdmin();
}

/**
 * Check if user can manage classes (Super Admin only)
 * @returns {boolean}
 */
export function canManageClasses() {
  return isSuperAdmin();
}

/**
 * Override canDelete to ensure only super-admin can delete
 * Teachers and lower roles cannot delete
 * @returns {boolean}
 */
export function canDeleteOverride() {
  return isSuperAdmin();
}

/**
 * Get permission summary as text
 * @returns {string}
 */
export function getPermissionSummary() {
  const permissions = getUserPermissions();
  const userType = getUserType();
  
  const typeLabels = {
    'super-admin': 'সুপার অ্যাডমিন',
    'admin': 'অ্যাডমিন',
    'user': 'ব্যবহারকারী'
  };
  
  let summary = `আপনার ধরন: ${typeLabels[userType] || userType}\n`;
  summary += `অনুমতি: `;
  
  const allowed = [];
  if (permissions.read) allowed.push('দেখা');
  if (permissions.write) allowed.push('যোগ করা');
  if (permissions.edit) allowed.push('সম্পাদনা');
  if (permissions.delete) allowed.push('মুছে ফেলা');
  
  summary += allowed.length > 0 ? allowed.join(', ') : 'কোনটিই নয়';
  
  return summary;
}

/**
 * Helper to conditionally render UI elements based on permission
 * @param {HTMLElement} element - DOM element to show/hide
 * @param {string} requiredPermission - Required permission: 'write', 'edit', or 'delete'
 */
export function toggleElementByPermission(element, requiredPermission) {
  if (!element) return;
  
  const hasRequiredPermission = hasPermission(requiredPermission);
  
  if (hasRequiredPermission) {
    element.classList.remove('hidden');
    element.disabled = false;
  } else {
    element.classList.add('hidden');
    element.disabled = true;
  }
}

/**
 * Disable element if no permission
 * @param {HTMLElement} element - DOM element to disable
 * @param {string} requiredPermission - Required permission
 */
export function disableIfNoPermission(element, requiredPermission) {
  if (!element) return;
  
  const hasRequiredPermission = hasPermission(requiredPermission);
  
  if (!hasRequiredPermission) {
    element.disabled = true;
    element.classList.add('opacity-50', 'cursor-not-allowed');
    element.title = 'আপনার এই কাজ করার অনুমতি নেই';
  } else {
    element.disabled = false;
    element.classList.remove('opacity-50', 'cursor-not-allowed');
    element.title = '';
  }
}

export default {
  getUserPermissions,
  getUserType,
  canRead,
  canWrite,
  canEdit,
  canDelete,
  hasPermission,
  enforcePermission,
  isSuperAdmin,
  isAdmin,
  isRegularUser,
  isTeacher,
  canManageTeachers,
  canManageClasses,
  canDeleteOverride,
  getPermissionSummary,
  toggleElementByPermission,
  disableIfNoPermission,
};
