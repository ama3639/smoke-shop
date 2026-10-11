import Link from "next/link";
import { ArrowUpLeft, ShoppingBag, ScanLine, Search } from "lucide-react";
import { catalogRoutes } from "./catalog-sections";

export function Header() {
  return (
    <>
      <div className="announcement">
        اسموک‌شاپ / کاتالوگ چندفروشنده{" "}
        <span>اطلاعات عرضه حضوری عمده و تکی · ۱۸+</span>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="brand" aria-label="اسموک‌شاپ، صفحه اصلی">
            <span className="brand-icon">
              <ScanLine size={23} strokeWidth={1.5} />
            </span>
            <span>
              اسموک‌شاپ<small>SMOKESHOP / CATALOG</small>
            </span>
          </Link>
          <form action="/catalog" className="header-search" role="search" aria-label="جست‌وجوی کل کاتالوگ">
            <Search size={18} aria-hidden="true" />
            <input type="search" name="q" aria-label="جست‌وجوی همه کالاها" placeholder="جست‌وجوی کالا، مدل یا برند" maxLength={100} />
            <button type="submit" aria-label="اجرای جست‌وجو"><ArrowUpLeft size={18} /></button>
          </form>
          <Link href="/cart" className="cart-link" aria-label="سبد اقلام مجاز">
            <ShoppingBag size={19} />
            <span>سبد اقلام مجاز</span>
          </Link>
        </div>
        <div className="container header-navigation">
          <nav aria-label="منوی اصلی">
            {catalogRoutes.map(route => <Link key={route.href} href={route.href}>{route.title}</Link>)}
            <Link href="/catalog">همه کالاها</Link>
          </nav>
          <div className="header-utilities"><Link href="/sellers">فروشندگان</Link><Link href="/branches">شعب حضوری</Link><Link href="/guide">راهنمای عرضه</Link></div>
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
            اسموک‌شاپ<span>کاتالوگ کالا / عمده و تکی</span>
          </Link>
          <p>
            معرفی مدل‌ها، بسته‌بندی و اطلاعات همکاری با فروشگاه‌ها و مراکز پخش.
            نخستین برند: وینستون.
          </p>
        </div>
        <div>
          <h3>مسیرهای دسترسی</h3>
          <Link href="/catalog">
            همه کالاها <ArrowUpLeft size={15} />
          </Link>
          <Link href="/sellers">فروشندگان <ArrowUpLeft size={15} /></Link>
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

