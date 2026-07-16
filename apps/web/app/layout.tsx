import type { Metadata } from "next";

import { ThemeProvider } from "@/components/theme-provider";
import { THEME_STORAGE_KEY } from "@/lib/theme-storage";
import { yekanBakhFaEn } from "~/fonts/yekan-bakh";

import "./globals.css";

export const metadata: Metadata = {
  title: "دیوان",
  description: "سامانه منابع انسانی دیوان",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${yekanBakhFaEn.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey={THEME_STORAGE_KEY}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
