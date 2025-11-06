import { GitCompare } from "lucide-react"
import type { Snapshot } from "../types"

export const DiffView: React.FC<{
	snapshots: Snapshot[]
	selected: number
}> = ({ snapshots, selected }) => {
	const currentChanges = snapshots[selected]?.changes || []

	if (currentChanges.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-gray-500">
				<div className="text-center">
					<GitCompare size={48} className="mx-auto mb-2 opacity-50" />
					<p>No changes in this snapshot</p>
				</div>
			</div>
		)
	}

	return (
		<div className="p-4 space-y-4">
			{currentChanges.map((change) => (
				<div key={change.id} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
					<div className="text-sm text-orange-400 mb-2 font-semibold">{change.path}</div>
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
												? (JSON.stringify(change.from, null, 2) ?? String(change.from))
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
	)
}

export default DiffView
