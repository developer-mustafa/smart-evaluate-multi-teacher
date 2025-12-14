// js/services/authService.js

import { auth, googleProvider, db, serverTimestamp } from '../config/firebase.js';
import { 
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, deleteUser 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import stateManager from '../managers/stateManager.js';
import uiManager from '../managers/uiManager.js';
import { getAdminData } from './dataService.js';
import cacheManager from '../managers/cacheManager.js';

/**
 * Handles Firebase authentication and monitors auth state changes.
 */
class AuthService {
  constructor() {
    this.unsubscribeAuthStateListener = null;
    this._setupAuthStateListener();
    console.log('AuthService initialized and listener attached.');
  }

  _setupAuthStateListener() {
    if (this.unsubscribeAuthStateListener) this.unsubscribeAuthStateListener();

    this.unsubscribeAuthStateListener = onAuthStateChanged(auth,
      async (user) => {
        console.log('Auth state changed. User:', user ? user.email : 'Logged out');
        stateManager.setAuthLoading(true);
        // uiManager.showLoading('ব্যবহারকারীর অবস্থা যাচাই করা হচ্ছে...'); // Handled by app.init

        let userData = null;
        if (user) {
          try {
            // Try loading from teachers collection first
            const { getTeacherByUid } = await import('./dataService.js');
            const teacherData = await getTeacherByUid(user.uid);
            
            if (teacherData) {
              // Check if teacher account is deleted
              if (teacherData.deleted) {
                console.warn('Teacher account has been deleted:', user.email);
                await this.logout();
                uiManager.showToast('আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে। Admin এর সাথে যোগাযোগ করুন।', 'error');
                stateManager.setAuthLoading(false);
                uiManager.hideLoading();
                return;
              }
              
              // User is a teacher
              const simplifiedUser = { uid: user.uid, email: user.email, displayName: user.displayName };
              stateManager.setUser(simplifiedUser, {
                id: user.uid,
                email: user.email,
                type: 'teacher',
                permissions: teacherData.permissions || { read: true, write: true, edit: true, delete: false },
              });
              stateManager.set('currentTeacher', teacherData);
              console.log(`✅ Teacher ${user.email} logged in.`);
            } else {
              // Not a teacher, check admin
              userData = await getAdminData(user.uid);
              // Ensure userData exists, create default if not
              if (!userData) {
                console.warn(`No admin document for ${user.email}, creating default 'user' profile.`);
                const defaultData = {
                  email: user.email,
                  type: 'user',
                  permissions: { read: true, write: false, edit: false, delete: false },
                  createdAt: serverTimestamp(),
                };
                await setDoc(doc(db, 'admins', user.uid), defaultData);
                userData = { id: user.uid, ...defaultData };
                cacheManager.clear(`admin_${user.uid}`); // Clear cache after creation
              }
              const simplifiedUser = { uid: user.uid, email: user.email, displayName: user.displayName };
              stateManager.setUser(simplifiedUser, userData);
              console.log(`✅ User ${user.email} logged in. Role: ${userData.type}`);
            }
          } catch (error) {
            console.error('Auth state change - Error handling user data:', error);
            uiManager.showToast('ব্যবহারকারীর তথ্য লোড করতে সমস্যা হয়েছে।', 'error');
            const simplifiedUser = { uid: user.uid, email: user.email, displayName: user.displayName };
            stateManager.setUser(simplifiedUser, {
              id: user.uid,
              email: user.email,
              type: 'user',
              permissions: { read: true },
            }); // Fallback
          }
        } else {
          // User is logged out
          stateManager.setUser(null, null);
          cacheManager.clearAll();
          console.log('User logged out, cache cleared.');
        }
        stateManager.setAuthLoading(false);
        uiManager.hideLoading(); // Hide initial loader once auth is confirmed
        this._triggerUIUpdateCallbacks(); // Update UI
      },
      (error) => {
        console.error('Firebase Auth state listener error:', error);
        stateManager.setUser(null, null);
        stateManager.setAuthLoading(false);
        uiManager.hideLoading();
        uiManager.showToast(` प्रमाणीकरण অবস্থা যাচাই করতে ত্রুটি: ${error.message}`, 'error');
        this._triggerUIUpdateCallbacks();
      }
    );
  }

  async loginWithEmail(email, password) {
    if (!email || !password) throw new Error('ইমেইল এবং পাসওয়ার্ড প্রয়োজন।');
    if (password.length < 6) throw new Error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      uiManager.showToast(`স্বাগতম ${email}!`, 'success');
      uiManager.hideModal(uiManager.elements.authModal);
    } catch (error) {
      console.error('Login Error:', error);
      const message = this._translateAuthError(error, 'লগইন');
      uiManager.showToast(message, 'error');
      throw new Error(message);
    }
  }

  async registerWithEmail(email, password, requestedType = 'user') {
    if (!email || !password) throw new Error('ইমেইল এবং পাসওয়ার্ড প্রয়োজন।');
    if (password.length < 6) throw new Error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।');
    if (!['user', 'admin'].includes(requestedType)) requestedType = 'user';

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      let permissions = { read: true, write: false, edit: false, delete: false };
      if (requestedType === 'admin') {
        permissions = { read: true, write: true, edit: false, delete: false };
      }
      const adminData = {
        email: user.email,
        type: requestedType,
        permissions,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'admins', user.uid), adminData);
      console.log(`User registered: ${user.email}, Type: ${requestedType}, Doc created.`);
      await signOut(auth); // Force login after registration
      uiManager.showToast('রেজিস্ট্রেশন সফল! অনুগ্রহ করে লগইন করুন।', 'success');
    } catch (error) {
      console.error('Registration Error:', error);
      if (error.code !== 'auth/email-already-in-use' && auth.currentUser?.email === email) {
        try {
          await deleteUser(auth.currentUser);
        } catch (deleteError) {
          console.warn('Failed to delete partially registered auth user:', deleteError);
        }
        await signOut(auth);
      }
      const message = this._translateAuthError(error, 'রেজিস্ট্রেশন');
      uiManager.showToast(message, 'error');
      throw new Error(message);
    }
  }

  /**
   * Register a new teacher (only super-admin can call this)
   * @param {string} email - Teacher's email
   * @param {string} password - temporary password
   * @param {object} teacherData - {name, assignedClasses, assignedSections, assignedSubjects}
   */
  async registerTeacher(email, password, teacherData) {
    // Permission check
    const currentUser = stateManager.get('currentUserData');
    if (currentUser?.type !== 'super-admin') {
      throw new Error('শুধুমাত্র সুপার এডমিন শিক্ষক যুক্ত করতে পারবেন।');
    }

    if (!email || !password) throw new Error('ইমেইল এবং পাসওয়ার্ড প্রয়োজন।');
    if (password.length < 6) throw new Error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।');

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create teacher document
      const teacherDocData = {
        uid: user.uid,
        email: user.email,
        name: teacherData.name || email,
        assignedClasses: teacherData.assignedClasses || [],
        assignedSections: teacherData.assignedSections || [],
        assignedSubjects: teacherData.assignedSubjects || [],
        role: 'teacher',
        permissions: { read: true, write: true, edit: true, delete: false },
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'teachers', user.uid), teacherDocData);
      console.log(`✅ Teacher registered: ${user.email}`);

      // Force logout so the current admin doesn't lose their session
      await signOut(auth);
      
      uiManager.showToast(`শিক্ষক ${email} সফলভাবে যুক্ত হয়েছে।`, 'success');
      
      return user.uid;
    } catch (error) {
      console.error('Teacher Registration Error:', error);
      
      // Cleanup on failure
      if (error.code !== 'auth/email-already-in-use' && auth.currentUser?.email === email) {
        try {
          await deleteUser(auth.currentUser);
        } catch (deleteError) {
          console.warn('Failed to delete partially registered teacher auth user:', deleteError);
        }
        await signOut(auth);
      }
      
      const message = this._translateAuthError(error, 'শিক্ষক রেজিস্ট্রেশন');
      uiManager.showToast(message, 'error');
      throw new Error(message);
    }
  }

  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      // Ensure admin data exists (getAdminData handles creation if user is new)
      await getAdminData(user.uid);
      // Auth state listener will handle the rest
      uiManager.showToast('Google সাইন ইন সফল!', 'success');
      uiManager.hideModal(uiManager.elements.authModal);
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      const message = this._translateAuthError(error, 'Google সাইন ইন');
      uiManager.showToast(message, 'error');
      throw new Error(message);
    }
  }

  async logout() {
    try {
      await signOut(auth);
      // Auth state listener handles state update & cache clearing
      uiManager.showToast('সফলভাবে লগআউট হয়েছেন।', 'info');
    } catch (error) {
      console.error('Logout Error:', error);
      const message = this._translateAuthError(error, 'লগআউট');
      uiManager.showToast(message, 'error');
      throw new Error(message);
    }
  }

  _translateAuthError(error, context = 'প্রক্রিয়া') {
    let message = `একটি অজানা ত্রুটি ঘটেছে (${error?.code || 'UNKNOWN'})।`;
    switch (error?.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        message = 'ভুল ইমেইল অথবা পাসওয়ার্ড।';
        break;
      case 'auth/invalid-email':
        message = 'সঠিক ইমেইল ঠিকানা লিখুন।';
        break;
      case 'auth/email-already-in-use':
        message = 'এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে।';
        break;
      case 'auth/weak-password':
        message = 'পাসওয়ার্ড দুর্বল (কমপক্ষে ৬ অক্ষর)।';
        break;
      case 'auth/too-many-requests':
        message = 'অতিরিক্ত চেষ্টা, অ্যাকাউন্ট সাময়িকভাবে লক।';
        break;
      case 'auth/network-request-failed':
        message = 'নেটওয়ার্ক সমস্যা। সংযোগ পরীক্ষা করুন।';
        break;
      case 'auth/popup-closed-by-user':
        message = 'সাইন ইন পপআপ বন্ধ করা হয়েছে।';
        break;
      case 'auth/cancelled-popup-request':
      case 'auth/popup-blocked':
        message = 'সাইন ইন পপআপ ব্লক করা হয়েছে।';
        break;
      case 'auth/operation-not-allowed':
        message = 'এই সাইন ইন পদ্ধতিটি সক্রিয় নেই।';
        break;
      case 'auth/requires-recent-login':
        message = 'এই কাজের জন্য আপনাকে আবার লগইন করতে হবে।';
        break;
    }
    return `${context} ব্যর্থ হয়েছে: ${message}`;
  }

  _triggerUIUpdateCallbacks() {
    const user = stateManager.get('currentUser');
    const userData = stateManager.get('currentUserData');
    const userType = userData?.type || 'user';
    uiManager.updateUserInfo(userData);
    uiManager.enableNavigation(!!user, userType);

    const activePage = stateManager.get('activePage');
    // Use window.smartEvaluator.publicPages because 'app' might not be defined here
    const publicPages = window.smartEvaluator?.publicPages || ['dashboard'];
    if (!user && activePage && !publicPages.includes(activePage)) {
      console.log(`User logged out from private page "${activePage}", redirecting to dashboard.`);
      uiManager.showPage('dashboard');
      // Trigger dashboard render if app instance is available
      window.smartEvaluator?.components.dashboard?.render();
    }
    
    // Always refresh settings/sidebar visibility on auth change
    window.smartEvaluator?.components.settings?.applySettings();
  }
}

const authService = new AuthService();
export default authService;

// Bind methods to preserve 'this' context when called independently
export const loginWithEmail = authService.loginWithEmail.bind(authService);
export const registerWithEmail = authService.registerWithEmail.bind(authService);
export const signInWithGoogle = authService.signInWithGoogle.bind(authService);
export const logout = authService.logout.bind(authService);
