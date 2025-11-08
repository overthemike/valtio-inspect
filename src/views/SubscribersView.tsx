import { Users } from "lucide-react"
import type { Subscriber } from "../types"

export const SubscribersView: React.FC<{ subscribers: Subscriber[] }> = ({ subscribers }) => {
	// Find the most frequently rendering subscriber for performance tip
	const mostFrequentSubscriber = subscribers.reduce(
		(max, sub) => (sub.renderCount > (max?.renderCount ?? 0) ? sub : max),
		null as Subscriber | null,
	)

	return (
		<div className="p-4 space-y-2">
			<div className="text-xs text-gray-500 mb-4 flex items-center justify-between">
				<span>{subscribers.length} active subscribers</span>
				<span>Total renders: {subscribers.reduce((sum, s) => sum + s.renderCount, 0)}</span>
			</div>

			{subscribers.length === 0 ? (
				<div className="flex items-center justify-center h-64 text-gray-500">
					<div className="text-center">
						<Users size={48} className="mx-auto mb-2 opacity-50" />
						<p>No active subscribers</p>
						<p className="text-xs mt-2">Components using useSnapshot will appear here</p>
					</div>
				</div>
			) : (
				<>
					{subscribers.map((sub) => (
						<div
							key={sub.id}
							className="bg-gray-900 rounded-lg p-3 border border-gray-800 hover:border-gray-700 transition-colors"
						>
							<div className="flex items-start justify-between mb-2">
								<div className="flex items-center gap-2">
									<Users size={14} className="text-orange-500" />
									<span className="text-sm font-semibold text-gray-200">{sub.component}</span>
								</div>
								<div className="flex items-center gap-3">
									<span className="text-xs text-gray-500">{sub.renderCount} renders</span>
									<span className="text-xs text-gray-600">{sub.lastRender}</span>
								</div>
							</div>
							<div className="flex flex-wrap gap-1.5">
								{sub.paths.length === 0 ? (
									<span className="text-xs text-gray-600 italic">No paths accessed yet</span>
								) : (
									sub.paths.map((path) => (
										<span
											key={path}
											className="text-xs bg-gray-800 text-blue-300 px-2 py-0.5 rounded"
										>
											{path}
										</span>
									))
								)}
							</div>
						</div>
					))}

					{mostFrequentSubscriber && mostFrequentSubscriber.renderCount > 5 && (
						<div className="mt-6 p-3 bg-gray-900/50 rounded border border-gray-800">
							<div className="text-xs text-gray-400 mb-2">💡 Performance Tip</div>
							<div className="text-xs text-gray-500">
								{mostFrequentSubscriber.component} is rendering frequently (
								{mostFrequentSubscriber.renderCount} times). Consider using more specific path
								subscriptions or memoization.
							</div>
						</div>
					)}
				</>
			)}
		</div>
	)
}

export default SubscribersView
