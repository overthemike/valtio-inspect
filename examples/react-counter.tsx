import { proxy, useSnapshot } from "valtio"
import "valtio-plugin"

import { createDevtoolsPlugin } from "../src/lib/insectorPlugin"

proxy.use(createDevtoolsPlugin())

const counterState = proxy({
        count: 0,
        history: [] as number[],
})

export function Counter() {
        const snap = useSnapshot(counterState)

        const increment = () => {
                counterState.count += 1
                counterState.history.push(counterState.count)
        }

        const decrement = () => {
                counterState.count -= 1
                counterState.history.push(counterState.count)
        }

        return (
                <div className="flex flex-col gap-2 rounded border border-gray-800 p-4 bg-gray-900 text-gray-100">
                        <span className="text-sm uppercase tracking-wide text-gray-500">Counter example</span>
                        <span className="text-3xl font-semibold">{snap.count}</span>
                        <div className="flex gap-2">
                                <button type="button" className="px-2 py-1 rounded bg-gray-800" onClick={decrement}>
                                        -1
                                </button>
                                <button type="button" className="px-2 py-1 rounded bg-orange-600" onClick={increment}>
                                        +1
                                </button>
                        </div>
                        <pre className="bg-gray-950/50 rounded p-2 text-xs overflow-x-auto">
                                {JSON.stringify(snap.history, null, 2)}
                        </pre>
                </div>
        )
}
