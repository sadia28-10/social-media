// Light/dark mode with a persistent preference.
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('theme', theme);
  } catch (e) {
    /* storage unavailable (private mode): the theme still changes for this visit */
  }
  document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
