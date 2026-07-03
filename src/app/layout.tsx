import type { Metadata, Viewport } from "next";
import { Cinzel, Jost } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["400", "600", "700", "900"],
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0e0b08",
};

export const metadata: Metadata = {
  title: "Blackjack Club — Play 21",
  description:
    "A play-money blackjack table. Free chips, real rules — blackjack pays 3 to 2.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${cinzel.variable} ${jost.variable} antialiased`}>
        {children}
        <span className="pointer-events-none fixed bottom-2 left-3 z-50 font-mono text-[10px] text-[var(--cream)]/30 select-none">
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </span>
        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            style: {
              background: "#171009",
              border: "1px solid rgba(201,162,39,.35)",
              color: "#f6eeda",
            },
          }}
        />
      </body>
    </html>
  );
}
