import { readFileSync } from "node:fs";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const rootPackageJsonPath = new URL("../../package.json", import.meta.url);
const rootPackageVersion = JSON.parse(
	readFileSync(rootPackageJsonPath, "utf8"),
) as { version: string };

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		"import.meta.env.PUBLIC_MOXIE_VERSION": JSON.stringify(
			rootPackageVersion.version,
		),
	},
});
