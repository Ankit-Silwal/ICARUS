import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ICARUS Admin",
  description: "Administration for the ICARUS coding assessment platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
