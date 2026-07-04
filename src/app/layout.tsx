import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

// One typeface across the whole product — body, headings, labels. Exposed as
// --font-app; globals.css maps every font role (including Tailwind's
// font-sans/mono/serif) to it.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: "HUBz Loyalty — guest growth for cafés & restaurants",
  description:
    "Collect more Google reviews, intercept complaints before they go public, and build a customer database that brings guests back.",
  appleWebApp: {
    capable: true,
    title: "HUBz Loyalty",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover" as const,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={spaceGrotesk.variable}
    >
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
