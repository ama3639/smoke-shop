import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "./globals.css";
import { Footer, Header } from "@/components/chrome";

export const metadata: Metadata = {
  title: {
    default: "اسموک‌شاپ | کاتالوگ سیگار وینستون، عمده و تکی",
    template: "%s | اسموک‌شاپ",
  },
  description:
    "معرفی مدل‌های سیگار وینستون، مشخصات بسته و باکس، اطلاعات عرضه حضوری تکی و همکاری عمده.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          رفتن به محتوای اصلی
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
