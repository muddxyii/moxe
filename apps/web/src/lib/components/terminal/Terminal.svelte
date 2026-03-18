<script lang="ts">
import { onMount } from "svelte";
import { terminalWsUrl } from "$lib/api";
import { catppuccinMacchiato } from "./theme";

interface Props {
	agentId: string;
}

let { agentId }: Props = $props();

let containerEl: HTMLDivElement;
let terminal: import("@xterm/xterm").Terminal | null = null;
let fitAddon: import("@xterm/addon-fit").FitAddon | null = null;
let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let connectionStatus = $state<"connecting" | "connected" | "disconnected">(
	"connecting",
);

async function setup(id: string) {
	cleanup();
	connectionStatus = "connecting";

	const { Terminal } = await import("@xterm/xterm");
	const { FitAddon } = await import("@xterm/addon-fit");
	const { WebLinksAddon } = await import("@xterm/addon-web-links");

	await import("@xterm/xterm/css/xterm.css");

	terminal = new Terminal({
		theme: catppuccinMacchiato,
		scrollback: 10000,
		fontFamily:
			"'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
		fontSize: 13,
		cursorBlink: true,
		convertEol: true,
	});

	fitAddon = new FitAddon();
	terminal.loadAddon(fitAddon);
	terminal.loadAddon(new WebLinksAddon());

	terminal.open(containerEl);
	fitAddon.fit();

	connectWs(id);
}

function connectWs(id: string) {
	ws = new WebSocket(terminalWsUrl(id));

	ws.onopen = () => {
		connectionStatus = "connected";
		reconnectDelay = 1000;
	};

	ws.onmessage = (event) => {
		if (terminal && typeof event.data === "string") {
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
		if (terminal) {
			terminal.clear();
		}
		connectWs(id);
		reconnectDelay = Math.min(reconnectDelay * 2, 10000);
	}, reconnectDelay);
}

function cleanup() {
	if (reconnectTimeout) {
		clearTimeout(reconnectTimeout);
		reconnectTimeout = null;
	}
	if (ws) {
		ws.onclose = null;
		ws.close();
		ws = null;
	}
	if (terminal) {
		terminal.dispose();
		terminal = null;
		fitAddon = null;
	}
}

onMount(() => {
	setup(agentId);
	const observer = new ResizeObserver(() => fitAddon?.fit());
	observer.observe(containerEl);
	return () => {
		observer.disconnect();
		cleanup();
	};
});

$effect(() => {
	if (agentId) {
		setup(agentId);
	}
});
</script>

<div class="relative h-full w-full">
	<div bind:this={containerEl} class="h-full w-full"></div>

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
