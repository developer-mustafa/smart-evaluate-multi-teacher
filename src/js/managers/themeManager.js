/**
 * Theme Manager
 * Handles application of themes and dark mode.
 */

const THEMES = {
  BLUE: 'theme-blue',
  EMERALD: 'theme-emerald',
  VIOLET: 'theme-violet',
  AMBER: 'theme-amber',
};

const DEFAULT_THEME = THEMES.BLUE;

export default {
  /**
   * Initialize theme system
   */
  init() {
    // Initial application handled by settings.js loading, 
    // but we can set up listeners or default state here if needed.
    console.log('🎨 ThemeManager initialized');
  },

  /**
   * Apply a specific color theme
   * @param {string} themeName - One of 'theme-blue', 'theme-emerald', etc.
   */
  applyTheme(themeName) {
    const root = document.documentElement;
    
    // Remove all existing theme classes
    Object.values(THEMES).forEach(t => root.classList.remove(t));

    // Validate and add new theme class
    const validTheme = Object.values(THEMES).includes(themeName) ? themeName : DEFAULT_THEME;
    root.classList.add(validTheme);
    
    console.log(`🎨 Theme applied: ${validTheme}`);
  },

  /**
   * Set dark/light mode
   * @param {boolean} isDark 
   */
  setDarkMode(isDark) {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  },

  /**
   * Get available themes
   */
  getThemes() {
    return THEMES;
  }
};
