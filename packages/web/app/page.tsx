"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function Page() {
	const [serverMetric, setServerMetric] = useState<{ cpu: number, ram: number, rtmp: number, flv: number }[]>([]);

  useEffect(() => {
    const get = async () => {
      try {
        const serverRequest = await fetch("http://localhost:8000/api/server")
        const sessionsRequest = await fetch("http://localhost:8000/api/sessions")

        const serverResponse = await serverRequest.json()
        const sessionsResponse = await sessionsRequest.json()

        setServerMetric(prev => [
          ...prev,
          {
            cpu: serverResponse.cpu.load ?? 0,
            ram: (serverResponse.nodejs?.mem?.heapUsed ?? 0) / 1024 / 1024,
            rtmp: sessionsResponse.rtpm ?? 0,
            flv: sessionsResponse.flv ?? 0
          }
        ])
      } catch (err) {
        console.error(err)
      }
    }

    get()
    const interval = setInterval(get, 1000)
    return () => clearInterval(interval)
  }, [])

  // monitorando mudanças
  useEffect(() => {
    console.log("serverMetric atualizado:", serverMetric)
  }, [serverMetric])

	return (
		<SidebarProvider
			style={
				{
					"--sidebar-width": "calc(var(--spacing) * 72)",
					"--header-height": "calc(var(--spacing) * 12)",
				} as React.CSSProperties
			}
		>
			<AppSidebar variant="inset" />
			<SidebarInset>
				<SiteHeader />
				<div className="flex flex-1 flex-col">
					<div className="@container/main flex flex-1 flex-col gap-2">
						<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
							<div className="px-4 lg:px-6 flex gap-4">
								<ChartAreaInteractive
                  data={serverMetric.map((m) => ({streams:  m.rtmp}))}
									title="Connected Streams"
									tooltip="Streams"
								/>
								<ChartAreaInteractive
                  data={serverMetric.map((m) => ({tracks: m.flv}))}
									title="Connected Tracks"
									tooltip="Tracks"
								/>
							</div>
							<div className="px-4 lg:px-6 flex gap-4">
								<ChartAreaInteractive title="Cpu Usage" tooltip="Cpu" 
                  data={serverMetric.map((m) => ({cpu: m.cpu}))}
                 />
								<ChartAreaInteractive title="Memory Usage" tooltip="Ram"
                  data={serverMetric.map((m) => ({ram: m.ram}))}
                 />
							</div>
						</div>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
