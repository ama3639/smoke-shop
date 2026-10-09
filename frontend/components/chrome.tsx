import Link from "next/link";
import { ArrowUpLeft, ShoppingBag, ScanLine } from "lucide-react";

export function Header() {
  return (
    <>
      <div className="announcement">
        انتخاب آگاهانه، بر پایه مشخصات و سازگاری{" "}
        <span>کاتالوگ تخصصی اکسسوری</span>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="brand" aria-label="اسموک‌شاپ، صفحه اصلی">
            <span className="brand-icon">
              <ScanLine size={23} strokeWidth={1.5} />
            </span>
            <span>
              اسموک‌شاپ<small>SMOKESHOP / ACCESSORIES</small>
            </span>
          </Link>
          <nav aria-label="منوی اصلی">
            <Link href="/#catalog">کاتالوگ</Link>
            <Link href="/#finder">سازگاری قطعات</Link>
            <Link href="/guide">راهنمای نگهداری</Link>
            <Link href="/branches">شعب حضوری</Link>
          </nav>
          <Link href="/cart" className="cart-link">
            <ShoppingBag size={19} />
            <span>سبد خرید</span>
          </Link>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-top">
        <div>
          <Link className="footer-brand" href="/">
            اسموک‌شاپ<span>انتخاب دقیق. نگهداری بهتر.</span>
          </Link>
          <p>
            کاتالوگ تخصصی قطعات و اکسسوری، با مشخصات روشن و وضعیت عرضه شفاف.
          </p>
        </div>
        <div>
          <h3>مسیرهای دسترسی</h3>
          <Link href="/#catalog">
            کاتالوگ قطعات <ArrowUpLeft size={15} />
          </Link>
          <Link href="/guide">
            راهنمای نگهداری <ArrowUpLeft size={15} />
          </Link>
          <Link href="/branches">
            اطلاعات شعب <ArrowUpLeft size={15} />
          </Link>
        </div>
        <div>
          <h3>شفافیت در عرضه</h3>
          <p>
            خرید آنلاین فقط برای کالاهای دارای تأیید حقوقی و در دسته‌های فعال
            امکان‌پذیر است.
          </p>
          <Link href="/policy">
            شرایط عرضه و حریم خصوصی <ArrowUpLeft size={15} />
          </Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>اسموک‌شاپ · زیرساخت انتخاب آگاهانه</span>
        <span dir="ltr">EST. 2026 — BUILT WITH CARE</span>
      </div>
    </footer>
  );
}
