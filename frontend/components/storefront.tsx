"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpLeft,
  Check,
  Layers,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api, Catalog, money, number, Product } from "@/lib/api";
import { HeroArt, ProductArt } from "./product-art";
import ProductImage from "./product-image";

export default function Storefront({
  initialProducts,
  catalog,
  unavailable,
}: {
  initialProducts: Product[];
  catalog: Catalog;
  unavailable: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [device, setDevice] = useState("");
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    unavailable ? "ارتباط با کاتالوگ برقرار نشد. لطفاً دوباره تلاش کنید." : "",
  );
  const first = useRef(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          category,
          device,
          available: available ? "1" : "0",
        });
        setProducts(
          await api<Product[]>(`catalog/products/?${params}`, {
            signal: controller.signal,
          }),
        );
        setError("");
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "دریافت اطلاعات انجام نشد.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, device, available, retry]);

  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> جزئیات کوچک، انتخاب‌های دقیق
          </div>
          <h1>
            هر قطعه،
            <br />
            در جای <em>درست.</em>
          </h1>
          <p>
            از مشخصات تا سازگاری؛ اکسسوری مورد نیازتان را با اطلاعات روشن و بدون
            حدس پیدا کنید.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#finder">
              قطعه سازگار را پیدا کن <ArrowUpLeft size={19} />
            </a>
            <a className="text-link" href="#catalog">
              دیدن کاتالوگ <ArrowLeft size={18} />
            </a>
          </div>
          <div className="hero-note">
            <span className="note-line" /> انتخاب بر اساس مدل، جنس و ابعاد
          </div>
        </div>
        <HeroArt />
      </section>
      <section className="principles container" aria-label="اصول فروشگاه">
        <div>
          <span>۰۱ /</span>
          <strong>مشخصات، قبل از انتخاب</strong>
          <p>جنس و ابعاد در یک نگاه</p>
        </div>
        <div>
          <span>۰۲ /</span>
          <strong>سازگاری قابل بررسی</strong>
          <p>همراه با منبع و تاریخ بررسی</p>
        </div>
        <div>
          <span>۰۳ /</span>
          <strong>وضعیت عرضه شفاف</strong>
          <p>تفکیک کاتالوگ و اقلام قابل خرید</p>
        </div>
      </section>
      <section className="finder-section" id="finder">
        <div className="container finder">
          <div>
            <div className="eyebrow">انتخاب‌گر سازگاری</div>
            <h2>از مدل وسیله شروع کنید.</h2>
            <p>قطعات مرتبط با مدل شما، یک‌جا و قابل بررسی.</p>
          </div>
          <div className="finder-controls">
            <label htmlFor="device">مدل وسیله یا اتصال</label>
            <div className="finder-select">
              <Layers size={20} />
              <select
                id="device"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
              >
                <option value="">انتخاب مدل</option>
                {catalog.devices.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
            <a href="#catalog" className="button primary">
              مشاهده قطعات <ArrowDown size={18} />
            </a>
          </div>
        </div>
      </section>
      <section className="container catalog-section" id="catalog">
        <div className="section-heading">
          <div>
            <div className="eyebrow">کاتالوگ / اکسسوری و قطعات</div>
            <h2>برای هر جزئیات، یک انتخاب.</h2>
          </div>
          <span className="result-count">
            {number(products.length)} کالا در کاتالوگ
          </span>
        </div>
        <div className="catalog-toolbar">
          <div className="category-tabs" aria-label="دسته‌بندی کالا">
            <button
              className={!category ? "selected" : ""}
              onClick={() => setCategory("")}
            >
              همه کالاها
            </button>
            {catalog.categories.map((c) => (
              <button
                key={c.slug}
                className={category === c.slug ? "selected" : ""}
                onClick={() => setCategory(c.slug)}
              >
                {c.title}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="جست‌وجوی کالا"
              placeholder="نام کالا یا کد قطعه…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                aria-label="پاک کردن جست‌وجو"
                onClick={() => setQuery("")}
              >
                <X size={16} />
              </button>
            )}
          </label>
        </div>
        <div className="filter-row">
          <span>
            <SlidersHorizontal size={15} /> انتخاب دقیق‌تر
          </span>
          <label>
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />{" "}
            فقط کالاهای موجود
          </label>
          {device && (
            <button onClick={() => setDevice("")}>
              حذف فیلتر مدل <X size={14} />
            </button>
          )}
        </div>
        {error ? (
          <div className="empty-state" role="alert">
            <h3>کاتالوگ در دسترس نیست</h3>
            <p>{error}</p>
            <button
              className="button secondary"
              onClick={() => unavailable ? window.location.reload() : setRetry((v) => v + 1)}
            >
              تلاش دوباره
            </button>
          </div>
        ) : (
          <div
            aria-busy={loading}
            className={`product-grid ${loading ? "is-loading" : ""}`}
          >
            {products.map((p) => (
              <Link
                href={`/products/${p.slug}`}
                key={p.id}
                className="product-card"
              >
                <div className="product-image">
                  <ProductImage product={p} />
                  <span className="product-status">
                    {p.purchasable
                      ? "قابل خرید آنلاین"
                      : p.legal_status === "IN_PERSON_ONLY"
                        ? "عرضه حضوری"
                        : "فقط کاتالوگ"}
                  </span>
                  <span className="card-arrow">
                    <ArrowUpLeft size={19} />
                  </span>
                </div>
                <div className="product-meta">
                  <span>{p.category_title}</span>
                  <span dir="ltr">{p.sku}</span>
                </div>
                <h3>{p.title}</h3>
                <p className="product-spec">
                  {p.material} <span> / </span> {p.dimensions}
                </p>
                <div className="product-bottom">
                  <span>
                    {p.price !== null ? money(p.price) : "مشاهده مشخصات"}
                  </span>
                  <span>{p.stock > 0 ? "موجود" : "بدون موجودی ثبت‌شده"}</span>
                </div>
              </Link>
            ))}
            {!products.length && (
              <div className="empty-state">
                <Search size={28} />
                <h3>کالایی با این مشخصات پیدا نشد</h3>
                <p>عبارت جست‌وجو یا فیلترها را تغییر دهید.</p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setQuery("");
                    setCategory("");
                    setDevice("");
                    setAvailable(false);
                  }}
                >
                  پاک کردن فیلترها
                </button>
              </div>
            )}
          </div>
        )}
        <div className="catalog-disclaimer">
          <Check size={16} />
          <p>
            کالاها و تصاویر فعلی نمونه نمایشی هستند؛ عرضه و خرید پس از ثبت
            مشخصات واقعی و تأیید حقوقی فعال می‌شود.
          </p>
        </div>
      </section>
      <section className="container editorial">
        <div>
          <div className="eyebrow">راهنمای نگهداری</div>
          <h2>
            عمر بیشتر،
            <br />
            با مراقبت درست.
          </h2>
          <p>
            نظافت اصولی، بررسی اتصالات و نگهداری ابزار؛ نکته‌های کوچک برای
            مراقبت بهتر از قطعات.
          </p>
          <Link href="/guide" className="text-link">
            خواندن راهنما <ArrowLeft size={18} />
          </Link>
        </div>
        <div className="editorial-art">
          <ProductArt kind="brush" />
          <span>CARE / KEEP / REPEAT</span>
        </div>
      </section>
    </>
  );
}
