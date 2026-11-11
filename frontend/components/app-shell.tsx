"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Inbox,
  FileText,
  Flame,
  CheckSquare,
  BarChart3,
  Plug,
  Users,
  Settings,
  Search,
  RefreshCw,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatRelativeTime, getInitials } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { LoadingDots } from "@/components/ui-primitives";
import { useToast } from "@/components/providers";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/ai-brief", label: "Daily brief", icon: FileText },
  { href: "/priority", label: "Priority", icon: Flame },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("instantly_token");
      if (!token) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/overview")}`);
        return;
      }
      setAuthChecked(true);
    }
  }, [pathname, router]);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
  });

  const { data: overview } = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.getNotifications,
  });

  const syncMutation = useMutation({
    mutationFn: api.triggerSync,
    onSuccess: (res) => {
      queryClient.invalidateQueries();
      notify("Synced", `${res.messages_analyzed} messages checked.`);
    },
  });

  const resetDemoMutation = useMutation({
    mutationFn: api.resetDemo,
    onSuccess: () => {
      queryClient.invalidateQueries();
      notify("Demo reset", "Sample messages restored.", "info");
      setProfileOpen(false);
    },
  });

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      router.push(`/inbox?search=${encodeURIComponent(globalSearch.trim())}`);
    } else {
      router.push("/inbox");
    }
  };

  const handleLogout = async () => {
    await api.logout();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("instantly_token");
    }
    notify("Signed out", "See you soon.", "info");
    router.push("/");
  };

  if (!authChecked) {
    return <div className="min-h-screen bg-[var(--bg-base)]" />;
  }

  const unreadNotifs = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-elevated)] transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:static",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo Row */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-[var(--border-subtle)]">
          <Link href="/overview" className="flex items-center">
            <Logo collapsed={collapsed} />
          </Link>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-primary)] transition"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-[var(--text-secondary)]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                data-testid={`nav-${item.href.replace("/", "")}`}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
                )}
              >
                {/* Sliding active bar */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-[var(--accent)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    active ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50"
                  )}
                />
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed &&
                  item.href === "/inbox" &&
                  overview?.total_unread ? (
                    <span className="ml-auto text-xs font-medium tabular-nums text-[var(--text-muted)]">
                      {overview.total_unread}
                    </span>
                  ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Quiet Single Demo Indicator & Sign Out */}
        <div className="border-t border-[var(--border-subtle)] p-3 space-y-1">
          {!collapsed && overview?.demo_mode_active && (
            <div className="flex items-center justify-between px-3 py-1.5 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                Demo mode
              </span>
              <button
                type="button"
                onClick={() => resetDemoMutation.mutate()}
                disabled={resetDemoMutation.isPending}
                data-testid="reset-demo-button"
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline-offset-4 hover:underline"
              >
                Reset
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            data-testid="logout-button"
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)] transition"
          >
            <LogOut className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Consistent Top Bar: Search, Sync Status, Notifications, Profile Menu */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/90 px-6 sm:px-8 backdrop-blur-md">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden rounded-lg border border-[var(--border-subtle)] p-2 text-[var(--text-secondary)]"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            <form onSubmit={handleGlobalSearchSubmit} className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search messages or people..."
                data-testid="global-search-input"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-9 pr-4 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition"
              />
            </form>
          </div>

          <div className="flex items-center gap-3">
            {/* One Sync Status */}
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="top-sync-button"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition tabular-nums"
              title="Sync Gmail and Slack"
            >
              {syncMutation.isPending ? (
                <LoadingDots />
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span className="hidden sm:inline">
                    Synced {formatRelativeTime(overview?.last_sync_at)}
                  </span>
                </>
              )}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setProfileOpen(false);
                }}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold tabular-nums text-white">
                    {unreadNotifs}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="animate-modal-in absolute right-0 mt-2 w-80 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-card z-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      Notifications
                    </span>
                    <button
                      onClick={async () => {
                        await api.markNotificationsRead();
                        queryClient.invalidateQueries({ queryKey: ["notifications"] });
                      }}
                      className="text-xs text-[var(--accent-soft)] hover:underline"
                    >
                      Mark read
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                        All caught up.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-[var(--border-subtle)]"
                        >
                          <p className="text-xs font-medium text-[var(--text-primary)]">
                            {n.title}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] mt-1">
                            {n.body}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 hover:border-[var(--border-strong)] transition"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-surface)] text-[11px] font-semibold text-[var(--accent-soft)]">
                  {getInitials(user?.full_name || "Alex Morgan")}
                </div>
                <span className="hidden md:inline text-xs font-medium text-[var(--text-primary)]">
                  {user?.full_name || "Alex Morgan"}
                </span>
              </button>

              {profileOpen && (
                <div className="animate-modal-in absolute right-0 mt-2 w-52 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-2 shadow-card z-50">
                  <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {user?.full_name || "Alex Morgan"}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      {user?.workspace_name || "Apex Workspace"}
                    </p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Link>
                    {overview?.demo_mode_active && (
                      <button
                        type="button"
                        onClick={() => resetDemoMutation.mutate()}
                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset demo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Workspace Canvas with generous breathing room & centered max-width */}
        <main className="flex-1 px-6 py-8 sm:px-10 sm:py-12 max-w-[1280px] w-full mx-auto animate-page-in">
          {children}
        </main>
      </div>
    </div>
  );
}
