import {
	DEFAULT_THEME_ID,
	getThemeById,
	type ThemeId,
} from "$lib/theme/themes";

export type { ThemeId } from "$lib/theme/themes";

const THEME_STORAGE_KEY = "moxie:settings:theme";
let theme = $state<ThemeId>(DEFAULT_THEME_ID);
let initialized = false;

function loadThemeFromStorage(): ThemeId {
	try {
		const raw = localStorage.getItem(THEME_STORAGE_KEY);
		return getThemeById(raw ?? DEFAULT_THEME_ID).id;
	} catch {
		// localStorage may be unavailable
	}
	return DEFAULT_THEME_ID;
}

function persistTheme(nextTheme: ThemeId) {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
	} catch {
		// localStorage may be unavailable
	}
}

export function getSettingsStore() {
	return {
		get theme() {
			return theme;
		},
		initialize() {
			if (initialized) return;
			initialized = true;
			theme = loadThemeFromStorage();
		},
		setTheme(nextTheme: ThemeId) {
			theme = nextTheme;
			persistTheme(nextTheme);
		},
	};
}
