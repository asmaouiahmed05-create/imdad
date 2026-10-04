import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ImdadDZ | إدارة المخازن",
  description: "لوحة متابعة المخزون وإدارة الأصناف في ImdadDZ.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} dark min-h-full antialiased`}
    >
      <body className="min-h-screen bg-slate-950 font-sans text-slate-100">
        <div className="min-h-screen md:flex">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Topbar />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
