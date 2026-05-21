import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "kDupe — K-beauty intelligence. Free forever.",
  description:
    "Paste any skincare product and instantly find the K-beauty alternative with the same active ingredients — at a fraction of the price.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`}>
      <body
        className="min-h-screen antialiased"
        style={{
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          fontWeight: 300,
          background: "#0a0a0a",
          color: "#f5f0eb",
        }}
      >
        {children}
      </body>
    </html>
  );
}
