import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Locked'n – Your Personal AI Trainer App",
  description:
    "Revolutionary AI-powered form tracking using just your phone camera. Fix your form without going broke using your own 24/7 AI trainer...",
  other: {
    "color-scheme": "dark light",
  },
icons: {
  icon: [
    { url: "/favicon.ico", sizes: "any" },
    { url: "/logo.png", type: "image/png" },
  ],
  apple: "/logo.png",
},

};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
