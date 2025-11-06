import React, { useState, useLayoutEffect, useRef, useMemo } from "react";
import {
	ChevronRight,
	ChevronDown,
	Circle,
	Trash2,
	Play,
	Pause,
	SkipBack,
	SkipForward,
	Search,
	Users,
	GitCompare,
	Pencil,
} from "lucide-react";

type Tab = "state" | "diff" | "subscribers";
type Change = {
	path: string;
	from: any;
	to: any;
};

type Snapshot = {
	id: number;
	action: string;
	timestamp: string;
	changes: Change[];
};

import JSON5 from "json5";

function childPath(base: string, parentIsArray: boolean, childKey: string) {
	if (base === "root") return childKey;
	return parentIsArray ? `${base}[${childKey}]` : `${base}.${childKey}`;
}

function isNumericLiteral(s: string) {
	// Accepts ints, floats, exponentials; disallows things like "" or "  "
	return /^[-+]?(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?$/.test(s);
}

const isObjectLike = (v: unknown): v is Record<string, unknown> | unknown[] =>
	v !== null && typeof v === "object";

const expandPath = (
	setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>,
	path: string,
) => {
	setExpanded((prev) => {
		const next = new Set(prev);
		next.add(path);
		return next;
	});
};

// Optional: ensure all ancestors are expanded too (root.user.todos etc.)
const expandPathWithAncestors = (
	setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>,
	path: string,
) => {
	const parts = path.split(".");
	setExpanded((prev) => {
		const next = new Set(prev);
		for (let i = 0; i < parts.length; i++) {
			const p = parts.slice(0, i + 1).join(".");
			next.add(p);
		}
		return next;
	});
};

/**
 * Parses user input into a JS value with the following precedence:
 *  - exact booleans/null/undefined
 *  - numeric literal
 *  - strict JSON
 *  - JSON5 (unquoted keys, single quotes, trailing commas, comments)
 *  - otherwise keep as string
 */
export function parseLooseValue(raw: string): any {
	const trimmed = raw.trim();

	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (trimmed === "null") return null;
	if (trimmed === "undefined") return undefined;

	if (isNumericLiteral(trimmed)) {
		// Preserve number types; avoid turning empty string into 0
		return Number(trimmed);
	}

	// Strict JSON first (fast path)
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			return JSON.parse(trimmed);
		} catch {
			// Then try JSON5 for JS-like object/array syntax
			try {
				return JSON5.parse(trimmed);
			} catch {
				// fall through
			}
		}
	}

	// If user wrapped with quotes, unquote once
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		try {
			// JSON.parse handles escapes for double-quoted; for single-quoted, JSON5
			return trimmed.startsWith('"')
				? JSON.parse(trimmed)
				: JSON5.parse(trimmed);
		} catch {
			// keep as plain string without outer quotes
			return trimmed.slice(1, -1);
		}
	}

	// Keep as-is string
	return raw;
}

/**
 * Collects every expand-able path:
 * - Includes "root"
 * - Object keys as "a.b"
 * - Array items as "a[0]"
 * - Guards circular refs with WeakSet
 */
function collectAllPaths(
	value: unknown,
	base: string = "root",
	out: Set<string> = new Set<string>(),
	seen: WeakSet<object> = new WeakSet<object>(),
): Set<string> {
	out.add(base);

	if (!isObjectLike(value)) return out;

	const obj = value as object;
	if (seen.has(obj)) return out;
	seen.add(obj);

	if (Array.isArray(value)) {
		value.forEach((item, i) => {
			const p = `${base}[${i}]`;
			out.add(p);
			collectAllPaths(item, p, out, seen);
		});
	} else {
		Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
			const p = base === "root" ? k : `${base}.${k}`;
			out.add(p);
			collectAllPaths(v, p, out, seen);
		});
	}
	return out;
}

type EditInlineProps = {
	initial: string;
	onCommit: (next: string) => void;
	onCancel: () => void;
	className?: string;
	/** If true, we'll start in multiline mode; otherwise we flip to multiline the first time user inserts a newline */
	startMultiline?: boolean;
	/** Number of spaces for indent when Tab is pressed in multiline mode */
	indentSize?: number;
};

export function EditInline({
	initial,
	onCommit,
	onCancel,
	className,
	startMultiline = false,
	indentSize = 2,
}: EditInlineProps) {
	const [value, setValue] = useState(initial);
	const [isMultiline, setIsMultiline] = useState(
		startMultiline || initial.includes("\n"),
	);
	const [isComposing, setIsComposing] = useState(false);
	const ref = useRef<HTMLTextAreaElement | null>(null);

	// When the editor opens for an object/array, ensure multiline mode
	React.useEffect(() => {
		if (initial.includes("\n")) setIsMultiline(true);
	}, [initial]);

	// Compute rows purely from line count; clamp 1..20
	const rows = useMemo(() => {
		const lineCount = value.split("\n").length;
		// no artificial floor; true to content
		return Math.min(Math.max(isMultiline ? lineCount : 1, 1), 40);
	}, [value, isMultiline]);

	// Optional helpers for tab indentation in multiline mode
	const insertAtSelection = (text: string) => {
		const el = ref.current;
		if (!el) return;
		const { selectionStart, selectionEnd } = el;
		const next =
			value.slice(0, selectionStart) + text + value.slice(selectionEnd);
		const caret = selectionStart + text.length;
		setValue(next);
		requestAnimationFrame(() => {
			if (!ref.current) return;
			ref.current.selectionStart = caret;
			ref.current.selectionEnd = caret;
		});
	};

	const indentSelection = (direction: "in" | "out") => {
		const el = ref.current;
		if (!el) return;
		let { selectionStart, selectionEnd } = el;
		const before = value.slice(0, selectionStart);
		const sel = value.slice(selectionStart, selectionEnd);
		const lineStart = before.lastIndexOf("\n") + 1;
		const afterFirstNewline = sel.lastIndexOf("\n");
		const lineEnd =
			afterFirstNewline === -1
				? selectionEnd
				: selectionStart +
					afterFirstNewline +
					1 +
					(sel.length - afterFirstNewline - 1);

		const fullSel = value.slice(lineStart, lineEnd);
		const lines = fullSel.split("\n");
		const pad = " ".repeat(indentSize);

		let deltaStart = 0;
		let deltaEnd = 0;

		const newLines = lines.map((ln, i) => {
			if (direction === "in") {
				if (lineStart + (i === 0 ? 0 : 1) <= selectionStart)
					deltaStart += pad.length;
				deltaEnd += pad.length;
				return pad + ln;
			} else {
				const remove = Math.min(indentSize, ln.match(/^ +/)?.[0]?.length ?? 0);
				if (lineStart + (i === 0 ? 0 : 1) <= selectionStart) {
					deltaStart -= remove;
					if (deltaStart > 0) deltaStart = 0;
				}
				deltaEnd -= remove;
				return ln.slice(remove);
			}
		});

		const next =
			value.slice(0, lineStart) + newLines.join("\n") + value.slice(lineEnd);

		const nextStart = selectionStart + deltaStart;
		const nextEnd = selectionEnd + deltaEnd;

		setValue(next);
		requestAnimationFrame(() => {
			if (!ref.current) return;
			ref.current.selectionStart = Math.max(lineStart, nextStart);
			ref.current.selectionEnd = Math.max(lineStart, nextEnd);
		});
	};

	return (
		<textarea
			ref={ref}
			value={value}
			onChange={(e) => setValue(e.target.value)}
    onKeyDown={(e) => {
        // Enter behavior:
        // - Single-line: Enter commits
        // - Multiline: Enter inserts newline (default). Shift+Enter also inserts newline.
        if (e.key === "Enter" && !isComposing) {
            if (!isMultiline && !e.shiftKey) {
                e.preventDefault();
                onCommit(value);
                return;
            }
            // Ensure we switch to multiline when a newline is requested
            if (!isMultiline) setIsMultiline(true);
            // Allow default to insert a newline so native behavior/caret works
            return;
        }
        if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
            return;
        }
        if (e.key === "Tab" && isMultiline) {
            e.preventDefault();
            indentSelection(e.shiftKey ? "out" : "in");
            return;
        }
    }}
			onBlur={() => onCommit(value)}
			onCompositionStart={() => setIsComposing(true)}
			onCompositionEnd={() => setIsComposing(false)}
			className={`flex-1 min-w-[24ch] max-w-full bg-gray-700 text-purple-200 px-2 py-1 rounded outline-none focus:ring-1 focus:ring-orange-500 text-sm font-mono ${className ?? ""}`}
			rows={rows}
			// biome-ignore lint/a11y/noAutofocus: intentional editor UX
			autoFocus
			spellCheck={false}
			style={{
				display: "block",
				resize: "none",
				width: "100%",
				// For code/JSON we want wrapping; long single-line primitives won’t wrap unless they contain spaces
				whiteSpace: "pre-wrap",
				overflowY: rows >= 20 ? "auto" : "hidden",
			}}
		/>
	);
}

const ValtioInspect = () => {
	const [selectedSnapshot, setSelectedSnapshot] = useState(2);
	const [isPaused, setIsPaused] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState<Tab>("state");
	const [editingPath, setEditingPath] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");

	const [stateData, setStateData] = useState({
		user: {
			name: "Alice",
			email: "alice@example.com",
			preferences: {
				theme: "dark",
				notifications: true,
			},
		},
		todos: [
			{ id: 1, text: "Buy milk", done: true },
			{ id: 2, text: "Walk dog", done: false },
		],
		counter: 42,
	});
	const [expandedPaths, setExpandedPaths] = useState(() =>
		collectAllPaths(stateData),
	);

	const allPaths = useMemo(() => collectAllPaths(stateData), [stateData]);

	const handleExpandAll = () => {
		// Clone so we don’t share the memoized Set instance
		setExpandedPaths(new Set(allPaths));
	};

	const handleCollapseAll = () => {
		// Keep "root" so the top level stays visible
		setExpandedPaths(new Set<string>(["root"]));
	};

	const snapshots: Snapshot[] = [
		{ id: 0, action: "Initial State", timestamp: "10:23:45.123", changes: [] },
		{
			id: 1,
			action: "user.name",
			timestamp: "10:23:47.456",
			changes: [{ path: "user.name", from: "", to: "Alice" }],
		},
		{
			id: 2,
			action: "user.email",
			timestamp: "10:23:48.789",
			changes: [{ path: "user.email", from: "", to: "alice@example.com" }],
		},
		{
			id: 3,
			action: "todos[0]",
			timestamp: "10:23:50.012",
			changes: [
				{
					path: "todos[0]",
					from: undefined,
					to: { id: 1, text: "Buy milk", done: false },
				},
			],
		},
		{
			id: 4,
			action: "todos[0].done",
			timestamp: "10:23:52.345",
			changes: [{ path: "todos[0].done", from: false, to: true }],
		},
	];

	const updateValueAtPath = (path: string, value: any) => {
		const keys = path.split(".");
		const newState = JSON.parse(JSON.stringify(stateData));
		let current = newState;

		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i];
			const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
			if (arrayMatch) {
				const [, arrayKey, index] = arrayMatch;
				current = current[arrayKey][parseInt(index)];
			} else {
				current = current[key];
			}
		}

		const lastKey = keys[keys.length - 1];
		const arrayMatch = lastKey.match(/^(.+)\[(\d+)\]$/);
		if (arrayMatch) {
			const [, arrayKey, index] = arrayMatch;
			current[arrayKey][parseInt(index)] = value;
		} else {
			current[lastKey] = value;
		}

		setStateData(newState);
	};

	const startEdit = (path: string, currentValue: any) => {
		setEditingPath(path);
		if (typeof currentValue === "string") {
			setEditValue(currentValue);
		} else if (currentValue && typeof currentValue === "object") {
			setEditValue(JSON5.stringify(currentValue, null, 2)); // pretty
		} else {
			setEditValue(String(currentValue));
		}
	};

	const commitEdit = (path: string) => {
		try {
			let parsedValue: any;
			const trimmed = editValue.trim();

			if (trimmed === "true") parsedValue = true;
			else if (trimmed === "false") parsedValue = false;
			else if (trimmed === "null") parsedValue = null;
			else if (trimmed === "undefined") parsedValue = undefined;
			else if (!isNaN(Number(trimmed)) && trimmed !== "")
				parsedValue = Number(trimmed);
			else if (trimmed.startsWith("{") || trimmed.startsWith("["))
				parsedValue = JSON.parse(trimmed);
			else parsedValue = trimmed.replace(/^"|"$/g, "");

			updateValueAtPath(path, parsedValue);
		} catch (e) {
			updateValueAtPath(path, editValue);
		}
		setEditingPath(null);
	};

	const cancelEdit = () => {
		setEditingPath(null);
		setEditValue("");
	};

	const currentState = stateData;

	const subscribers = [
		{
			id: "sub-1",
			component: "UserProfile",
			paths: ["user.name", "user.email"],
			renderCount: 3,
			lastRender: "10:23:48.789",
		},
		{
			id: "sub-2",
			component: "TodoList",
			paths: ["todos"],
			renderCount: 2,
			lastRender: "10:23:52.345",
		},
		{
			id: "sub-3",
			component: "Counter",
			paths: ["counter"],
			renderCount: 1,
			lastRender: "10:23:45.123",
		},
		{
			id: "sub-4",
			component: "ThemeProvider",
			paths: ["user.preferences.theme"],
			renderCount: 1,
			lastRender: "10:23:45.123",
		},
		{
			id: "sub-5",
			component: "TodoItem[0]",
			paths: ["todos[0]", "todos[0].done"],
			renderCount: 4,
			lastRender: "10:23:52.345",
		},
	];

	const toggleExpand = (path: string) => {
		const newExpanded = new Set(expandedPaths);
		if (newExpanded.has(path)) {
			newExpanded.delete(path);
		} else {
			newExpanded.add(path);
		}
		setExpandedPaths(newExpanded);
	};

	function childPath(base: string, parentIsArray: boolean, childKey: string) {
		if (base === "root") return childKey;
		return parentIsArray ? `${base}[${childKey}]` : `${base}.${childKey}`;
	}

	const StateTree = ({
		data,
		path = "root",
		depth = 0,
	}: {
		data: any;
		path?: string;
		depth?: number;
	}) => {
		const parentIsArray = Array.isArray(data);
		const isObject = typeof data === "object" && data !== null;

		if (!isObject) {
			return (
				<div className="flex items-center gap-2 py-0.5">
					<span className="text-purple-400">
						{typeof data === "string" ? `"${data}"` : String(data)}
					</span>
				</div>
			);
		}

		return (
			<div>
				{Object.entries(data).map(([key, value]) => {
					const currentPath = childPath(path, parentIsArray, key);
					const hasChildren = value !== null && typeof value === "object";
					const childExpanded = expandedPaths.has(currentPath);
					const isEditing = editingPath === currentPath;

					return (
						<div
							key={currentPath}
							style={{ marginLeft: depth > 0 ? "16px" : "0" }}
						>
							<div className="group flex items-start gap-1 py-0.5 hover:bg-gray-800/50 rounded px-1">
								{/* Left toggler + label */}
								<div
									className="flex items-center gap-1 flex-1 cursor-pointer"
									onClick={() => hasChildren && toggleExpand(currentPath)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && hasChildren) {
											e.preventDefault();
											toggleExpand(currentPath);
										}
									}}
									role="treeitem"
									aria-expanded={hasChildren ? childExpanded : undefined}
									tabIndex={0}
								>
									{hasChildren ? (
										childExpanded ? (
											<ChevronDown size={14} className="text-gray-500" />
										) : (
											<ChevronRight size={14} className="text-gray-500" />
										)
									) : (
										<span className="w-3.5" />
									)}

									{/* Key label */}
									<span className="text-blue-300">
										{Array.isArray(data) ? `[${key}]` : key}:
									</span>

									{/* Value / summary / inline editor / pencil */}
									<div className="flex items-center gap-1 ml-1 flex-1 min-w-0">
										{/* Value preview (non-editing, primitive) */}
										{!isEditing && !hasChildren && (
											// biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
											// biome-ignore lint/a11y/noStaticElementInteractions: <explanation>
											<span
												className="text-purple-400 cursor-text hover:bg-gray-700/50 px-1 rounded"
												onClick={(e) => {
													e.stopPropagation();
													startEdit(currentPath, value);
													expandPathWithAncestors(
														setExpandedPaths,
														currentPath,
													);
												}}
											>
												{typeof value === "string"
													? `"${value}"`
													: String(value)}
											</span>
										)}

										{/* Collapsed summary for containers */}
										{!isEditing && hasChildren && !childExpanded && (
											<span className="text-gray-500 text-sm">
												{Array.isArray(value)
													? `[${(value as any[]).length}]`
													: `{${Object.keys(value as object).length}}`}
											</span>
										)}

										{/* Inline editor replaces the value */}
										{isEditing && (
											<EditInline
												key={`edit:${currentPath}:${editValue.length}`}
												initial={editValue}
												startMultiline={editValue.includes("\n")}
												indentSize={2}
												className="bg-gray-700 text-purple-200 px-2 py-1 rounded outline-none focus:ring-1 focus:ring-orange-500 text-sm font-mono"
												onCommit={(raw) => {
													const parsed = parseLooseValue(raw);
													updateValueAtPath(currentPath, parsed);

													if (parsed && typeof parsed === "object") {
														expandPathWithAncestors(
															setExpandedPaths,
															currentPath,
														);
													} else {
														setExpandedPaths((prev) => {
															const next = new Set(prev);
															next.delete(currentPath);
															return next;
														});
													}

													setEditingPath(null);
												}}
												onCancel={() => {
													setEditingPath(null);
													setEditValue("");
												}}
											/>
										)}

										{/* Pencil button (edit trigger) */}
										{!isEditing && (
											<button
												type="button"
												className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-800 cursor-pointer"
												title="Edit value"
												aria-label={`Edit ${Array.isArray(data) ? `[${key}]` : key}`}
												onClick={(e) => {
													e.stopPropagation();
													startEdit(currentPath, value);
													expandPathWithAncestors(
														setExpandedPaths,
														currentPath,
													);
												}}
											>
												<Pencil size={13} className="text-gray-400" />
											</button>
										)}
									</div>
								</div>
							</div>

							{/* Child nodes */}
							{hasChildren && childExpanded && !isEditing && (
								<StateTree data={value} path={currentPath} depth={depth + 1} />
							)}
						</div>
					);
				})}
			</div>
		);
	};

	const DiffView = () => {
		const currentChanges = snapshots[selectedSnapshot]?.changes || [];

		if (currentChanges.length === 0) {
			return (
				<div className="flex items-center justify-center h-full text-gray-500">
					<div className="text-center">
						<GitCompare size={48} className="mx-auto mb-2 opacity-50" />
						<p>No changes in this snapshot</p>
					</div>
				</div>
			);
		}

		return (
			<div className="p-4 space-y-4">
				{currentChanges.map((change, idx) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
						key={idx}
						className="bg-gray-900 rounded-lg p-3 border border-gray-800"
					>
						<div className="text-sm text-orange-400 mb-2 font-semibold">
							{change.path}
						</div>
						<div className="space-y-1">
							<div className="flex items-start gap-2">
								<span className="text-red-400 text-xs mt-0.5">−</span>
								<div className="flex-1 bg-red-950/30 border border-red-900/50 rounded px-2 py-1">
									<span className="text-red-300 text-sm">
										{change.from === undefined
											? "undefined"
											: change.from === null
												? "null"
												: typeof change.from === "object"
													? (JSON.stringify(change.from, null, 2) ??
														String(change.from))
													: typeof change.from === "string"
														? `"${change.from}"`
														: String(change.from)}
									</span>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<span className="text-green-400 text-xs mt-0.5">+</span>
								<div className="flex-1 bg-green-950/30 border border-green-900/50 rounded px-2 py-1">
									<span className="text-green-300 text-sm">
										{typeof change.to === "object"
											? JSON.stringify(change.to, null, 2)
											: typeof change.to === "string"
												? `"${change.to}"`
												: String(change.to)}
									</span>
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		);
	};

	const SubscribersView = () => {
		return (
			<div className="p-4 space-y-2">
				<div className="text-xs text-gray-500 mb-4 flex items-center justify-between">
					<span>{subscribers.length} active subscribers</span>
					<span>
						Total renders:{" "}
						{subscribers.reduce((sum, s) => sum + s.renderCount, 0)}
					</span>
				</div>
				{subscribers.map((sub) => (
					<div
						key={sub.id}
						className="bg-gray-900 rounded-lg p-3 border border-gray-800 hover:border-gray-700 transition-colors"
					>
						<div className="flex items-start justify-between mb-2">
							<div className="flex items-center gap-2">
								<Users size={14} className="text-orange-500" />
								<span className="text-sm font-semibold text-gray-200">
									{sub.component}
								</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-xs text-gray-500">
									{sub.renderCount} renders
								</span>
								<span className="text-xs text-gray-600">{sub.lastRender}</span>
							</div>
						</div>
						<div className="flex flex-wrap gap-1.5">
							{sub.paths.map((path, idx) => (
								<span
									// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
									key={idx}
									className="text-xs bg-gray-800 text-blue-300 px-2 py-0.5 rounded"
								>
									{path}
								</span>
							))}
						</div>
					</div>
				))}
				<div className="mt-6 p-3 bg-gray-900/50 rounded border border-gray-800">
					<div className="text-xs text-gray-400 mb-2">💡 Performance Tip</div>
					<div className="text-xs text-gray-500">
						TodoItem[0] is rendering frequently. Consider using more specific
						path subscriptions or memoization.
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="h-screen bg-gray-950 text-gray-100 flex flex-col font-mono text-sm">
			{/* Header */}
			<div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Circle className="text-orange-500 fill-orange-500" size={12} />
					<span className="font-semibold text-orange-500">Valtio</span>
					<span className="text-gray-500">DevTools</span>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						className="p-1.5 hover:bg-gray-800 rounded"
						title="Clear snapshots"
					>
						<Trash2 size={16} />
					</button>
					<button
						type="button"
						className={`p-1.5 hover:bg-gray-800 rounded ${isPaused ? "text-orange-500" : ""}`}
						onClick={() => setIsPaused(!isPaused)}
						title={isPaused ? "Resume recording" : "Pause recording"}
					>
						{isPaused ? <Play size={16} /> : <Pause size={16} />}
					</button>
				</div>
			</div>

			<div className="flex flex-1 overflow-hidden">
				{/* Left Panel - Snapshots */}
				<div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
					<div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
						<Search size={14} className="text-gray-500" />
						<input
							type="text"
							placeholder="Filter actions..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="flex-1 bg-gray-800 text-gray-100 px-2 py-1 rounded text-xs outline-none focus:ring-1 focus:ring-orange-500"
						/>
					</div>

					<div className="flex-1 overflow-y-auto">
						{snapshots.map((snapshot) => (
							// biome-ignore lint/a11y/useKeyWithClickEvents: <test>
							// biome-ignore lint/a11y/noStaticElementInteractions: <test>
							<div
								key={snapshot.id}
								className={`px-3 py-2 border-b border-gray-800 cursor-pointer hover:bg-gray-800/50 ${
									selectedSnapshot === snapshot.id
										? "bg-gray-800 border-l-2 border-orange-500"
										: ""
								}`}
								onClick={() => setSelectedSnapshot(snapshot.id)}
							>
								<div className="flex items-center justify-between mb-1">
									<span className="text-xs text-gray-400">#{snapshot.id}</span>
									<span className="text-xs text-gray-500">
										{snapshot.timestamp}
									</span>
								</div>
								<div className="text-sm text-gray-200 truncate">
									{snapshot.action}
								</div>
								{snapshot.changes.length > 0 && (
									<div className="text-xs text-gray-500 mt-1">
										{snapshot.changes.length} change
										{snapshot.changes.length > 1 ? "s" : ""}
									</div>
								)}
							</div>
						))}
					</div>

					{/* Time Travel Controls */}
					<div className="px-3 py-2 border-t border-gray-800 flex items-center justify-between bg-gray-900">
						<div className="flex gap-1">
							<button
								type="button"
								className="p-1.5 hover:bg-gray-800 rounded disabled:opacity-30"
								disabled={selectedSnapshot === 0}
								onClick={() =>
									setSelectedSnapshot(Math.max(0, selectedSnapshot - 1))
								}
							>
								<SkipBack size={16} />
							</button>
							<button
								type="button"
								className="p-1.5 hover:bg-gray-800 rounded disabled:opacity-30"
								disabled={selectedSnapshot === snapshots.length - 1}
								onClick={() =>
									setSelectedSnapshot(
										Math.min(snapshots.length - 1, selectedSnapshot + 1),
									)
								}
							>
								<SkipForward size={16} />
							</button>
						</div>
						<span className="text-xs text-gray-500">
							{selectedSnapshot + 1} / {snapshots.length}
						</span>
					</div>
				</div>

				{/* Right Panel - State Inspector */}
				<div className="flex-1 flex flex-col">
					{/* Tabs */}
					<div className="bg-gray-900 border-b border-gray-800 flex">
						<button
							type="button"
							className={`px-4 py-2 text-sm border-b-2 transition-colors ${
								activeTab === "state"
									? "border-orange-500 text-orange-500"
									: "border-transparent text-gray-400 hover:text-gray-200"
							}`}
							onClick={() => setActiveTab("state")}
						>
							State
						</button>
						<button
							type="button"
							className={`px-4 py-2 text-sm border-b-2 transition-colors ${
								activeTab === "diff"
									? "border-orange-500 text-orange-500"
									: "border-transparent text-gray-400 hover:text-gray-200"
							}`}
							onClick={() => setActiveTab("diff")}
						>
							Diff
						</button>
						<button
							type="button"
							className={`px-4 py-2 text-sm border-b-2 transition-colors ${
								activeTab === "subscribers"
									? "border-orange-500 text-orange-500"
									: "border-transparent text-gray-400 hover:text-gray-200"
							}`}
							onClick={() => setActiveTab("subscribers")}
						>
							Subscribers
						</button>
					</div>

					{/* Tab Content */}
					<div className="flex-1 overflow-y-auto">
						{activeTab === "state" && (
							<>
								<div className="px-4 py-2 border-b border-gray-800 flex items-center justify-end gap-2 bg-gray-900/40">
									<button
										type="button"
										onClick={handleExpandAll}
										className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-200"
										title="Expand all"
									>
										<ChevronDown size={14} className="text-gray-400" />
										Expand all
									</button>
									<button
										type="button"
										onClick={handleCollapseAll}
										className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-200"
										title="Collapse all"
									>
										<ChevronRight size={14} className="text-gray-400" />
										Collapse all
									</button>
								</div>
								<div className="p-4">
									<StateTree data={currentState} />
								</div>
							</>
						)}

						{activeTab === "diff" && <DiffView />}
						{activeTab === "subscribers" && <SubscribersView />}
					</div>

					{/* Footer Stats */}
					<div className="bg-gray-900 border-t border-gray-800 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
						<div>State size: ~2.4 KB</div>
						<div>3 proxies active</div>
						<div>{subscribers.length} subscribers</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ValtioInspect;
