"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

import { Logo } from "@/components/logo";
import { BRAND } from "@/lib/brand";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
    type LucideIcon,
    Home,
    Headphones,
    Mic,
    Users,
    LogOut,
    ChevronsUpDown,
    Settings,
} from "lucide-react";

interface MenuItem {
    title: string;
    url?: string;
    icon: LucideIcon;
    onClick?: () => void;
};

interface NavSectionProps {
    label?: string;
    items: MenuItem[];
    pathname: string;
};

function NavSection({ label, items, pathname }: NavSectionProps) {
    return (
        <SidebarGroup>
            {label && (
                <SidebarGroupLabel className="text-[13px] uppercase text-muted-foreground">
                    {label}
                </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                isActive={
                                    item.url
                                        ? item.url === "/"
                                            ? pathname === "/"
                                            : pathname.startsWith(item.url)
                                        : false
                                }
                                tooltip={item.title}
                                className="h-9 px-3 py-2 text-[13px] tracking-tight font-medium border border-transparent data-[active=true]:border-border data-[active=true]:shadow-sm"
                                render={(props) =>
                                    item.url ? (
                                        <Link href={item.url} {...props}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </Link>
                                    ) : (
                                        <button {...props} onClick={item.onClick}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </button>
                                    )
                                }
                            />
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

function userInitials(name?: string | null, email?: string | null) {
    const source = name?.trim() || email?.split("@")[0] || "";
    if (!source) return "?";
    const parts = source.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
}

function UserMenu() {
    const { data, status } = useSession();

    if (status === "loading") {
        return (
            <Skeleton className="h-8.5 w-full group-data-[collapsible=icon]:size-8 rounded-md border border-border bg-card" />
        );
    }

    const user = data?.user;
    const name = user?.name ?? user?.email ?? "Account";
    const email = user?.email ?? "";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center w-full gap-2 bg-card border border-border rounded-md pl-1 pr-2 py-1 shadow-[0px_1px_1.5px_0px_rgba(44,54,53,0.03)] hover:bg-accent/30 transition-colors group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:p-1">
                <Avatar className="size-6">
                    {user?.image ? <AvatarImage src={user.image} alt={name} /> : null}
                    <AvatarFallback className="text-[10px]">
                        {userInitials(user?.name, user?.email)}
                    </AvatarFallback>
                </Avatar>
                <span className="text-[13px] tracking-tight font-medium text-foreground truncate flex-1 text-left group-data-[collapsible=icon]:hidden">
                    {name}
                </span>
                <ChevronsUpDown className="size-4 text-sidebar-foreground group-data-[collapsible=icon]:hidden" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>
                        <div className="font-medium truncate">{name}</div>
                        {email && <div className="text-xs text-muted-foreground truncate font-normal">{email}</div>}
                    </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/sign-in" })}>
                    <LogOut className="size-4 mr-2" />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function DashboardSidebar() {
    const pathname = usePathname();

    const mainMenuItems: MenuItem[] = [
        { title: "Dashboard", url: "/dashboard", icon: Home },
        { title: "Practice", url: "/practice", icon: Mic },
        { title: "Bar-Raiser panel", url: "/mock", icon: Users },
    ];

    const othersMenuItems: MenuItem[] = [
        { title: "Settings", url: "/settings", icon: Settings },
        { title: "Help and support", url: `mailto:${BRAND.supportEmail}`, icon: Headphones },
    ];

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="flex flex-col gap-4 pt-4">
                <div className="flex items-center gap-2 pl-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pl-0">
                    <span className="hidden size-7 shrink-0 items-center justify-center rounded-md bg-foreground font-display text-sm font-semibold text-background group-data-[collapsible=icon]:flex">
                        A
                    </span>
                    <Logo className="group-data-[collapsible=icon]:hidden" />
                    <SidebarTrigger className="ml-auto lg:hidden" />
                </div>
            </SidebarHeader>
            <div className="border-b border-dashed border-border" />
            <SidebarContent>
                <NavSection items={mainMenuItems} pathname={pathname} />
                <NavSection label="Others" items={othersMenuItems} pathname={pathname} />
            </SidebarContent>
            <div className="border-b border-dashed border-border" />
            <SidebarFooter className="gap-2 py-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <UserMenu />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
