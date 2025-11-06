// utils/asClickable.ts
function isInteractiveTarget(el: EventTarget | null): boolean {
	if (!(el instanceof Element)) return false
	// If the click originated inside a truly interactive thing, don't hijack it.
	if (el.closest("input, textarea, select, button, a, [contenteditable='true']")) return true
	const role = el.closest("[role]")?.getAttribute("role")
	if (role === "button" || role === "link" || role === "textbox") return true
	return false
}

export type ClickableProps = {
	role?: "button"
	tabIndex?: number
	onClick: React.MouseEventHandler
	onKeyDown: React.KeyboardEventHandler
}

export function asClickable(onActivate: (e: React.SyntheticEvent) => void): ClickableProps {
	return {
		role: "button",
		tabIndex: 0,
		onClick: (e) => {
			if (isInteractiveTarget(e.target)) return
			onActivate(e)
		},
		onKeyDown: (e) => {
			// Allow Enter/Space from anywhere in the row, unless focus is inside a real control.
			if (isInteractiveTarget(e.target)) return
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault()
				onActivate(e)
			}
		},
	}
}
