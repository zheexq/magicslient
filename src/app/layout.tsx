import type { Metadata } from "next";
import { AppProviders } from "@/components/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "MagicSlient",
  description: "Minimal anonymous rooms with real-time chat and native SOL payments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-ink font-sans text-slate-50">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
