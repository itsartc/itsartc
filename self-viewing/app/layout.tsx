import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DemoProvider } from "@/lib/state";

export const metadata: Metadata = {
  title: "Self-Viewing Prototype",
  description: "AI-guided self-viewing — buyer flow prototype (all integrations mocked).",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <DemoProvider>
          {/* Phone-width column; on desktop it reads as a device frame. */}
          <div className="mx-auto min-h-[100dvh] max-w-md bg-slate-50 shadow-xl sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:overflow-hidden sm:rounded-[2rem] sm:ring-1 sm:ring-slate-300">
            {children}
          </div>
        </DemoProvider>
      </body>
    </html>
  );
}
