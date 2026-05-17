import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GFCH | Global Franchise Control Hub",
  description: "B2B Franchise Management Platform",
};

import { Providers } from "./providers";
import { RouteGuard } from "@/components/layout/route-guard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.className} bg-background min-h-screen w-screen overflow-hidden`} suppressHydrationWarning>
        <Providers>
          <RouteGuard>
            {children}
          </RouteGuard>
        </Providers>
      </body>
    </html>
  );
}
