// js/managers/cacheManager.js
import { db } from '../config/firebase.js';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Manages caching data in localStorage to improve performance and reduce reads.
 */
class CacheManager {
  constructor(prefix = 'smart_evaluator_', defaultDurationMinutes = 5) {
    if (typeof prefix !== 'string') {
      throw new Error('CacheManager prefix must be a string.');
    }
    if (typeof defaultDurationMinutes !== 'number' || defaultDurationMinutes <= 0) {
      throw new Error('CacheManager default duration must be a positive number.');
    }

    this.PREFIX = prefix;
    this.DEFAULT_CACHE_DURATION_MS = defaultDurationMinutes * 60 * 1000;
    this.forceRefresh = false; // Flag to bypass cache for the next 'get'

    console.log(
      `CacheManager initialized with prefix "${this.PREFIX}" and default duration ${defaultDurationMinutes} minutes.`
    );
  }

  /**
   * Sets data in the cache (localStorage).
   * @param {string} key - The cache key.
   * @param {*} data - The data to cache. Should be JSON serializable.
   * @param {number|null} [customDurationMinutes=null] - Optional custom duration in minutes. Uses default if null.
   */
  set(key, data, customDurationMinutes = null) {
    if (!key || typeof key !== 'string') {
      console.warn('Cache set failed: Invalid key.', { key });
      return;
    }
    if (data === undefined) {
      console.warn(`Cache set skipped for key "${key}": Data is undefined.`);
      return;
    }

    const durationMs =
      customDurationMinutes !== null && customDurationMinutes > 0
        ? customDurationMinutes * 60 * 1000
        : this.DEFAULT_CACHE_DURATION_MS;

    const cacheEntry = {
      data,
      timestamp: Date.now(),
      expires: Date.now() + durationMs,
    };

    try {
      const serializedData = JSON.stringify(cacheEntry);
      localStorage.setItem(this.PREFIX + key, serializedData);
    } catch (e) {
      console.error(`Error setting cache for key "${key}":`, e);
      if (e.name === 'QuotaExceededError' || (e.message && e.message.toLowerCase().includes('quota'))) {
        console.warn('LocalStorage quota exceeded. Attempting to clear oldest items...');
        this.clearOldest();
        try {
          // Retry setting
          localStorage.setItem(this.PREFIX + key, JSON.stringify(cacheEntry));
          console.log(`Cache set for key: ${key} after clearing space.`);
        } catch (retryError) {
          console.error(`Failed to set cache for key "${key}" even after clearing space:`, retryError);
        }
      }
    }
  }

  /**
   * Gets data from the cache. Returns null if not found, expired, or invalid.
   * @param {string} key - The cache key.
   * @returns {*} The cached data, or null.
   */
  get(key) {
    if (!key || typeof key !== 'string') {
      console.warn('Cache get failed: Invalid key.');
      return null;
    }

    const fullKey = this.PREFIX + key;
    const cachedString = localStorage.getItem(fullKey);

    if (!cachedString) return null;

    if (this.forceRefresh) {
      console.log(`Cache force refresh triggered for key: ${key}.`);
      this.forceRefresh = false; // Reset flag
      this.clear(key);
      return null;
    }

    try {
      const cacheEntry = JSON.parse(cachedString);
      if (
        typeof cacheEntry !== 'object' ||
        cacheEntry === null ||
        !cacheEntry.hasOwnProperty('data') ||
        !cacheEntry.hasOwnProperty('expires') ||
        typeof cacheEntry.expires !== 'number'
      ) {
        console.warn(`Invalid cache structure for key: ${key}. Clearing item.`);
        localStorage.removeItem(fullKey);
        return null;
      }

      if (Date.now() > cacheEntry.expires) {
        // console.log(`Cache expired for key: ${key}. Clearing item.`);
        localStorage.removeItem(fullKey);
        return null;
      }
      return cacheEntry.data;
    } catch (e) {
      console.error(`Error parsing cache for key "${key}". Clearing item.`, e);
      localStorage.removeItem(fullKey);
      return null;
    }
  }

  /**
   * Clears a specific cache item by its key.
   * @param {string} key - The cache key (without prefix).
   */
  clear(key) {
    if (!key || typeof key !== 'string') return;
    try {
      localStorage.removeItem(this.PREFIX + key);
    } catch (e) {
      console.error(`Error clearing cache for key "${key}":`, e);
    }
  }

  /**
   * Clears ALL cache items managed by this instance (matching the prefix).
   */
  clearAll() {
    let clearedCount = 0;
    try {
      const keysToRemove = Object.keys(localStorage).filter((k) => k.startsWith(this.PREFIX));
      keysToRemove.forEach((key) => {
        localStorage.removeItem(key);
        clearedCount++;
      });
      if (clearedCount > 0) console.log(`Cleared ${clearedCount} cache items.`);
    } catch (e) {
      console.error('Error clearing all cache items:', e);
    }
  }

  /**
   * Clears the oldest cache items if the number of items exceeds a limit.
   * @param {number} [limit=50] - Max number of items before clearing.
   * @param {number} [clearCount=10] - Number of oldest items to clear.
   */
  clearOldest(limit = 50, clearCount = 10) {
    if (limit <= 0 || clearCount <= 0) return;
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(this.PREFIX));
      if (keys.length > limit) {
        console.log(`Cache limit exceeded. Clearing ${clearCount} oldest items.`);
        const itemsWithTimestamps = keys.map((key) => {
          try {
            const itemString = localStorage.getItem(key);
            const item = itemString ? JSON.parse(itemString) : null;
            return { key, timestamp: item?.timestamp || 0 };
          } catch {
            return { key, timestamp: 0 }; // Remove if corrupted
          }
        });
        itemsWithTimestamps.sort((a, b) => a.timestamp - b.timestamp); // Oldest first
        itemsWithTimestamps.slice(0, clearCount).forEach((item) => {
          localStorage.removeItem(item.key);
        });
      }
    } catch (e) {
      console.error('Error clearing oldest cache items:', e);
    }
  }

  /**
   * Sets the forceRefresh flag to true for the next `get()` call.
   */
  setForceRefresh() {
    this.forceRefresh = true;
    console.log('Cache force refresh enabled for the next get() call.');
  }

  /**
   * Smart Caching Strategy: "Metadata Check"
   * 1. Fetches a lightweight "settings/status" doc to get the server's `lastUpdated` timestamp.
   * 2. Compares it with the local cache's timestamp.
   * 3. If match: Returns cached data (ZERO heavy reads).
   * 4. If mismatch/empty: Executes `fetchFunction`, updates cache with new data AND server timestamp.
   *
   * @param {string} collectionName - The name of the collection (used as cache key).
   * @param {Function} fetchFunction - The function to fetch full data if cache is stale.
   * @returns {Promise<*>} The data (from cache or fresh fetch).
   */
  async getSmartData(collectionName, fetchFunction) {
    if (!collectionName || typeof fetchFunction !== 'function') {
      console.error('getSmartData: Invalid arguments.');
      return null;
    }

    try {
      // 1. Fetch lightweight metadata
      // Assumes a document "settings/status" exists with a "lastUpdated" timestamp field.
      const statusDoc = await getDoc(doc(db, 'settings', 'status'));
      
      let serverLastUpdated = 0;
      if (statusDoc.exists()) {
        const statusData = statusDoc.data();
        // Handle Firestore Timestamp or number/string
        if (statusData?.lastUpdated?.toMillis) {
            serverLastUpdated = statusData.lastUpdated.toMillis();
        } else if (statusData?.lastUpdated) {
            serverLastUpdated = new Date(statusData.lastUpdated).getTime();
        }
      } else {
        console.warn('SmartCache: "settings/status" doc not found. Creating it now...');
        // Auto-heal: Create the document so future checks work
        try {
            const { setDoc, doc } = await import('firebase/firestore');
            await setDoc(doc(db, 'settings', 'status'), { lastUpdated: Date.now() });
            serverLastUpdated = Date.now();
            console.log('SmartCache: Created "settings/status" with timestamp:', serverLastUpdated);
        } catch (createErr) {
            console.error('SmartCache: Failed to auto-create settings/status:', createErr);
        }
      }

      // 2. Check local cache
      const fullKey = this.PREFIX + collectionName;
      const cachedString = localStorage.getItem(fullKey);
      
      let cachedData = null;
      let cacheTimestamp = -1;

      if (cachedString && !this.forceRefresh) {
        try {
          const cacheEntry = JSON.parse(cachedString);
          if (cacheEntry && cacheEntry.serverLastUpdated) {
             cacheTimestamp = cacheEntry.serverLastUpdated;
             cachedData = cacheEntry.data;
          }
        } catch (e) {
          console.warn('SmartCache: Error parsing local cache.', e);
        }
      }

      // 3. Condition A: Timestamps match -> Return Cache
      // We use a small buffer or direct equality. Since we save the server timestamp *into* the cache, equality is expected.
      if (serverLastUpdated > 0 && serverLastUpdated === cacheTimestamp && cachedData) {
        console.log(`[SmartCache] HIT for "${collectionName}". Server: ${serverLastUpdated} === Cache: ${cacheTimestamp}`);
        return cachedData;
      }

      // 4. Condition B: Mismatch or Empty -> Fetch Fresh
      console.log(`[SmartCache] MISS for "${collectionName}". Server: ${serverLastUpdated} !== Cache: ${cacheTimestamp}. Fetching...`);
      
      const freshData = await fetchFunction();
      
      // 5. Update Cache with new Data AND the Server's Timestamp
      // We override the standard set() logic slightly to include 'serverLastUpdated'
      const cacheEntry = {
        data: freshData,
        timestamp: Date.now(), // Local time of fetch
        serverLastUpdated: serverLastUpdated, // The version of data we just fetched
        expires: Date.now() + this.DEFAULT_CACHE_DURATION_MS, // Still respect a TTL if needed, or rely purely on metadata
      };

      try {
        localStorage.setItem(fullKey, JSON.stringify(cacheEntry));
      } catch (e) {
        console.error('SmartCache: Error saving to localStorage', e);
         if (e.name === 'QuotaExceededError' || (e.message && e.message.toLowerCase().includes('quota'))) {
            this.clearOldest();
            try {
                localStorage.setItem(fullKey, JSON.stringify(cacheEntry));
            } catch(retryE) {
                console.error('SmartCache: Retry failed', retryE);
            }
         }
      }
      
      // Reset forceRefresh if it was set
      if (this.forceRefresh) this.forceRefresh = false;

      return freshData;

    } catch (error) {
      console.error(`[SmartCache] Error in getSmartData for "${collectionName}":`, error);
      // Fallback: try to execute fetchFunction anyway so app doesn't break
      return await fetchFunction();
    }
  }
}

// Export a single, ready-to-use instance
const cacheManager = new CacheManager();
export default cacheManager;
