import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

type SessionRecord = {
	cwd: string;
	startedAt: string;
	endedAt: string | null;
};

type SessionFile = Record<string, SessionRecord>;

const SESSION_FILE = join(homedir(), ".moxie", "shell-sessions.json");

class SessionStore {
	private data: SessionFile = {};
	private queue: Promise<void> = Promise.resolve();

	constructor() {
		try {
			const raw = readFileSync(SESSION_FILE, "utf-8");
			this.data = JSON.parse(raw) as SessionFile;
		} catch {
			// File doesn't exist yet — start empty
		}
	}

	get(sessionKey: string): SessionRecord | undefined {
		return this.data[sessionKey];
	}

	set(sessionKey: string, cwd: string): void {
		this.data[sessionKey] = {
			cwd,
			startedAt: new Date().toISOString(),
			endedAt: null,
		};
		this.enqueueFlush();
	}

	end(sessionKey: string): void {
		const record = this.data[sessionKey];
		if (record) {
			record.endedAt = new Date().toISOString();
			this.enqueueFlush();
		}
	}

	endAll(keys: string[]): void {
		const now = new Date().toISOString();
		for (const key of keys) {
			const record = this.data[key];
			if (record && record.endedAt === null) {
				record.endedAt = now;
			}
		}
		this.enqueueFlush();
	}

	private enqueueFlush(): void {
		this.queue = this.queue.then(() => this.flush()).catch(() => {});
	}

	private flush(): void {
		mkdirSync(dirname(SESSION_FILE), { recursive: true });
		const tmp = `${SESSION_FILE}.tmp`;
		writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf-8");
		renameSync(tmp, SESSION_FILE);
	}
}

export const sessionStore = new SessionStore();
