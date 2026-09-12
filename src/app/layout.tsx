import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Grok Bot Lobby",
  description: "See bots in the room, see what they're working on, pick a bot or squad.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-[#0d0d0d] font-sans text-[12px] text-white/80">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
