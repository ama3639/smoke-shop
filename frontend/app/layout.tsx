import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "./globals.css";
import { Footer, Header } from "@/components/chrome";
import AgeGate from "@/components/age-gate";

export const metadata: Metadata = {
  title: {
    default: "اسموک‌شاپ | کاتالوگ سیگار، ویپ، پیپ و اکسسوری",
    template: "%s | اسموک‌شاپ",
  },
  description:
    "کاتالوگ فارسی کالاها، مشخصات، برندها و فروشندگان؛ اطلاعات عرضه حضوری و اقلام دارای مجوز.",
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
        <AgeGate />
      </body>
    </html>
  );
}
