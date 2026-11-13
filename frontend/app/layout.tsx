import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Instantly — Your inbox, sorted for you.",
  description:
    "Instantly reads Gmail and Slack, then shows what needs you today.",
  openGraph: {
    title: "Instantly — Your inbox, sorted for you.",
    description:
      "Instantly reads Gmail and Slack, then shows what needs you today.",
    type: "website",
    siteName: "Instantly",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-[var(--bg-base)] font-sans text-[var(--text-primary)] antialiased selection:bg-[var(--accent)]/25 selection:text-white transition-colors duration-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
