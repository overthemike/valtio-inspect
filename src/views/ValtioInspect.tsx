/** biome-ignore-all lint/suspicious/noExplicitAny: <need flexibility> */
import JSON5 from "json5"
import {
	ChevronDown,
	ChevronRight,
	Circle,
	Pause,
	Play,
	Search,
	SkipBack,
	SkipForward,
	Trash2,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"

import { StateTree } from "../components/StateTree"
import type { Snapshot, Tab } from "../types"
import { parseLooseValue } from "../utils/parse"
import { collectAllPaths, expandPathWithAncestors, toggleExpandFactory } from "../utils/tree"
import DiffView from "./DiffView"
import SubscribersView from "./SubscribersView"

const ValtioInspect: React.FC = () => {
	// --- State comes first (avoid TDZ issues) ---------------------------------
	const [selectedSnapshot, setSelectedSnapshot] = useState(2)
	const [isPaused, setIsPaused] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [activeTab, setActiveTab] = useState<Tab>("state")

	const [editingPath, setEditingPath] = useState<string | null>(null)
	const [editValue, setEditValue] = useState("")

	const [stateData, setStateData] = useState({
		user: {
			name: "Alice",
			email: "alice@example.com",
			preferences: { theme: "dark", notifications: true },
		},
		todos: [
			{ id: 1, text: "Buy milk", done: true },
			{ id: 2, text: "Walk dog", done: false },
		],
		counter: 42,
	})

	const [expandedPaths, setExpandedPaths] = useState(() => collectAllPaths(stateData))

	// --- Derived values --------------------------------------------------------
	const allPaths = useMemo(() => collectAllPaths(stateData), [stateData])

	// --- Handlers that depend on state/memos ----------------------------------
	const handleExpandAll = useCallback(() => setExpandedPaths(new Set(allPaths)), [allPaths])

	const handleCollapseAll = useCallback(() => setExpandedPaths(new Set<string>(["root"])), [])

	const updateValueAtPath = useCallback(
		(path: string, value: any) => {
			const keys = path.split(".")
			const newState: any = JSON.parse(JSON.stringify(stateData))
			let current: any = newState

			for (let i = 0; i < keys.length - 1; i++) {
				const key = keys[i]
				const arrayMatch = key.match(/^(.+)\[(\d+)\]$/)
				if (arrayMatch) {
					const [, arrayKey, index] = arrayMatch
					current = current[arrayKey][parseInt(index)]
				} else {
					current = current[key]
				}
			}

			const lastKey = keys[keys.length - 1]
			const arrayMatch = lastKey.match(/^(.+)\[(\d+)\]$/)
			if (arrayMatch) {
				const [, arrayKey, index] = arrayMatch
				current[arrayKey][parseInt(index)] = value
			} else {
				current[lastKey] = value
			}

			setStateData(newState)
			// ensure the edited node is visible
			expandPathWithAncestors(setExpandedPaths, path)
			setEditingPath(null)
		},
		[stateData],
	)

	const onStartEdit = useCallback((path: string, currentValue: any) => {
		setEditingPath(path)
		if (typeof currentValue === "string") {
			setEditValue(currentValue)
		} else if (currentValue && typeof currentValue === "object") {
			setEditValue(JSON5.stringify(currentValue, null, 2))
		} else {
			setEditValue(String(currentValue))
		}
	}, [])

	const onCommitEdit = useCallback(
		(path: string, raw: string) => {
			const parsed = parseLooseValue(raw)
			updateValueAtPath(path, parsed)

			// expand if it became a container; collapse if primitive
			if (parsed && typeof parsed === "object") {
				setExpandedPaths((prev) => {
					const next = new Set(prev)
					// Add the path itself
					next.add(path)
					// Collect and add all nested paths within the new object/array
					const nestedPaths = collectAllPaths(parsed, path)
					nestedPaths.forEach((p) => next.add(p))
					return next
				})
			} else {
				setExpandedPaths((prev) => {
					const next = new Set(prev)
					next.delete(path)
					return next
				})
			}

			setEditingPath(null)
		},
		[updateValueAtPath],
	)

	const onCancelEdit = useCallback(() => {
		setEditingPath(null)
		setEditValue("")
	}, [])

	const toggleExpand = toggleExpandFactory(expandedPaths, setExpandedPaths)

	// --- Demo data -------------------------------------------------------------
	const snapshots: Snapshot[] = [
		{ id: 0, action: "Initial State", timestamp: "10:23:45.123", changes: [] },
		{
			id: 1,
			action: "user.name",
			timestamp: "10:23:47.456",
			changes: [{ id: 0, path: "user.name", from: "", to: "Alice" }],
		},
		{
			id: 2,
			action: "user.email",
			timestamp: "10:23:48.789",
			changes: [{ id: 1, path: "user.email", from: "", to: "alice@example.com" }],
		},
		{
			id: 3,
			action: "todos[0]",
			timestamp: "10:23:50.012",
			changes: [
				{
					id: 3,
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
			changes: [{ id: 4, path: "todos[0].done", from: false, to: true }],
		},
	]

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
	]

	// --- Render ---------------------------------------------------------------
	return (
		<div className="h-screen bg-gray-950 text-gray-100 flex flex-col font-mono text-sm">
			{/* Header */}
			<div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Circle className="text-orange-500 fill-orange-500" size={12} />
					<span className="font-semibold text-orange-500">Valtio</span>
					<span className="text-gray-500">Inspect</span>
				</div>
				<div className="flex items-center gap-2">
					<button type="button" className="p-1.5 hover:bg-gray-800 rounded" title="Clear snapshots">
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
							<button
								type="button"
								key={snapshot.id}
								onClick={() => setSelectedSnapshot(snapshot.id)}
								className={`w-full text-left px-3 py-2 border-b border-gray-800 cursor-pointer hover:bg-gray-800/50 ${
									selectedSnapshot === snapshot.id ? "bg-gray-800 border-l-2 border-orange-500" : ""
								}`}
							>
								<div className="flex items-center justify-between mb-1">
									<span className="text-xs text-gray-400">#{snapshot.id}</span>
									<span className="text-xs text-gray-500">{snapshot.timestamp}</span>
								</div>
								<div className="text-sm text-gray-200 truncate">{snapshot.action}</div>
								{snapshot.changes.length > 0 && (
									<div className="text-xs text-gray-500 mt-1">
										{snapshot.changes.length} change
										{snapshot.changes.length > 1 ? "s" : ""}
									</div>
								)}
							</button>
						))}
					</div>

					{/* Time Travel Controls */}
					<div className="px-3 py-2 border-t border-gray-800 flex items-center justify-between bg-gray-900">
						<div className="flex gap-1">
							<button
								type="button"
								className="p-1.5 hover:bg-gray-800 rounded disabled:opacity-30"
								disabled={selectedSnapshot === 0}
								onClick={() => setSelectedSnapshot(Math.max(0, selectedSnapshot - 1))}
							>
								<SkipBack size={16} />
							</button>
							<button
								type="button"
								className="p-1.5 hover:bg-gray-800 rounded disabled:opacity-30"
								disabled={selectedSnapshot === snapshots.length - 1}
								onClick={() =>
									setSelectedSnapshot(Math.min(snapshots.length - 1, selectedSnapshot + 1))
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

				{/* Right Panel */}
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
									<StateTree
										data={stateData}
										expandedPaths={expandedPaths}
										setExpandedPaths={setExpandedPaths}
										editingPath={editingPath}
										editValue={editValue}
										startEdit={onStartEdit}
										commitEdit={onCommitEdit}
										cancelEdit={onCancelEdit}
										updateValueAtPath={updateValueAtPath}
										toggleExpand={toggleExpand}
									/>
								</div>
							</>
						)}

						{activeTab === "diff" && <DiffView snapshots={snapshots} selected={selectedSnapshot} />}
						{activeTab === "subscribers" && <SubscribersView subscribers={subscribers} />}
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
	)
}

export default ValtioInspect
