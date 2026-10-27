import Link from "next/link";
import { ArrowUpLeft, Flame, Search } from "lucide-react";
import { catalogRoutes } from "./catalog-sections";
import HeaderActions from "./header-actions";
import { ServiceRow } from "./home-content";
import { serverApi } from "@/lib/api";

async function identity() {
  try {
    return await serverApi<{
      display_name: string;
      support_phone: string;
      support_email: string;
    }>("site/");
  } catch {
    return { display_name: "اسموک‌شاپ", support_phone: "", support_email: "" };
  }
}

export async function Header() {
  const site = await identity();
  return (
    <>
      <div className="announcement">
        اسموک‌شاپ / کاتالوگ چندفروشنده{" "}
        <span>اطلاعات عرضه حضوری عمده و تکی · ۱۸+</span>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Link
            href="/"
            className="brand"
            aria-label={`${site.display_name}، صفحه اصلی`}
          >
            <span className="brand-icon">
              <Flame size={29} strokeWidth={1.3} />
            </span>
            <span>
              {site.display_name}
              <small>SMOKESHOP / CATALOG</small>
            </span>
          </Link>
          <form
            action="/search"
            className="header-search"
            role="search"
            aria-label="جست‌وجوی کل کاتالوگ"
          >
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              name="q"
              aria-label="جست‌وجوی همه کالاها"
              placeholder="جست‌وجوی کالا، مدل یا برند"
              maxLength={100}
            />
            <button type="submit" aria-label="اجرای جست‌وجو">
              <ArrowUpLeft size={18} />
            </button>
          </form>
          <HeaderActions />
        </div>
        <div className="container header-navigation">
          <nav aria-label="منوی اصلی">
            {catalogRoutes.map((route) => (
              <Link key={route.href} href={route.href}>
                {route.title}
              </Link>
            ))}
            <Link href="/brands">برندها</Link>
            <Link href="/catalog">همه کالاها</Link>
          </nav>
          <div className="header-utilities">
            <Link href="/sellers">فروشندگان</Link>
            <Link href="/branches">شعب حضوری</Link>
            <Link href="/guide">راهنمای عرضه</Link>
          </div>
        </div>
      </header>
    </>
  );
}
export async function Footer() {
  const site = await identity();
  return (
    <footer className="footer">
      <ServiceRow />
      <div className="container footer-top">
        <div>
          <Link className="footer-brand" href="/">
            {site.display_name}
            <span>کاتالوگ کالا / عمده و تکی</span>
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
          <Link href="/manage">پنل فروشندگان و مدیریت</Link>
          <Link href="/supplier">حساب تأمین‌کننده</Link>
          {site.support_phone && (
            <a href={`tel:${site.support_phone}`}>{site.support_phone}</a>
          )}
          {site.support_email && (
            <a href={`mailto:${site.support_email}`}>{site.support_email}</a>
          )}
          <Link href="/sellers">
            فروشندگان <ArrowUpLeft size={15} />
          </Link>
          <Link href="/guide">
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
