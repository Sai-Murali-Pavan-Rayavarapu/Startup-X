import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Navura AI Podcast Studio",
  description: "Calendar-driven podcast production desk for Navura Media.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
