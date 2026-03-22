import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

function getMetadataBase() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredUrl) {
    return new URL(configuredUrl);
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return new URL(`https://${vercelUrl}`);
  }

  return new URL('http://localhost:3000');
}

export const metadata: Metadata = {
  title: "Quizly",
  description: "たのしく学べるクイズアプリ",
  metadataBase: getMetadataBase(),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Quizly",
    startupImage: ["/icons/icon-512.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    title: "Quizly",
    description: "たのしく学べるクイズアプリ",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Quizly" }],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quizly",
    description: "たのしく学べるクイズアプリ",
    images: ["/twitter-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className="bg-slate-50 font-sans antialiased selection:bg-slate-200 selection:text-slate-900"
        style={{ backgroundImage: "none" }}
      >
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
