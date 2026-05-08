// In-memory fallback for environments where localStorage is blocked (e.g., iOS Safari in cross-origin iframes)
const memoryStorage = new Map<string, string>();

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key) ?? memoryStorage.get(key) ?? null;
    } catch (e) {
      console.warn(`localStorage access blocked for ${key}, falling back to memory.`);
      return memoryStorage.get(key) ?? null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`localStorage access blocked for ${key}, saving to memory.`);
    }
    // Always save to memory as a reliable fallback for the current session
    memoryStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`localStorage access blocked for ${key}, removing from memory.`);
    }
    memoryStorage.delete(key);
  }
};
