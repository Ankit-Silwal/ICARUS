import type { ReactNode } from "react";
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`rounded-lg border border-[#DDE2DE] bg-white ${className}`}>{children}</section>; }
