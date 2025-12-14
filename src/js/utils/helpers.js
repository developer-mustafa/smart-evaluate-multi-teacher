// js/utils/helpers.js

/**
 * Validates an email address format.
 * @param {string} email - The email address to validate.
 * @returns {boolean} True if the email format is valid, false otherwise.
 */
export function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Creates a debouncer function.
 * Executes the callback only after a specified delay since the last call.
 * @param {number} delay - The debounce delay in milliseconds.
 * @returns {function(function): void} A debouncer function that takes a callback.
 */
export function createDebouncer(delay) {
  let timeoutId;
  return (callback) => {
    if (typeof callback !== 'function') {
      console.warn('Debouncer called without a valid callback.');
      return;
    }
    clearTimeout(timeoutId);
    timeoutId = setTimeout(callback, delay);
  };
}

/**
 * Cleans Bengali text (removes BOM, normalizes Unicode, trims whitespace).
 * @param {string} text - The input text.
 * @returns {string} The cleaned and normalized text.
 */
export function ensureBengaliText(text) {
  if (typeof text !== 'string') return String(text || ''); // Return empty string for null/undefined
  // Remove potential Byte Order Mark (BOM) and normalize Unicode
  return text
    .replace(/^\uFEFF/, '')
    .normalize('NFC')
    .trim();
}

/**
 * Converts English digits (0-9) in a string to Bengali digits (০-৯).
 * Handles numbers and strings containing numbers.
 * @param {number|string|null|undefined} numberInput - The input.
 * @returns {string} The string with Bengali digits, or empty string for null/undefined.
 */
export function convertToBanglaNumber(numberInput) {
  const numberString = String(numberInput ?? ''); // Handle null/undefined
  if (!numberString) return '';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return numberString.replace(/\d/g, (digit) => banglaDigits[parseInt(digit, 10)] ?? digit);
}

/**
 * Converts a rank number to its Bengali ordinal form (e.g., 1 -> ১ম, 11 -> ১১তম).
 * @param {number} number - The rank number.
 * @returns {string} The Bengali ordinal rank string.
 */
export function convertToBanglaRank(number) {
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) return convertToBanglaNumber(number);

  const specialRanks = {
    1: '১ম',
    2: '২য়',
    3: '৩য়',
    4: '৪র্থ',
    5: '৫ম',
    6: '৬ষ্ঠ',
    7: '৭ম',
    8: '৮ম',
    9: '৯ম',
    10: '১০ম',
  };

  return specialRanks[number] || `${convertToBanglaNumber(number)}তম`;
}

/**
 * Formats file size in bytes into a human-readable string (KB, MB, GB).
 * @param {number} bytes - The file size in bytes.
 * @returns {string} The formatted file size string.
 */
export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 Bytes';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, sizes.length - 1);
  const size = parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(2));
  return `${size} ${sizes[unitIndex]}`;
}

/**
 * Truncates text to a specified maximum length, adding ellipsis if truncated.
 * @param {string} text - The text to truncate.
 * @param {number} maxLength - The maximum allowed length (ellipsis included).
 * @returns {string} The truncated text.
 */
export function truncateText(text, maxLength) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLength) {
    return text;
  }
  const effectiveMaxLength = Math.max(maxLength - 3, 0);
  return text.substring(0, effectiveMaxLength) + '...';
}

/**
 * Determines a student's performance level based on their average score (percentage).
 * @param {number} score - The average score (0-100).
 * @returns {string} The performance level description in Bengali.
 */
export function getStudentPerformanceLevel(score) {
  if (typeof score !== 'number' || isNaN(score)) return 'স্কোর নেই';
  if (score >= 90) return '🏆 অসাধারণ';
  if (score >= 80) return '✅ অত্যন্ত ভালো';
  if (score >= 70) return '👍 ভালো';
  if (score >= 60) return '✔️ সন্তোষজনক';
  if (score >= 50) return '💡 মোটামুটি';
  if (score >= 40) return '⚠️ সাধারণ';
  return '❌ দুর্বল';
}

/**
 * Gets the Tailwind CSS text color class based on the performance score.
 * @param {number} score - The performance score (0-100).
 * @returns {string} Tailwind text color class.
 */
export function getPerformanceColorClass(score) {
  if (typeof score !== 'number' || isNaN(score)) return 'text-gray-500 dark:text-gray-400';
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-orange-500 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Gets the Tailwind CSS background color class based on the performance score.
 * @param {number} score - The performance score (0-100).
 * @returns {string} Tailwind background color class.
 */
export function getPerformanceBgClass(score) {
  if (typeof score !== 'number' || isNaN(score)) return 'bg-gray-400 dark:bg-gray-600';
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Formats a Firestore timestamp, JavaScript Date object, or date string into a readable Bengali date.
 * @param {object|Date|string|null|undefined} timestamp - Input timestamp/date.
 * @returns {string} Formatted date string (e.g., '২৩ অক্টোবর ২০২৫') or 'N/A'.
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';

  let date;
  try {
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (timestamp && typeof timestamp.seconds === 'number') {
      // Firestore Timestamp
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string') {
      // Attempt to parse string
      date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        console.warn(`formatTimestamp: Invalid date string received: ${timestamp}`);
        return 'অবৈধ তারিখ';
      }
    } else {
      console.warn(`formatTimestamp: Invalid input type: ${typeof timestamp}`);
      return 'অবৈধ তারিখ';
    }

    if (isNaN(date.getTime())) {
      console.warn(`formatTimestamp: Resulting date is invalid.`);
      return 'অবৈধ তারিখ';
    }

    return new Intl.DateTimeFormat('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch (e) {
    console.error('Error formatting date:', timestamp, e);
    return 'তারিখ ত্রুটি';
  }
}

/**
 * Adds an event listener safely, checking if the element exists and handler is a function.
 * @param {Element|null} element - The DOM element.
 * @param {string} event - The event name (e.g., 'click').
 * @param {function} handler - The event handler function.
 * @param {boolean|object} [options=false] - Event listener options.
 */
export function addListener(element, event, handler, options = false) {
  if (element instanceof Element && typeof handler === 'function') {
    element.addEventListener(event, handler, options);
  } else if (!element) {
    // console.warn(`addListener: Element not found for event "${event}".`); // Can be noisy
  } else if (typeof handler !== 'function') {
    console.warn(`addListener: Invalid handler provided for element and event "${event}".`, element);
  }
}

/**
 * Gets the Bengali text for a student role.
 * @param {string} role - The role key (e.g., 'leader', 'member').
 * @returns {string} The Bengali role text.
 */
export function getStudentRoleText(role) {
  const roles = {
    leader: 'টিম লিডার',
    'team-leader': 'টিম লিডার',
    'co-leader': 'কো-লিডার',
    member: 'সদস্য',
    monitor: 'মনিটর',
    'resource-manager': 'রিসোর্স ম্যানেজার',
    'time-keeper': 'টাইম কিপার',
    'peace-maker': 'পিস মেকার',
    reporter: 'রিপোর্টার',
    facilitator: 'ফ্যাসিলিটেটর',
  };
  return roles[role] || role || 'সদস্য';
}

