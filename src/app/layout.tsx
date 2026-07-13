import type { Metadata } from "next";
import { K2D, Geist_Mono } from "next/font/google";
import { BottomNav } from "@/components/shared/bottom-nav";
import { TopNav } from "@/components/shared/top-nav";
import "./globals.css";

const k2d = K2D({
  variable: "--font-k2d",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spenda",
  description: "Personal expense & behavioral tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${k2d.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col pb-16">
        <TopNav />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
