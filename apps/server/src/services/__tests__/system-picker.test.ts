import { describe, expect, it } from "vitest";
import { buildPickDirectoryCommand } from "../system-picker.js";

describe("buildPickDirectoryCommand", () => {
	it("builds macOS picker command", () => {
		const cmd = buildPickDirectoryCommand("darwin");
		expect(cmd.command).toBe("osascript");
		expect(cmd.args.join(" ")).toContain("choose folder");
	});

	it("builds Windows picker command", () => {
		const cmd = buildPickDirectoryCommand("win32");
		expect(cmd.command).toBe("powershell");
		expect(cmd.args.join(" ")).toContain("FolderBrowserDialog");
	});

	it("builds Linux picker command", () => {
		const cmd = buildPickDirectoryCommand("linux");
		expect(cmd.command).toBe("zenity");
		expect(cmd.args).toContain("--directory");
	});

	it("throws on unsupported platform", () => {
		expect(() => buildPickDirectoryCommand("aix")).toThrow(
			"System picker is not supported on this platform",
		);
	});
});
