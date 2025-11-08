import type { PluginOption } from "vite"

export function reactLite(): PluginOption {
	return {
		name: "react-lite-fallback",
		config() {
			return {
				esbuild: {
					jsx: "automatic",
					jsxImportSource: "react",
				},
			}
		},
	}
}
