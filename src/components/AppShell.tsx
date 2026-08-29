import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Home, ShoppingBag, User, Users } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/family", label: "Family", icon: Users },
  { to: "/market", label: "Market", icon: ShoppingBag },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="gradient-warm sticky top-0 z-30 rounded-b-3xl px-5 pt-6 pb-7 shadow-card">
        <div className="mx-auto flex max-w-2xl items-end justify-between gap-4">
          <div>
            <h1 className="text-primary-foreground text-3xl">{title}</h1>
            {subtitle ? (
              <p className="text-primary-foreground/90 mt-1 text-sm font-medium">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </div>
      </header>

      <main className="mx-auto -mt-4 max-w-2xl px-4 pt-4">{children}</main>

      <nav
        aria-label="Main"
        className="bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur"
      >
        <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-2 py-1">
          {TABS.map((tab) => {
            const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
            const Icon = tab.icon;
            return (
              <li key={tab.to} className="flex-1">
                <Link
                  to={tab.to}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-xs font-semibold transition-colors",
                    active ? "text-primary bg-muted" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-6" strokeWidth={active ? 2.6 : 2} aria-hidden />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
