/** biome-ignore-all lint/suspicious/noExplicitAny: devtools rendering */
import { ChevronDown, ChevronRight, Pencil } from "lucide-react"

import { asClickable } from "../utils/asClickable"
import { expandPathWithAncestors } from "../utils/tree"
import EditInline from "./EditInline"

type StateTreeProps = {
	data: any
	path?: string
	depth?: number

	expandedPaths: Set<string>
	setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>
	toggleExpand: (path: string) => void

	editingPath: string | null
	editValue: string
	startEdit: (path: string, currentValue: any) => void
	commitEdit: (path: string, raw: string) => void
	cancelEdit: () => void

	updateValueAtPath: (path: string, value: any) => void
}

function childPath(base: string, parentIsArray: boolean, childKey: string) {
	if (base === "root") return childKey
	return parentIsArray ? `${base}[${childKey}]` : `${base}.${childKey}`
}

export const StateTree: React.FC<StateTreeProps> = ({
	data,
	path = "root",
	depth = 0,
	expandedPaths,
	setExpandedPaths,
	toggleExpand,
	editingPath,
	editValue,
	startEdit,
	commitEdit,
	cancelEdit,
	updateValueAtPath, // kept for recursion parity
}) => {
	const parentIsArray = Array.isArray(data)
	const isObject = typeof data === "object" && data !== null

	if (!isObject) {
		return (
			<div className="flex items-center gap-2 py-0.5">
				<span className="text-purple-400">
					{typeof data === "string" ? `"${data}"` : String(data)}
				</span>
			</div>
		)
	}

	return (
		<div>
			{Object.entries(data).map(([key, value]) => {
				const currentPath = childPath(path, parentIsArray, key)
				const hasChildren = value !== null && typeof value === "object"
				const childExpanded = expandedPaths.has(currentPath)
				const isEditing = editingPath === currentPath

				// only clickable when expandable
				const rowProps =
					!isEditing && hasChildren ? asClickable(() => toggleExpand(currentPath)) : {}

				return (
					<div key={currentPath} style={{ marginLeft: depth > 0 ? "16px" : "0" }}>
						<div className="group flex items-center gap-1 py-0.5 hover:bg-gray-800/50 rounded px-1">
							<div
								className="flex items-center gap-1 flex-1 cursor-pointer min-w-0"
								role="treeitem"
								aria-expanded={hasChildren ? childExpanded : undefined}
								tabIndex={0}
								{...rowProps}
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
								<span className="text-blue-300 shrink-0">
									{Array.isArray(data) ? `[${key}]` : key}:
								</span>

								{/* Value / editor / pencil */}
								<div className="flex items-center gap-1 ml-1 flex-1 min-w-0">
									{/* Primitive preview (click to edit) */}
									{!isEditing && !hasChildren && (
										// biome-ignore lint/a11y/noStaticElementInteractions: <flex>
										<span
											className="text-purple-400 cursor-text hover:bg-gray-700/50 px-1 rounded"
											onClick={(e) => {
												e.stopPropagation()
												startEdit(currentPath, value)
												expandPathWithAncestors(setExpandedPaths, currentPath)
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault()
													startEdit(currentPath, value)
													expandPathWithAncestors(setExpandedPaths, currentPath)
												}
											}}
											// biome-ignore lint/a11y/noNoninteractiveTabindex: <flex>
											tabIndex={0}
										>
											{typeof value === "string" ? `"${value}"` : String(value)}
										</span>
									)}

									{/* Collapsed container summary */}
									{!isEditing && hasChildren && !childExpanded && (
										<span className="text-gray-500 text-sm">
											{Array.isArray(value)
												? `[${(value as any[]).length}]`
												: `{${Object.keys(value as object).length}}`}
										</span>
									)}

									{/* Inline editor */}
									{isEditing && (
										<EditInline
											key={`edit:${currentPath}:${editValue.length}`}
											initial={editValue}
											startMultiline={editValue.includes("\n")}
											indentSize={2}
											className="bg-gray-700 text-purple-200 px-2 py-1 rounded outline-none focus:ring-1 focus:ring-orange-500 text-sm font-mono"
											onCommit={(raw) => commitEdit(currentPath, raw)}
											onCancel={cancelEdit}
										/>
									)}

									{/* Pencil (hover only) */}
									{!isEditing && (
										<button
											type="button"
											className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-800 shrink-0"
											title="Edit value"
											onClick={(e) => {
												e.stopPropagation()
												startEdit(currentPath, value)
												expandPathWithAncestors(setExpandedPaths, currentPath)
											}}
										>
											<Pencil size={13} className="text-gray-400" />
										</button>
									)}
								</div>
							</div>
						</div>

						{/* Recurse */}
						{hasChildren && childExpanded && !isEditing && (
							<StateTree
								data={value}
								path={currentPath}
								depth={depth + 1}
								expandedPaths={expandedPaths}
								setExpandedPaths={setExpandedPaths}
								toggleExpand={toggleExpand}
								editingPath={editingPath}
								editValue={editValue}
								startEdit={startEdit}
								commitEdit={commitEdit}
								cancelEdit={cancelEdit}
								updateValueAtPath={updateValueAtPath}
							/>
						)}
					</div>
				)
			})}
		</div>
	)
}
