import { Bell, ChevronDown, Feather, Search } from "lucide-react";
import type { ReactNode } from "react";
import { AuthGate, type Role } from "./auth-gate";

export interface NavItem {
  label: string;
  active?: boolean;
  href?: string;
  icon: ReactNode;
}

export function AppShell({
  role,
  name,
  initials,
  navigation,
  children,
}: {
  role: string;
  name: string;
  initials: string;
  navigation: NavItem[];
  children: ReactNode;
}) {
  return (
    <AuthGate requiredRole={role.toUpperCase() as Role}>
      <div className="min-h-screen bg-[#F4F6F3] text-[#1F2926]">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-[#D8DED9] bg-[#172520] text-white lg:flex lg:flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
            <span className="grid size-8 place-items-center rounded-md bg-[#DFF36D] text-[#172520]">
              <Feather size={18} strokeWidth={2.4} />
            </span>
            <div>
              <div className="text-[15px] font-bold tracking-[0.16em]">
                ICARUS
              </div>
              <div className="text-[10px] text-white/50">CODE ASSESSMENT</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-5">
            {navigation.map((item) => {
              const className = `flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition ${item.active ? "bg-white/12 text-white" : "text-white/60 hover:bg-white/6 hover:text-white"}`;
              return item.href ? (
                <a key={item.label} href={item.href} className={className}>
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              ) : (
                <button key={item.label} className={className}>
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-4">
            <div className="mb-1 text-[10px] font-semibold uppercase text-white/35">
              Workspace
            </div>
            <div className="text-xs text-white/70">Public platform · MVP</div>
          </div>
        </aside>
        <div className="lg:pl-60">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#D8DED9] bg-white/95 px-5 backdrop-blur md:px-8">
            <div className="relative hidden w-80 md:block">
              <Search
                className="absolute left-3 top-2.5 text-[#7C8984]"
                size={16}
              />
              <input
                aria-label="Search"
                className="h-9 w-full rounded-md border border-[#D8DED9] bg-[#F8F9F7] pl-9 pr-3 text-sm outline-none focus:border-[#176B5B]"
                placeholder="Search"
              />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button
                aria-label="Notifications"
                className="grid size-9 place-items-center rounded-md border border-[#D8DED9] text-[#60706A]"
              >
                <Bell size={17} />
              </button>
              <span className="grid size-8 place-items-center rounded-md bg-[#DFF36D] text-xs font-bold text-[#172520]">
                {initials}
              </span>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold leading-4">{name}</div>
                <div className="text-[11px] capitalize text-[#7C8984]">
                  {role.toLowerCase()}
                </div>
              </div>
              <ChevronDown size={15} className="text-[#7C8984]" />
            </div>
          </header>
          <main className="mx-auto max-w-[1440px] p-5 md:p-8">{children}</main>
        </div>
      </div>
    </AuthGate>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "neutral";
}) {
  const colors = {
    green: "bg-[#E5F4ED] text-[#176B5B]",
    amber: "bg-[#FFF3D8] text-[#8B5D0B]",
    red: "bg-[#FCE8E5] text-[#A33D32]",
    neutral: "bg-[#EEF1EE] text-[#5E6C67]",
  };
  return (
    <span
      className={`inline-flex rounded px-2 py-1 text-[11px] font-bold uppercase ${colors[tone]}`}
    >
      {children}
    </span>
  );
}
