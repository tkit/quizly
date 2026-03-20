import type { Metadata } from "next";
import { RocknRoll_One, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-maru",
  display: "swap",
});

const rocknRollOne = RocknRoll_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-rocknroll",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quizly",
  description: "たのしく学べるクイズアプリ",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${zenMaruGothic.variable} ${rocknRollOne.variable} font-sans antialiased selection:bg-teal-100 selection:text-slate-900 bg-slate-50`}
        style={{ backgroundImage: "none" }}
      >
        {children}
      </body>
    </html>
  );
}
