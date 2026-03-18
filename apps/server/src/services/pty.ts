import type { WriteStream } from "node:fs";
import { createWriteStream } from "node:fs";
import * as pty from "node-pty";
import { sessionStore } from "./session-store.js";

export type PtyInstance = {
	pty: pty.IPty;
	logStream: WriteStream;
	subscribers: Set<(data: string) => void>;
	alive: boolean;
	exitCode: number | null;
};

type SpawnOptions = {
	command: string;
	args: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
	logPath: string;
};

class PtyManager {
	instances: Map<string, PtyInstance> = new Map();
	outputBuffers: Map<string, string> = new Map();
	flushScheduled: Map<string, boolean> = new Map();

	spawn(agentId: string, options: SpawnOptions): PtyInstance {
		const { command, args, cwd, env, logPath } = options;

		const logStream = createWriteStream(logPath, { flags: "a" });

		const proc = pty.spawn(command, args, {
			name: "xterm-color",
			cols: 120,
			rows: 40,
			cwd,
			env,
		});

		const instance: PtyInstance = {
			pty: proc,
			logStream,
			subscribers: new Set(),
			alive: true,
			exitCode: null,
		};

		this.instances.set(agentId, instance);
		this.outputBuffers.set(agentId, "");
		this.flushScheduled.set(agentId, false);
		sessionStore.set(agentId, cwd);

		proc.onData((data: string) => {
			const current = this.outputBuffers.get(agentId) ?? "";
			this.outputBuffers.set(agentId, current + data);

			if (!this.flushScheduled.get(agentId)) {
				this.flushScheduled.set(agentId, true);
				setImmediate(() => {
					this.flush(agentId);
				});
			}
		});

		proc.onExit(({ exitCode }) => {
			instance.alive = false;
			instance.exitCode = exitCode;
			this.flush(agentId);
			sessionStore.end(agentId);
		});

		return instance;
	}

	private flush(agentId: string): void {
		const buffer = this.outputBuffers.get(agentId);
		if (!buffer) {
			this.flushScheduled.set(agentId, false);
			return;
		}

		this.outputBuffers.set(agentId, "");
		this.flushScheduled.set(agentId, false);

		const instance = this.instances.get(agentId);
		if (!instance) return;

		instance.logStream.write(buffer);

		for (const subscriber of instance.subscribers) {
			subscriber(buffer);
		}
	}

	async kill(agentId: string): Promise<void> {
		const instance = this.instances.get(agentId);
		if (!instance) return;

		const waitForDeath = (timeoutMs: number): Promise<boolean> => {
			return new Promise((resolve) => {
				const start = Date.now();
				const poll = () => {
					if (!instance.alive) {
						resolve(true);
						return;
					}
					if (Date.now() - start >= timeoutMs) {
						resolve(false);
						return;
					}
					setTimeout(poll, 50);
				};
				poll();
			});
		};

		const pid = instance.pty.pid;

		// Step 1: SIGTERM to process group
		try {
			process.kill(-pid, "SIGTERM");
		} catch {
			try {
				process.kill(pid, "SIGTERM");
			} catch {
				// process may already be gone
			}
		}

		const diedAfterTerm = await waitForDeath(2000);
		if (diedAfterTerm) return;

		// Step 2: SIGKILL
		try {
			process.kill(-pid, "SIGKILL");
		} catch {
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				// process may already be gone
			}
		}

		const diedAfterKill = await waitForDeath(5000);
		if (diedAfterKill) return;

		// Step 3: force dispose
		try {
			instance.pty.kill();
		} catch {
			// ignore
		}
		instance.alive = false;

		// Ensure session is marked ended regardless of which exit path fired.
		// onExit may also call this — SessionStore.end() is idempotent (sets endedAt once).
		sessionStore.end(agentId);
	}

	write(agentId: string, data: string): void {
		const instance = this.instances.get(agentId);
		if (instance?.alive) {
			instance.pty.write(data);
		}
	}

	subscribe(agentId: string, callback: (data: string) => void): () => void {
		const instance = this.instances.get(agentId);
		if (!instance) return () => {};

		instance.subscribers.add(callback);
		return () => {
			instance.subscribers.delete(callback);
		};
	}

	get(agentId: string): PtyInstance | null {
		return this.instances.get(agentId) ?? null;
	}

	cleanup(agentId: string): void {
		this.flush(agentId);

		const instance = this.instances.get(agentId);
		if (instance) {
			instance.logStream.end();
			instance.subscribers.clear();
		}

		this.instances.delete(agentId);
		this.outputBuffers.delete(agentId);
		this.flushScheduled.delete(agentId);
	}

	async shutdownAll(): Promise<void> {
		const agentIds = Array.from(this.instances.keys());
		// Mark all sessions as ended upfront — ensures endedAt is set even if kill() or onExit
		// fires after process teardown has begun.
		sessionStore.endAll(agentIds);
		await Promise.all(agentIds.map((id) => this.kill(id)));
		for (const id of agentIds) {
			this.cleanup(id);
		}
	}
}

export const ptyManager = new PtyManager();
