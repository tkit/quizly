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
  description: "A fun learning app for kids",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${zenMaruGothic.variable} ${rocknRollOne.variable} font-sans antialiased selection:bg-yellow-200 selection:text-zinc-900 bg-yellow-50`}
      >
        {children}
      </body>
    </html>
  );
}
