import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import type { Catalog } from "@/lib/api";
import ReferenceArt, { ReferenceArea } from "./reference-art";
export const catalogRoutes: {
  title: string;
  href: string;
  detail: string;
  area: ReferenceArea;
}[] = [
  {
    title: "سیگار",
    href: "/catalog?type=cigarette",
    detail: "مدل‌ها و بسته‌بندی",
    area: "cigarette",
  },
  {
    title: "ویپ و پاد",
    href: "/catalog?category=vape-pod",
    detail: "دستگاه و قطعات",
    area: "vape",
  },
  {
    title: "پیپ",
    href: "/catalog?category=pipe",
    detail: "مدل‌ها و ملزومات",
    area: "pipe",
  },
  {
    title: "قلیان",
    href: "/catalog?category=hookah",
    detail: "مدل‌ها و تجهیزات",
    area: "hookah",
  },
  {
    title: "تنباکو",
    href: "/catalog?type=tobacco",
    detail: "برند، طعم و وزن",
    area: "tobacco",
  },
  {
    title: "اکسسوری",
    href: "/catalog?type=accessory",
    detail: "ابزار و لوازم جانبی",
    area: "accessory",
  },
];
export function CatalogSections({ brands }: { brands: Catalog["brands"] }) {
  return (
    <section
      className="container catalog-discovery"
      aria-labelledby="discovery-heading"
    >
      <div className="discovery-heading">
        <h2 id="discovery-heading">دسته‌بندی محصولات</h2>
        <Link href="/catalog">
          مشاهده همه دسته‌ها <ArrowUpLeft size={16} />
        </Link>
      </div>
      <div className="discovery-grid">
        {catalogRoutes.map(({ title, href, detail, area }) => (
          <Link
            href={href}
            key={href}
            className="discovery-card"
            aria-label={`دسته ${title}`}
          >
            <ReferenceArt area={area} />
            <div className="discovery-copy">
              <h3>{title}</h3>
              <p>{detail}</p>
              <ArrowUpLeft
                className="discovery-arrow"
                size={20}
                aria-hidden="true"
              />
            </div>
          </Link>
        ))}
      </div>
      <div className="discovery-note">
        <span>
          تصاویر دسته‌ها نمایشی‌اند؛ محصولات ثبت‌شده در کاتالوگ نمایش داده
          می‌شوند.
        </span>
        <Link href="/catalog?type=accessory">
          اکسسوری و ملزومات <ArrowUpLeft size={15} />
        </Link>
      </div>
      {brands.length > 0 && (
        <div className="brand-index" aria-label="برندهای ثبت‌شده">
          <span>برندهای کاتالوگ سیگار</span>
          {brands.map((brand) => (
            <Link
              key={brand}
              href={`/catalog?type=cigarette&brand=${encodeURIComponent(brand)}`}
              dir="auto"
            >
              {brand}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
