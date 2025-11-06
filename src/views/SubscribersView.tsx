import { Users } from "lucide-react"

type Subscriber = {
	id: string
	component: string
	paths: string[]
	renderCount: number
	lastRender: string
}

export const SubscribersView: React.FC<{ subscribers: Subscriber[] }> = ({ subscribers }) => {
	return (
		<div className="p-4 space-y-2">
			<div className="text-xs text-gray-500 mb-4 flex items-center justify-between">
				<span>{subscribers.length} active subscribers</span>
				<span>Total renders: {subscribers.reduce((sum, s) => sum + s.renderCount, 0)}</span>
			</div>
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
						{sub.paths.map((path) => (
							<span key={path} className="text-xs bg-gray-800 text-blue-300 px-2 py-0.5 rounded">
								{path}
							</span>
						))}
					</div>
				</div>
			))}
			<div className="mt-6 p-3 bg-gray-900/50 rounded border border-gray-800">
				<div className="text-xs text-gray-400 mb-2">💡 Performance Tip</div>
				<div className="text-xs text-gray-500">
					TodoItem[0] is rendering frequently. Consider using more specific path subscriptions or
					memoization.
				</div>
			</div>
		</div>
	)
}

export default SubscribersView
