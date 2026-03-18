<script lang="ts">
import type { Terminal } from "@battlefieldduck/xterm-svelte";
import { Xterm, XtermAddon } from "@battlefieldduck/xterm-svelte";
import { onMount } from "svelte";
import { terminalWsUrl } from "$lib/api";
import { catppuccinMacchiato } from "./theme";

interface Props {
	agentId: string;
}

let { agentId }: Props = $props();

let terminal: Terminal | undefined = $state();
let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let connectionStatus = $state<"connecting" | "connected" | "disconnected">(
	"connecting",
);

async function onLoad(term: Terminal) {
	const { FitAddon } = await XtermAddon.FitAddon();
	const { WebLinksAddon } = await XtermAddon.WebLinksAddon();
	const fitAddon = new FitAddon();
	const webLinksAddon = new WebLinksAddon();
	term.loadAddon(fitAddon);
	term.loadAddon(webLinksAddon);
	fitAddon.fit();
	term.focus();

	const observer = new ResizeObserver(() => fitAddon.fit());
	const el = term.element;
	if (el) observer.observe(el);

	connectWs(agentId);
}

function onData(data: string) {
	if (ws?.readyState === WebSocket.OPEN) {
		ws.send(data);
	}
}

function connectWs(id: string) {
	cleanupWs();
	connectionStatus = "connecting";
	ws = new WebSocket(terminalWsUrl(id));

	ws.onopen = () => {
		connectionStatus = "connected";
		reconnectDelay = 1000;
	};

	ws.onmessage = (event) => {
		if (!terminal || typeof event.data !== "string") return;
		try {
			const msg = JSON.parse(event.data);
			if (msg.type === "output") {
				terminal.write(msg.data);
			}
		} catch {
			terminal.write(event.data);
		}
	};

	ws.onclose = () => {
		connectionStatus = "disconnected";
		scheduleReconnect(id);
	};

	ws.onerror = () => {
		ws?.close();
	};
}

function scheduleReconnect(id: string) {
	if (reconnectTimeout) clearTimeout(reconnectTimeout);
	reconnectTimeout = setTimeout(() => {
		if (terminal) terminal.clear();
		connectWs(id);
		reconnectDelay = Math.min(reconnectDelay * 2, 10000);
	}, reconnectDelay);
}

function cleanupWs() {
	if (reconnectTimeout) {
		clearTimeout(reconnectTimeout);
		reconnectTimeout = null;
	}
	if (ws) {
		ws.onclose = null;
		ws.close();
		ws = null;
	}
}

onMount(() => {
	return () => cleanupWs();
});
</script>

<div class="relative h-full w-full">
	<Xterm
		bind:terminal
		options={{
			theme: catppuccinMacchiato,
			scrollback: 10000,
			fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
			fontSize: 13,
			cursorBlink: true,
			convertEol: true,
		}}
		{onLoad}
		{onData}
		class="h-full w-full"
	/>

	{#if connectionStatus === "connecting"}
		<div
			class="absolute inset-0 flex items-center justify-center bg-[var(--ctp-base)]/80"
		>
			<span class="text-sm text-[var(--ctp-subtext0)]">Connecting...</span>
		</div>
	{:else if connectionStatus === "disconnected"}
		<div
			class="absolute inset-0 flex items-center justify-center bg-[var(--ctp-base)]/80"
		>
			<span class="text-sm text-[var(--ctp-peach)]">Disconnected — reconnecting...</span>
		</div>
	{/if}
</div>
