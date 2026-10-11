import Link from "next/link";
import { ArrowUpLeft, Box, Cigarette, Layers, Wind } from "lucide-react";
import type { Catalog } from "@/lib/api";

export const catalogRoutes = [
  { title: "سیگار", href: "/catalog?type=cigarette", detail: "مدل‌ها و بسته‌بندی", icon: Cigarette },
  { title: "ویپ و پاد", href: "/catalog?category=vape-pod", detail: "دستگاه و قطعات", icon: Wind },
  { title: "پیپ", href: "/catalog?category=pipe", detail: "مدل‌ها و ملزومات", icon: Layers },
  { title: "اکسسوری", href: "/catalog?type=accessory", detail: "ابزار و لوازم جانبی", icon: Box },
];

export function CatalogSections({ brands }: { brands: Catalog["brands"] }) {
  return (
    <section className="container catalog-discovery" aria-labelledby="discovery-heading">
      <div className="discovery-heading">
        <div><div className="eyebrow">مرور بر اساس گروه کالا</div><h2 id="discovery-heading">از دستهٔ مورد نظر شروع کنید.</h2></div>
        <Link href="/catalog">کاتالوگ کامل <ArrowUpLeft size={18} /></Link>
      </div>
      <div className="discovery-grid">
        {catalogRoutes.map(({ title, href, detail, icon: Icon }, index) => (
          <Link key={href} href={href} className="discovery-card" aria-label={`دسته ${title}`}>
            <span className="discovery-index" dir="ltr">0{index + 1}</span>
            <Icon className="discovery-icon" size={42} strokeWidth={1} aria-hidden="true" />
            <h3>{title}</h3><p>{detail}</p><ArrowUpLeft className="discovery-arrow" size={20} aria-hidden="true" />
          </Link>
        ))}
      </div>
      <div className="discovery-note"><span>محصولات ثبت‌شده در هر دسته نمایش داده می‌شوند.</span><Link href="/catalog?type=tobacco">سایر دخانیات <ArrowUpLeft size={15} /></Link></div>
      {brands.length > 0 && <div className="brand-index" aria-label="برندهای ثبت‌شده">
        <span>برندهای کاتالوگ سیگار</span>
        {brands.map(brand => <Link key={brand} href={`/catalog?type=cigarette&brand=${encodeURIComponent(brand)}`} dir="auto">{brand}</Link>)}
      </div>}
    </section>
  );
}
