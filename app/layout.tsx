import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ChatCode — Gasless Wallet-to-Wallet Chat",
  description:
    "End-to-end encrypted messaging between wallets, with feedback organized by chat codes. No accounts, no database, no fees.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://chatcode-app.vercel.app"),
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "ChatCode — Gasless Wallet-to-Wallet Chat",
    description:
      "End-to-end encrypted messaging between wallets, with feedback organized by chat codes. No accounts, no database, no fees.",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://chatcode-app.vercel.app",
    siteName: "ChatCode",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ChatCode — Gasless Wallet-to-Wallet Chat",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChatCode — Gasless Wallet-to-Wallet Chat",
    description:
      "End-to-end encrypted messaging between wallets, with feedback organized by chat codes. No accounts, no database, no fees.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="min-h-full flex flex-col bg-surface-container-lowest font-body-md text-on-surface antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
