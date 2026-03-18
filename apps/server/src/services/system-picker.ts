import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

type PickerCommand = {
	command: string;
	args: string[];
};

export function buildPickDirectoryCommand(
	platform: NodeJS.Platform,
): PickerCommand {
	if (platform === "darwin") {
		return {
			command: "osascript",
			args: [
				"-e",
				'set chosenFolder to POSIX path of (choose folder with prompt "Select repository folder")',
				"-e",
				"return chosenFolder",
			],
		};
	}

	if (platform === "win32") {
		return {
			command: "powershell",
			args: [
				"-NoProfile",
				"-Command",
				"Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Select repository folder'; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::WriteLine($dialog.SelectedPath) } else { exit 1 }",
			],
		};
	}

	if (platform === "linux") {
		return {
			command: "zenity",
			args: [
				"--file-selection",
				"--directory",
				"--title=Select repository folder",
			],
		};
	}

	throw new Error("System picker is not supported on this platform");
}

export async function pickDirectory(): Promise<string> {
	const { command, args } = buildPickDirectoryCommand(process.platform);
	const { stdout } = await execFile(command, args, { timeout: 60_000 });
	const path = stdout.trim();
	if (!path) {
		throw new Error("No folder selected");
	}
	return path;
}
