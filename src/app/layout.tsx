import type { Metadata } from "next";
import { Fraunces, Schibsted_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// Marketing typography. Exposed as CSS variables so the owner app keeps its
// system-font look; only .mkt surfaces opt in.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-display",
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
});

const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-mono-mkt",
});

export const metadata: Metadata = {
  title: "LoyaltyCRM — Customer growth for cafés & restaurants",
  description:
    "Collect more Google reviews, intercept complaints before they go public, and build a customer database that brings guests back.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${schibsted.variable} ${splineMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
