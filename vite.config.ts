import type { PluginOption } from "vite"
import { defineConfig } from "vite"
import path from "node:path"
import { devtools } from "@tanstack/devtools-vite"
import tailwindcss from "@tailwindcss/vite"
import { reactLite } from "./config/react-lite"

const reactPlugin: PluginOption = await import("@vitejs/plugin-react")
	.then((mod) => (mod.default as () => PluginOption)())
	.catch(() => reactLite())

export default defineConfig({
	plugins: [
		tailwindcss(),
		devtools(), // must be first per docs
		reactPlugin,
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
})
