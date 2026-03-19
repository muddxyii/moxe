import { catppuccinFrappeTheme } from "$lib/theme/flavors/frappe";
import { catppuccinLatteTheme } from "$lib/theme/flavors/latte";
import { catppuccinMacchiatoTheme } from "$lib/theme/flavors/macchiato";
import { catppuccinMochaTheme } from "$lib/theme/flavors/mocha";
import type { AppTheme, ThemeId } from "./base";

export type { AppTheme, ThemeId } from "./base";

export const THEMES: AppTheme[] = [
	catppuccinLatteTheme,
	catppuccinFrappeTheme,
	catppuccinMacchiatoTheme,
	catppuccinMochaTheme,
];

export const DEFAULT_THEME_ID: ThemeId = "catppuccin-macchiato";

export function getThemeById(id: string): AppTheme {
	return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function applyThemeCssVars(theme: AppTheme): void {
	const root = document.documentElement;
	for (const [key, value] of Object.entries(theme.cssVars)) {
		root.style.setProperty(key, value);
	}
}
