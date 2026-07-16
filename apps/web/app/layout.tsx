import type { Metadata } from "next";

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
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
