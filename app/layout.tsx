import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "На двоих",
  description: "Общие запасы, меню и покупки для двоих",
  applicationName: "На двоих",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "На двоих" },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#173f35"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
