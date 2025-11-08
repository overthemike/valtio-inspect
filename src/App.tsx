import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./components/ui/resizable"
import { DemoApp } from "./demo/DemoApp"
import ValtioInspect from "./views/ValtioInspect"

export default function App() {
	return (
		<ResizablePanelGroup direction="horizontal" className="h-screen w-screen">
			<ResizablePanel defaultSize={50} minSize={30}>
				<DemoApp />
			</ResizablePanel>
			<ResizableHandle withHandle />
			<ResizablePanel defaultSize={50} minSize={30}>
				<ValtioInspect />
			</ResizablePanel>
		</ResizablePanelGroup>
	)
}
