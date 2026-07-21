import type { Metadata, Viewport } from "next";
import "./globals.css";
import TabNav from "@/components/TabNav";
import ChatSheet from "@/components/ChatSheet";

export const metadata: Metadata = {
  title: "Garden",
  description: "AI-powered vegetable garden planner",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Garden",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3a7d44",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-stone-50 text-stone-900 antialiased">
        <div className="mx-auto max-w-2xl min-h-dvh pb-24">{children}</div>
        <TabNav />
        <ChatSheet />
      </body>
    </html>
  );
}
