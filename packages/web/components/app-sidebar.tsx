"use client";

import {
	IconCamera,
	IconChartBar,
	IconDashboard,
	IconDatabase,
	IconFileAi,
	IconFileDescription,
	IconFileWord,
	IconFolder,
	IconHelp,
	IconInnerShadowTop,
	IconListDetails,
	IconReport,
	IconSearch,
	IconSettings,
	IconUsers,
} from "@tabler/icons-react";
import { Bubbles, HardDrive, Video } from "lucide-react";
import type * as React from "react";
import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
	user: {
		name: "Hipermidia Admin",
		email: "m@example.com",
		avatar: "https://ui.shadcn.com/avatars/shadcn.jpg",
	},
	navMain: [
		{
			title: "Sessions",
			url: "/",
			icon: IconListDetails,
		},
    {
			title: "Server",
			url: "/server",
			icon: IconDashboard,
		},
    {
			title: "Streams",
			url: "/streams",
			icon: Video,
		},
	],
	soon: [
		{
			name: "Analytics",
			url: "#",
			icon: IconChartBar,
		},
		{
			name: "Projects",
			url: "#",
			icon: IconFolder,
		},
		{
			name: "Relay",
			url: "#",
			icon: Bubbles,
		},
    {
			name: "CDN",
			url: "#",
			icon: HardDrive,
		},
		{
			name: "Team",
			url: "#",
			icon: IconUsers,
		},
		{
			name: "Reports",
			url: "#",
			icon: IconReport,
		},
	],
	navSecondary: [
		{
			title: "Settings",
			url: "#",
			icon: IconSettings,
		},
		{
			title: "Get Help",
			url: "#",
			icon: IconHelp,
		},
		{
			title: "Search",
			url: "#",
			icon: IconSearch,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							className="data-[slot=sidebar-menu-button]:p-1.5!"
						>
							<a href="#">
								<IconInnerShadowTop className="size-5!" />
								<span className="text-base font-semibold">Hipermidia Inc.</span>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={data.navMain} />
				<NavDocuments items={data.soon} />
				<NavSecondary items={data.navSecondary} className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={data.user} />
			</SidebarFooter>
		</Sidebar>
	);
}
