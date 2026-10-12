"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpLeft,
  FileCheck,
  Headphones,
  MapPin,
  PackageSearch,
} from "lucide-react";
import type { Catalog, ProductPage } from "@/lib/api";
import MotionScene from "./motion-scene";
import { CatalogSections } from "./catalog-sections";
import ProductCard from "./product-card";
import ReferenceArt, { ReferenceArea } from "./reference-art";
export function ServiceRow() {
  const items = [
    {
      title: "تصاویر و مشخصات",
      detail: "بررسی اطلاعات کالا",
      href: "/guide",
      icon: FileCheck,
    },
    {
      title: "مدل‌های ثبت‌شده",
      detail: "مرور کاتالوگ",
      href: "/catalog",
      icon: PackageSearch,
    },
    {
      title: "عرضه حضوری",
      detail: "اطلاعات شعب",
      href: "/branches",
      icon: MapPin,
    },
    {
      title: "تماس با شعب",
      detail: "اطلاعات تماس ثبت‌شده",
      href: "/branches",
      icon: Headphones,
    },
  ];
  return (
    <div className="service-row">
      <div className="container service-grid">
        {items.map(({ title, detail, href, icon: Icon }) => (
          <Link href={href} key={title}>
            <Icon size={27} strokeWidth={1.2} />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
export default function HomeContent({
  products,
  catalog,
  unavailable,
}: {
  products: ProductPage;
  catalog: Catalog;
  unavailable: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const editorials: {
    title: string;
    copy: string;
    href: string;
    area: ReferenceArea;
  }[] = [
    {
      title: "قلیان و ملزومات",
      copy: "مدل‌ها و قطعات ثبت‌شده",
      href: "/catalog?category=hookah",
      area: "hookah",
    },
    {
      title: "دستگاه و قطعات",
      copy: "مرور دسته ویپ و پاد",
      href: "/catalog?category=vape-pod",
      area: "vape",
    },
    {
      title: "مشخصات هر بسته",
      copy: "برند، طعم و وزن تنباکو",
      href: "/catalog?type=tobacco",
      area: "tobacco",
    },
    {
      title: "برندهای کاتالوگ",
      copy: "فهرست برندهای ثبت‌شده",
      href: "/brands",
      area: "accessory",
    },
  ];
  return (
    <div
      className={`homepage-shell ${paused || reduced ? "motion-paused" : ""}`}
    >
      <MotionScene
        paused={paused}
        reduced={reduced}
        onPause={() => setPaused((v) => !v)}
      />
      <ServiceRow />
      <CatalogSections brands={catalog.brands} />
      <section
        className="container home-section"
        id="catalog"
        aria-labelledby="featured-heading"
      >
        <div className="section-heading">
          <h2 id="featured-heading">منتخب کاتالوگ سیگار</h2>
          <Link href="/catalog?type=cigarette">
            مشاهده همه محصولات <ArrowUpLeft size={16} />
          </Link>
        </div>
        {unavailable ? (
          <div className="empty-state" role="alert">
            <h3>کاتالوگ در دسترس نیست</h3>
            <p>دریافت اطلاعات انجام نشد.</p>
            <button
              className="button secondary"
              onClick={() => location.reload()}
            >
              تلاش دوباره
            </button>
          </div>
        ) : products.items.length ? (
          <div className="product-grid home-products">
            {products.items.slice(0, 6).map((p, i) => (
              <ProductCard product={p} index={i + 1} key={p.id} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>هنوز محصولی برای نمایش ثبت نشده است.</p>
            <Link href="/catalog" className="button secondary">
              کاتالوگ کامل
            </Link>
          </div>
        )}
      </section>
      <section
        className="container home-section"
        id="brands"
        aria-labelledby="editorial-heading"
      >
        <div className="section-heading">
          <h2 id="editorial-heading">از مدل تا مشخصات</h2>
          <Link href="/brands">
            مشاهده برندها <ArrowUpLeft size={16} />
          </Link>
        </div>
        <div className="editorial-grid">
          {editorials.map((e) => (
            <Link className="editorial-card" href={e.href} key={e.href}>
              <div className="editorial-copy">
                <h3>{e.title}</h3>
                <p>{e.copy}</p>
                <span>
                  مشاهده کاتالوگ <ArrowUpLeft size={13} />
                </span>
              </div>
              <ReferenceArt area={e.area} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
