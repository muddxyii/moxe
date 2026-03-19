import { type AppTheme, createTheme, type ThemeId } from "$lib/theme/base";

export interface CatppuccinPalette {
	rosewater: string;
	flamingo: string;
	pink: string;
	mauve: string;
	red: string;
	maroon: string;
	peach: string;
	yellow: string;
	green: string;
	teal: string;
	sky: string;
	sapphire: string;
	blue: string;
	lavender: string;
	text: string;
	subtext1: string;
	subtext0: string;
	overlay2: string;
	overlay1: string;
	overlay0: string;
	surface2: string;
	surface1: string;
	surface0: string;
	base: string;
	mantle: string;
	crust: string;
}

export function buildCatppuccinTheme(
	id: ThemeId,
	label: string,
	palette: CatppuccinPalette,
): AppTheme {
	return createTheme({
		id,
		label,
		cssVars: {
			"--ctp-rosewater": palette.rosewater,
			"--ctp-flamingo": palette.flamingo,
			"--ctp-pink": palette.pink,
			"--ctp-mauve": palette.mauve,
			"--ctp-red": palette.red,
			"--ctp-maroon": palette.maroon,
			"--ctp-peach": palette.peach,
			"--ctp-yellow": palette.yellow,
			"--ctp-green": palette.green,
			"--ctp-teal": palette.teal,
			"--ctp-sky": palette.sky,
			"--ctp-sapphire": palette.sapphire,
			"--ctp-blue": palette.blue,
			"--ctp-lavender": palette.lavender,
			"--ctp-text": palette.text,
			"--ctp-subtext1": palette.subtext1,
			"--ctp-subtext0": palette.subtext0,
			"--ctp-overlay2": palette.overlay2,
			"--ctp-overlay1": palette.overlay1,
			"--ctp-overlay0": palette.overlay0,
			"--ctp-surface2": palette.surface2,
			"--ctp-surface1": palette.surface1,
			"--ctp-surface0": palette.surface0,
			"--ctp-base": palette.base,
			"--ctp-mantle": palette.mantle,
			"--ctp-crust": palette.crust,
			"--background": "var(--ctp-base)",
			"--foreground": "var(--ctp-text)",
			"--card": "var(--ctp-surface0)",
			"--card-foreground": "var(--ctp-text)",
			"--popover": "var(--ctp-surface0)",
			"--popover-foreground": "var(--ctp-text)",
			"--primary": "var(--ctp-blue)",
			"--primary-foreground": "var(--ctp-crust)",
			"--secondary": "var(--ctp-teal)",
			"--secondary-foreground": "var(--ctp-crust)",
			"--muted": "var(--ctp-surface0)",
			"--muted-foreground": "var(--ctp-subtext0)",
			"--accent": "var(--ctp-yellow)",
			"--accent-foreground": "var(--ctp-crust)",
			"--destructive": "var(--ctp-red)",
			"--destructive-foreground": "var(--ctp-crust)",
			"--success": "var(--ctp-green)",
			"--success-foreground": "var(--ctp-crust)",
			"--warning": "var(--ctp-peach)",
			"--warning-foreground": "var(--ctp-crust)",
			"--border": "var(--ctp-surface0)",
			"--input": "var(--ctp-surface0)",
			"--ring": "var(--ctp-lavender)",
			"--sidebar": "var(--ctp-mantle)",
			"--sidebar-foreground": "var(--ctp-text)",
		},
		terminal: {
			background: palette.base,
			foreground: palette.text,
			cursor: palette.rosewater,
			cursorAccent: palette.base,
			selectionBackground: `${palette.surface2}80`,
			selectionForeground: palette.text,
			black: palette.surface1,
			red: palette.red,
			green: palette.green,
			yellow: palette.yellow,
			blue: palette.blue,
			magenta: palette.pink,
			cyan: palette.teal,
			white: palette.subtext1,
			brightBlack: palette.surface2,
			brightRed: palette.red,
			brightGreen: palette.green,
			brightYellow: palette.yellow,
			brightBlue: palette.blue,
			brightMagenta: palette.pink,
			brightCyan: palette.teal,
			brightWhite: palette.subtext0,
		},
	});
}
