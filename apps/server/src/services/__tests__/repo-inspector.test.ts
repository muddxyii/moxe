import { describe, expect, it } from "vitest";
import {
	inspectRepoPath,
	parseGithubRepoFromRemote,
} from "../repo-inspector.js";

describe("parseGithubRepoFromRemote", () => {
	it("parses ssh github remotes", () => {
		expect(parseGithubRepoFromRemote("git@github.com:acme/moxe.git")).toEqual({
			owner: "acme",
			name: "moxe",
		});
	});

	it("parses https github remotes", () => {
		expect(
			parseGithubRepoFromRemote("https://github.com/acme/moxe.git"),
		).toEqual({
			owner: "acme",
			name: "moxe",
		});
	});

	it("returns null for unsupported remotes", () => {
		expect(
			parseGithubRepoFromRemote("https://gitlab.com/acme/moxe.git"),
		).toBeNull();
	});
});

describe("inspectRepoPath", () => {
	it("returns repo details and duplicate status", () => {
		const result = inspectRepoPath(
			"/tmp/moxe",
			[{ owner: "acme", name: "moxe", localPath: "/Users/me/moxe" }],
			() => true,
			() => "git@github.com:acme/moxe.git",
		);

		expect(result).toEqual({
			owner: "acme",
			name: "moxe",
			localPath: "/tmp/moxe",
			alreadyRegistered: true,
		});
	});

	it("throws when path does not exist", () => {
		expect(() =>
			inspectRepoPath(
				"/tmp/moxe",
				[],
				() => false,
				() => "",
			),
		).toThrow("Path does not exist");
	});

	it("throws when remote is not parseable", () => {
		expect(() =>
			inspectRepoPath(
				"/tmp/moxe",
				[],
				() => true,
				() => "file:///tmp/repo",
			),
		).toThrow("Could not parse GitHub remote from origin");
	});
});
