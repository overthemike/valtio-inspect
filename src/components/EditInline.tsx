// EditInline.tsx
/** biome-ignore-all lint/a11y/noAutofocus: editor UX */
import { useMemo, useRef, useState, useEffect } from "react"

type EditInlineProps = {
	initial: string
	onCommit: (next: string) => void
	onCancel: () => void
	className?: string
	startMultiline?: boolean
	indentSize?: number
}

const EditInline: React.FC<EditInlineProps> = ({
	initial,
	onCommit,
	onCancel,
	className,
	startMultiline = false,
	indentSize = 2,
}) => {
	const [value, setValue] = useState(initial)
	const [isComposing, setIsComposing] = useState(false)
	const ref = useRef<HTMLTextAreaElement | null>(null)

	const isMultiline = useMemo(
		() => startMultiline || initial.includes("\n") || value.includes("\n"),
		[startMultiline, initial, value],
	)

	const rows = useMemo(() => {
		const lineCount = value.split("\n").length
		return Math.min(Math.max(isMultiline ? lineCount : 1, 1), 40)
	}, [value, isMultiline])

	// Focus on mount (no select(), to avoid caret jumps)
	useEffect(() => {
		ref.current?.focus()
	}, [])

	const restoreCaret = (start: number, end: number = start) => {
		requestAnimationFrame(() => {
			if (!ref.current) return
			ref.current.selectionStart = start
			ref.current.selectionEnd = end
		})
	}

	const insertAtSelection = (text: string) => {
		const el = ref.current
		if (!el) return
		const { selectionStart, selectionEnd } = el
		const next = value.slice(0, selectionStart) + text + value.slice(selectionEnd)
		const caret = selectionStart + text.length
		setValue(next)
		restoreCaret(caret)
	}

	const indentSelection = (direction: "in" | "out") => {
		const el = ref.current
		if (!el) return
		const { selectionStart, selectionEnd } = el

		const before = value.slice(0, selectionStart)
		const sel = value.slice(selectionStart, selectionEnd)
		const lineStart = before.lastIndexOf("\n") + 1
		const afterFirstNewline = sel.lastIndexOf("\n")
		const lineEnd =
			afterFirstNewline === -1
				? selectionEnd
				: selectionStart + afterFirstNewline + 1 + (sel.length - afterFirstNewline - 1)

		const fullSel = value.slice(lineStart, lineEnd)
		const lines = fullSel.split("\n")
		const pad = " ".repeat(indentSize)

		let deltaStart = 0
		let deltaEnd = 0

		const newLines = lines.map((ln, i) => {
			if (direction === "in") {
				if (lineStart + (i === 0 ? 0 : 1) <= selectionStart) deltaStart += pad.length
				deltaEnd += pad.length
				return pad + ln
			} else {
				const remove = Math.min(indentSize, ln.match(/^ +/)?.[0]?.length ?? 0)
				if (lineStart + (i === 0 ? 0 : 1) <= selectionStart) {
					deltaStart -= remove
					if (deltaStart > 0) deltaStart = 0
				}
				deltaEnd -= remove
				return ln.slice(remove)
			}
		})

		const next = value.slice(0, lineStart) + newLines.join("\n") + value.slice(lineEnd)
		const nextStart = selectionStart + deltaStart
		const nextEnd = selectionEnd + deltaEnd

		setValue(next)
		restoreCaret(Math.max(lineStart, nextStart), Math.max(lineStart, nextEnd))
	}

	return (
		<textarea
			ref={ref}
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onKeyDown={(e) => {
				// Do NOT handle Enter at all — let the textarea behave natively.

				// Escape cancels editing
				if (e.key === "Escape") {
					e.preventDefault()
					onCancel()
					return
				}

				// Tab indent/outdent (multi-line aware)
				if (e.key === "Tab" && !isComposing) {
					e.preventDefault()
					indentSelection(e.shiftKey ? "out" : "in")
					return
				}
			}}
			onBlur={(e) => {
				e.stopPropagation()
				onCommit(value)
			}}
			onCompositionStart={() => setIsComposing(true)}
			onCompositionEnd={() => setIsComposing(false)}
			className={`flex-1 min-w-[24ch] max-w-full bg-gray-700 text-purple-200 px-2 py-1 rounded outline-none focus:ring-1 focus:ring-orange-500 text-sm font-mono ${className ?? ""}`}
			rows={rows}
			autoFocus
			spellCheck={false}
			style={{
				display: "block",
				resize: "none",
				width: "100%",
				whiteSpace: "pre-wrap",
				overflowY: rows >= 20 ? "auto" : "hidden",
			}}
		/>
	)
}

export default EditInline
