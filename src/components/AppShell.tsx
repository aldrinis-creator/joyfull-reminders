import { Link, useRouterState } from "@tanstack/react-router";
import { Gift, ListChecks, Plus, ShoppingBag, Users } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useLanguage";
import { AlarmHost } from "@/components/AlarmHost";
import { PushSetupPrompt } from "@/components/PushSetupPrompt";
import { UpdateBanner } from "@/components/UpdateBanner";
import { usePushTokenRefresh } from "@/hooks/usePushTokenRefresh";



const TABS = [
  { to: "/home", labelKey: "nav.today", icon: ListChecks },
  { to: "/family", labelKey: "nav.people", icon: Users },
  { to: "/market", labelKey: "nav.gifts", icon: Gift },
  { to: "/orders", labelKey: "nav.orders", icon: ShoppingBag },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  action,
  hideHeader = false,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
  hideHeader?: boolean | undefined;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  usePushTokenRefresh();



  return (
    <div className="min-h-screen bg-background pb-24">
      {!hideHeader ? (
        <header className="bg-background sticky top-0 z-30 border-b border-border px-[22px] pt-5 pb-4">
          <div className="mx-auto flex max-w-2xl items-end justify-between gap-4">
            <div>
            <h1 className="text-foreground text-3xl">{title}</h1>
            {subtitle ? (
              <p className="text-muted-foreground mt-1 text-sm font-semibold">{subtitle}</p>
            ) : null}
            </div>
            {action}
          </div>
        </header>
      ) : null}

      <main className={cn("mx-auto max-w-2xl", hideHeader ? "" : "px-[22px] pt-5")}>{children}</main>

      <nav
        aria-label={t("nav.mainLabel")}
        className="bg-background fixed inset-x-0 bottom-0 z-40 border-t border-border"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-5 items-end px-[18px] pt-[10px] pb-[18px]">
          {TABS.slice(0, 2).map((tab) => {
            const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
            const Icon = tab.icon;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className="text-foreground flex min-h-14 flex-col items-center justify-end gap-1 px-1 text-[11.5px] font-semibold"
                >
                  <span className={cn("size-[7px] rounded-full", active ? "bg-primary" : "bg-transparent")} />
                  <Icon className="size-5" strokeWidth={2} aria-hidden />
                  {t(tab.labelKey)}
                </Link>
              </li>
            );
          })}
          <li className="flex justify-center">
            <Link
              to="/reminders/new"
              search={{}}
              aria-label={t("nav.addReminder")}
              className="bg-primary text-primary-foreground shadow-lifted -mt-7 flex size-[60px] items-center justify-center rounded-full"
            >
              <Plus className="size-7" strokeWidth={2.2} aria-hidden />
            </Link>
          </li>
          {TABS.slice(2).map((tab) => {
            const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
            const Icon = tab.icon;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className="text-foreground flex min-h-14 flex-col items-center justify-end gap-1 px-1 text-[11.5px] font-semibold"
                >
                  <span className={cn("size-[7px] rounded-full", active ? "bg-primary" : "bg-transparent")} />
                  <Icon className="size-5" strokeWidth={2} aria-hidden />
                  {t(tab.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <UpdateBanner />
      <AlarmHost />
      <PushSetupPrompt />
    </div>
  );
}
