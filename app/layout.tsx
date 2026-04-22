import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FloatingChat } from "@/components/chat/FloatingChat";
import { AppToaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { createClient } from "@/lib/supabase/server";
import type { Metadata, Viewport } from "next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IPL 2026 Auction Hub",
  description: "Sign in to participate",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  let profile = null;
  if (session?.user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    profile = prof || null;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider initialSession={session} initialProfile={profile}>
          <Navbar />
          <main className="min-w-0">{children}</main>
          {session?.user ? <Footer /> : null}
          {session?.user ? <FloatingChat /> : null}
          <AppToaster />
        </AuthProvider>
      </body>
    </html>
  );
}
