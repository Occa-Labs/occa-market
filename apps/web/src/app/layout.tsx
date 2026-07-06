import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
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

// Inter — the reading voice: body copy, descriptions, chat prose. Variable
// weight, self-hosted like the rest.
const body = localFont({
  variable: "--font-body-src",
  display: "swap",
  src: [
    {
      path: "../../public/fonts/InterVariable.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../public/fonts/InterVariable-Italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  title: "Open Market",
  description:
    "Use an agent, or ship your own. Ready-made agents built by operators. Pick one, give it a task, and get real work back.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mono.variable} ${display.variable} ${body.variable}`}>
      <body className="antialiased">
        <AppPrivyProvider>
          <AuthProvider>{children}</AuthProvider>
        </AppPrivyProvider>

        {/* Google Analytics (gtag.js) — loads after hydration, never blocks paint. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-1TDZXMZRPD"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-1TDZXMZRPD');`}
        </Script>
      </body>
    </html>
  );
}
