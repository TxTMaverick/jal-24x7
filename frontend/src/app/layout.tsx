import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "leaflet/dist/leaflet.css";
import "./globals.css";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ServerWakingBanner } from "@/components/ui";
import { AuthProvider } from "@/store/auth";
import { CartProvider } from "@/store/cart";
import { ToastProvider } from "@/store/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "JAL 24×7, Clean Water, Delivered Anytime",
    template: "%s · JAL 24×7",
  },
  description:
    "Book water bottles, 20L cans, campers and tankers from verified local suppliers. Live order tracking, transparent pricing, 24×7 availability.",
};

export const viewport: Viewport = {
  themeColor: "#1f80f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <div className="flex min-h-dvh flex-col">
                <Header />
                <ServerWakingBanner />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
