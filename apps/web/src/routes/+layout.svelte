<script lang="ts">
import "../app.css";
import { Toaster } from "svelte-sonner";

let { children } = $props();
</script>

<svelte:head>
	<title>Moxe</title>
</svelte:head>

<Toaster
	position="bottom-right"
	toastOptions={{
		style: `background: var(--ctp-surface0); color: var(--ctp-text); border: 1px solid var(--ctp-surface1);`,
	}}
/>

{@render children()}
