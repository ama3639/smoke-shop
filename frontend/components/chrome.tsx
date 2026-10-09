import Link from "next/link";
import { ArrowUpLeft, ShoppingBag, ScanLine } from "lucide-react";

export function Header() {
  return (
    <>
      <div className="announcement">
        اسموک‌شاپ / کاتالوگ سیگار{" "}
        <span>اطلاعات عرضه حضوری عمده و تکی · ۱۸+</span>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="brand" aria-label="اسموک‌شاپ، صفحه اصلی">
            <span className="brand-icon">
              <ScanLine size={23} strokeWidth={1.5} />
            </span>
            <span>
              اسموک‌شاپ<small>SMOKESHOP / TOBACCO CATALOG</small>
            </span>
          </Link>
          <nav aria-label="منوی اصلی">
            <Link href="/#catalog">کاتالوگ وینستون</Link>
            <Link href="/#wholesale">همکاری عمده</Link>
            <Link href="/guide">واحدهای عرضه</Link>
            <Link href="/branches">شعب حضوری</Link>
          </nav>
          <Link href="/cart" className="cart-link">
            <ShoppingBag size={19} />
            <span>سبد اقلام مجاز</span>
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
            اسموک‌شاپ<span>کاتالوگ سیگار / عمده و تکی</span>
          </Link>
          <p>
            معرفی مدل‌ها، بسته‌بندی و اطلاعات همکاری با فروشگاه‌ها و مراکز پخش.
            نخستین برند: وینستون.
          </p>
        </div>
        <div>
          <h3>مسیرهای دسترسی</h3>
          <Link href="/#catalog">
            کاتالوگ وینستون <ArrowUpLeft size={15} />
          </Link>
          <Link href="/#wholesale">
            همکاری عمده <ArrowUpLeft size={15} />
          </Link>
          <Link href="/branches">
            شعب و اطلاعات مراجعه <ArrowUpLeft size={15} />
          </Link>
        </div>
        <div>
          <h3>اطلاعات عرضه</h3>
          <p>
            سیگار در این سایت امکان خرید اینترنتی ندارد. اطلاعات مراجعه حضوری
            فقط برای شعب ثبت‌شده نمایش داده می‌شود.
          </p>
          <Link href="/policy">
            شرایط عرضه و حریم خصوصی <ArrowUpLeft size={15} />
          </Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>مصرف دخانیات به سلامت آسیب می‌رساند.</span>
        <span dir="ltr">SMOKESHOP / TOBACCO CATALOG — 2026</span>
      </div>
    </footer>
  );
}
