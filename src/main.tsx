import React from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./main.css"

// biome-ignore lint/style/noNonNullAssertion: <guaranteed>
const root = document.getElementById("root")!
createRoot(root).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
)
