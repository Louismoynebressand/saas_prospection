import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import SupabaseProvider from "@/components/providers/SupabaseProvider";
import { DebugStatus } from "@/components/debug/DebugStatus";
import { SidebarProvider } from "@/components/providers/SidebarContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SUPER Prospect",
  description: "SaaS Application by Neuraflow",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "bg-background antialiased font-sans"
        )}
      >
        <SupabaseProvider>
          <SidebarProvider>
            {/* App shell — flex row on md+, full height */}
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              {/* Main content column */}
              <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                <Topbar />
                <main className="flex-1 overflow-y-auto p-3 md:p-6 bg-secondary/30 relative
                                  pb-20 md:pb-6">
                  <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 pointer-events-none" />
                  <div className="relative z-10">
                    {children}
                  </div>
                  <Toaster />
                </main>
              </div>
            </div>
            {/* Mobile bottom navigation */}
            <MobileNav />
          </SidebarProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
