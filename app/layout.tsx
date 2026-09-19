import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Dipakai untuk URL absolut pada metadata (OG image, canonical).
const SITE_URL = process.env.SITE_URL?.replace(/\/$/, "") || "http://localhost:4001";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Baleflix — Nonton Film & Series",
    template: "%s • Baleflix",
  },
  description: "Nonton ribuan film dan series favorit kapan saja, di mana saja.",
  openGraph: {
    siteName: "Baleflix",
    locale: "id_ID",
    type: "website",
    url: SITE_URL,
  },
  // Proyek demo dengan sumber tanpa lisensi: jangan diindeks mesin pencari.
  // Hapus blok ini kalau katalognya memang legal untuk dipublikasikan.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#0a0a0a] font-sans text-zinc-100">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-red-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Lewati ke konten utama
        </a>
        <Navbar />
        <main id="main" className="mx-auto min-h-[70vh] max-w-7xl px-4 pb-24 pt-16 sm:px-6 md:pb-0">
          {children}
        </main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
