const THEME_STORAGE_KEY = 'zzuli-theme'

export type Theme = 'light' | 'dark'

export function getSavedTheme(): Theme | null {
	if (typeof localStorage === 'undefined') return null

	const value = localStorage.getItem(THEME_STORAGE_KEY)
	return value === 'dark' || value === 'light' ? value : null
}

export function getNextTheme(theme: Theme): Theme {
	return theme === 'dark' ? 'light' : 'dark'
}

export function saveTheme(theme: Theme) {
	localStorage.setItem(THEME_STORAGE_KEY, theme)
}
