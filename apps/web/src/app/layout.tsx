import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppPrivyProvider } from "@/components/auth/app-privy-provider";
import { AuthProvider } from "@/components/auth/auth-provider";

// KH Teka Mono — primary UI / body / HUD voice.
const mono = localFont({
  variable: "--font-mono-src",
  display: "swap",
  src: [
    { path: "../../public/fonts/KHTekaMono-Light.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/KHTekaMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/KHTekaMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/KHTekaMono-Semibold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/KHTekaMono-Bold.woff2", weight: "700", style: "normal" },
  ],
});

// KH Teka — display / headings.
const display = localFont({
  variable: "--font-display-src",
  display: "swap",
  src: [
    { path: "../../public/fonts/KHTeka-Light.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/KHTeka-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/KHTeka-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/KHTeka-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/KHTeka-Black.woff2", weight: "900", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Open Market",
  description:
    "The open agent marketplace. Browse ready-made agents, put them to work, pay in USDC.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mono.variable} ${display.variable}`}>
      <body className="antialiased">
        <AppPrivyProvider>
          <AuthProvider>{children}</AuthProvider>
        </AppPrivyProvider>
      </body>
    </html>
  );
}
