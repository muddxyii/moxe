<script lang="ts">
import type { Terminal } from "@battlefieldduck/xterm-svelte";
import { Xterm, XtermAddon } from "@battlefieldduck/xterm-svelte";
import { onMount } from "svelte";
import { catppuccinMacchiato } from "./theme";

interface Props {
	wsUrl: string;
	kind: "shell" | "worktree-shell" | "agent";
}

let { wsUrl, kind }: Props = $props();

let terminal: Terminal | undefined = $state();
let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let connectionStatus = $state<"connecting" | "connected" | "disconnected">(
	"connecting",
);
let processAlive = $state(true);

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

	connectWs(wsUrl);
}

function onData(data: string) {
	if (ws?.readyState === WebSocket.OPEN) {
		ws.send(data);
	}
}

function connectWs(url: string) {
	cleanupWs();
	connectionStatus = "connecting";
	processAlive = true; // optimistic reset — server will correct via status message
	ws = new WebSocket(url);

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
			} else if (msg.type === "status") {
				processAlive = msg.alive as boolean;
			}
		} catch {
			terminal.write(event.data);
		}
	};

	ws.onclose = () => {
		connectionStatus = "disconnected";
		scheduleReconnect(url);
	};

	ws.onerror = () => {
		ws?.close();
	};
}

function scheduleReconnect(url: string) {
	if (reconnectTimeout) clearTimeout(reconnectTimeout);
	reconnectTimeout = setTimeout(() => {
		if (terminal) terminal.clear();
		connectWs(url);
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

function reconnectNow() {
	if (reconnectTimeout) {
		clearTimeout(reconnectTimeout);
		reconnectTimeout = null;
	}
	if (terminal) terminal.clear();
	connectWs(wsUrl);
	reconnectDelay = 1000;
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
		<div class="absolute inset-0 flex items-center justify-center bg-[var(--ctp-base)]/80">
			<span class="text-sm text-[var(--ctp-subtext0)]">Connecting...</span>
		</div>
	{:else if connectionStatus === "disconnected"}
		<div class="absolute inset-0 flex items-center justify-center bg-[var(--ctp-base)]/80">
			<span class="text-sm text-[var(--ctp-peach)]">Disconnected — reconnecting...</span>
		</div>
	{:else if !processAlive}
		<div class="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-[var(--ctp-surface0)] border-t border-[var(--border)]">
			{#if kind === "agent"}
				<span class="text-sm text-[var(--ctp-subtext0)]">Agent process ended</span>
			{:else}
				<span class="text-sm text-[var(--ctp-subtext0)]">Shell exited</span>
				<button
					class="text-xs px-3 py-1 rounded bg-[var(--ctp-blue)] text-[var(--ctp-base)] hover:bg-[var(--ctp-sapphire)] transition-colors"
					onclick={reconnectNow}
				>
					Reconnect
				</button>
			{/if}
		</div>
	{/if}
</div>
