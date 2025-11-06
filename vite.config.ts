import { defineConfig } from "vite"
import path from "node:path"
import react from "@vitejs/plugin-react"
import { devtools } from "@tanstack/devtools-vite"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
	plugins: [
		tailwindcss(),
		devtools(), // must be first per docs
		react(),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
})
