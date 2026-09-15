import type { ReactNode } from "react";
export function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <div className="border-r border-[#E4E8E4] px-5 last:border-r-0"><div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-[#74817C]"><span>{label}</span><span className="text-[#176B5B]">{icon}</span></div><div className="text-2xl font-bold text-[#1B2622]">{value}</div><div className="mt-1 text-xs text-[#82908A]">{detail}</div></div>;
}
