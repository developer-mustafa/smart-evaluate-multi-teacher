import uiManager from '../managers/uiManager.js';

const SHOWN_ERRORS = new Set();
const formatErrorLabel = (label) => `[${label}]`;

const showUserToast = (message) => {
  const fallback = 'কিছু ত্রুটি হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।';
  try {
    uiManager?.showToast?.(message || fallback, 'error', 6000);
  } catch {
    // ignore toast failures
  }
};

export function registerGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  window.addEventListener(
    'error',
    (event) => {
      const error = event?.error;
      const key = error?.stack || error?.message || event?.message;
      if (key && SHOWN_ERRORS.has(key)) return;
      if (key) SHOWN_ERRORS.add(key);

      console.error(`${formatErrorLabel('error')} ${event?.message || error?.message || 'Unknown error'}`, error);
      showUserToast('কিছু সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    },
    { capture: true }
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason = event?.reason;
      const key = reason?.stack || reason?.message || JSON.stringify(reason);
      if (key && SHOWN_ERRORS.has(key)) return;
      if (key) SHOWN_ERRORS.add(key);

      console.error(`${formatErrorLabel('promise')} ${reason?.message || reason}`, reason);
      showUserToast('অপ্রত্যাশিত ত্রুটি হয়েছে। পরে আবার চেষ্টা করুন।');
    },
    { capture: true }
  );
}
