"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { children: ReactNode; variant?: "primary" | "secondary" | "danger" }
export function Button({ children, className = "", variant = "primary", ...props }: ButtonProps) {
  const styles = { primary: "bg-[#176B5B] text-white hover:bg-[#125648]", secondary: "border border-[#D8DDD9] bg-white text-[#26302D] hover:bg-[#F5F7F5]", danger: "border border-[#E8C9C5] bg-[#FFF7F5] text-[#A33D32] hover:bg-[#FCEDE9]" };
  return <button className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}
