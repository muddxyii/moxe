import type { ITheme } from "@battlefieldduck/xterm-svelte";

export type ThemeId = string;

export interface AppTheme {
	id: ThemeId;
	label: string;
	cssVars: Record<string, string>;
	terminal: ITheme;
}

export interface CreateThemeInput {
	id: ThemeId;
	label: string;
	cssVars: Record<string, string>;
	terminal: ITheme;
}

export function createTheme(input: CreateThemeInput): AppTheme {
	return {
		id: input.id,
		label: input.label,
		cssVars: input.cssVars,
		terminal: input.terminal,
	};
}
