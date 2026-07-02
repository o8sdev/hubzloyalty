import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoyaltyCRM — Customer growth for cafés & restaurants",
  description:
    "Collect more Google reviews, intercept complaints before they go public, and build a customer database that brings guests back.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
