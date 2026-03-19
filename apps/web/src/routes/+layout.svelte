<script lang="ts">
import "../app.css";
import { Toaster } from "svelte-sonner";
import { getSettingsStore } from "$lib/stores/settings.svelte";
import { applyThemeCssVars, getThemeById } from "$lib/theme/themes";

let { children } = $props();
const appVersion = import.meta.env.PUBLIC_MOXE_VERSION;
const settingsStore = getSettingsStore();

$effect(() => {
	settingsStore.initialize();
	applyThemeCssVars(getThemeById(settingsStore.theme));
});
</script>

<svelte:head>
	<title>moxe v{appVersion}</title>
</svelte:head>

<Toaster
	position="bottom-right"
	toastOptions={{
		style: `background: var(--ctp-surface0); color: var(--ctp-text); border: 1px solid var(--ctp-surface1);`,
	}}
/>

{@render children()}
