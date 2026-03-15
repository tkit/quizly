import type { Metadata } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-maru",
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
        className={`${zenMaruGothic.variable} font-sans antialiased selection:bg-yellow-200 selection:text-zinc-900 bg-yellow-50`}
      >
        {children}
      </body>
    </html>
  );
}
