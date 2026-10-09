"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpLeft,
  Boxes,
  Package,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api, Catalog, number, Product } from "@/lib/api";
import ProductImage from "./product-image";
import MotionScene from "./motion-scene";
import Reveal from "./reveal";
import { PackBox } from "./pack-3d";
import HomepageSmoke from "./homepage-smoke";

type Mode = "all" | "retail" | "wholesale";
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
  const [paused, setPaused] = useState(false);
  // Render the poster until the device's motion preference is known.
  const [reduced, setReduced] = useState(true);
  const [preview, setPreview] = useState<number | null>(null);
  const pointerType = useRef("");
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState(
    unavailable ? "ارتباط با کاتالوگ برقرار نشد. دوباره تلاش کنید." : "",
  );
  const brands = [
    ...new Set(initialProducts.map((p) => p.brand).filter(Boolean)),
  ];
  const first = useRef(true);
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
          type: "cigarette",
          q: query,
          category,
          brand,
          mode,
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
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, brand, mode, available, retry]);
  function clear() {
    setQuery("");
    setCategory("");
    setBrand("");
    setMode("all");
    setAvailable(false);
  }

  return (
    <div
      className={`homepage-shell ${paused || reduced ? "motion-paused" : ""}`}
    >
      <HomepageSmoke disabled={paused || reduced} reduced={reduced} />
      <MotionScene
        onMode={setMode}
        paused={paused}
        reduced={reduced}
        onPause={() => setPaused((v) => !v)}
      />
      <div className="brand-strip">
        <div className="container brand-strip-inner">
          <span>BRAND / 01</span>
          <strong dir="ltr">Winston</strong>
          <p>
            تمرکز فعلی: وینستون{" "}
            <span>مدل‌ها و واحدهای عرضه، در یک کاتالوگ.</span>
          </p>
          <a href="#catalog">
            مرور مدل‌ها <ArrowLeft size={16} />
          </a>
        </div>
      </div>
      <section className="container cigarette-catalog" id="catalog">
        <Reveal>
          <div className="catalog-heading">
            <div>
              <div className="eyebrow">کاتالوگ سیگار / وینستون</div>
              <h2>
                مدل‌ها را
                <br />
                <span>کنار هم ببینید.</span>
              </h2>
            </div>
            <p>
              نام مدل، نوع بسته‌بندی و مسیر عرضه.
              <br />
              اطلاعات روشن برای مراجعه و همکاری.
            </p>
          </div>
        </Reveal>
        <div className="sale-mode-tabs" aria-label="نوع عرضه">
          <button
            className={mode === "all" ? "active" : ""}
            aria-pressed={mode === "all"}
            onClick={() => setMode("all")}
          >
            همه مدل‌ها
          </button>
          <button
            className={mode === "retail" ? "active" : ""}
            aria-pressed={mode === "retail"}
            onClick={() => setMode("retail")}
          >
            <Package size={16} /> تکی / بسته
          </button>
          <button
            className={mode === "wholesale" ? "active" : ""}
            aria-pressed={mode === "wholesale"}
            onClick={() => setMode("wholesale")}
          >
            <Boxes size={17} /> عمده / باکس
          </button>
          <span>{number(products.length)} مدل</span>
        </div>
        <div className="catalog-toolbar">
          <div className="category-tabs" aria-label="نوع بسته‌بندی">
            <button
              className={!category ? "selected" : ""}
              onClick={() => setCategory("")}
            >
              همه نوع‌ها
            </button>
            {catalog.categories.map((c) => (
              <button
                className={category === c.slug ? "selected" : ""}
                key={c.slug}
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
              placeholder="جست‌وجوی مدل یا برند…"
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
            <SlidersHorizontal size={15} /> فیلتر کاتالوگ
          </span>
          <label className="brand-filter">
            برند
            <select
              aria-label="فیلتر برند"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            >
              <option value="">همه برندها</option>
              {brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />{" "}
            فقط موجود
          </label>
        </div>
        {error ? (
          <div className="empty-state" role="alert">
            <h3>کاتالوگ در دسترس نیست</h3>
            <p>{error}</p>
            <button
              className="button secondary"
              onClick={() =>
                unavailable ? location.reload() : setRetry((v) => v + 1)
              }
            >
              تلاش دوباره
            </button>
          </div>
        ) : (
          <div
            className={`product-grid cigarette-products ${loading ? "is-loading" : ""}`}
            aria-busy={loading}
          >
            {products.map((p, index) => (
              <Link
                className={`product-card ${preview === p.id ? "is-selected" : ""}`}
                key={p.id}
                href={`/products/${p.slug}`}
                onPointerDown={(e) => {
                  pointerType.current = e.pointerType;
                }}
                onBlur={() => setPreview(null)}
                onClick={(e) => {
                  if (
                    e.detail !== 0 &&
                    pointerType.current === "touch" &&
                    preview !== p.id
                  ) {
                    e.preventDefault();
                    setPreview(p.id);
                  }
                }}
              >
                <div className="product-image">
                  <span className="cig-model-number" dir="ltr">
                    {String(index + 1).padStart(2, "0")} /{" "}
                    {p.brand.toUpperCase()}
                  </span>
                  <ProductImage product={p} />
                  <span className="product-status">معرفی عرضه حضوری</span>
                  <span className="product-photo-note">
                    {p.image
                      ? "تصویر کالا"
                      : p.slug === "winston-silver"
                        ? "تصویر مرجع سیلور"
                        : "عکس واقعی ثبت نشده"}
                  </span>
                  <span className="card-arrow">
                    <ArrowUpLeft size={20} />
                  </span>
                </div>
                {preview === p.id && (
                  <span className="product-preview-note" role="status">
                    برای مشخصات، دوباره لمس کنید
                  </span>
                )}
                <div className="product-meta">
                  <span>{p.category_title}</span>
                  <span dir="ltr">{p.sku}</span>
                </div>
                <h3>{p.title}</h3>
                <div className="pack-format-line">
                  <span>{number(p.sticks_per_pack)} نخ / بسته</span>
                  <span>{number(p.packs_per_carton)} بسته / باکس</span>
                </div>
                <div className="product-bottom">
                  <span>
                    {p.retail_available && p.wholesale_available
                      ? "تکی و عمده"
                      : p.wholesale_available
                        ? "عمده"
                        : p.retail_available
                          ? "تکی"
                          : "عرضه ثبت نشده"}
                  </span>
                  <span>
                    {p.stock > 0 ? "موجودی ثبت‌شده" : "موجودی ثبت نشده"}
                  </span>
                </div>
              </Link>
            ))}
            {!products.length && (
              <div className="empty-state">
                <Search size={27} />
                <h3>مدلی با این مشخصات پیدا نشد.</h3>
                <p>عبارت جست‌وجو یا فیلترها را تغییر دهید.</p>
                <button className="button secondary" onClick={clear}>
                  پاک کردن فیلترها
                </button>
              </div>
            )}
          </div>
        )}
        <div className="sample-note">
          <span>داده نمایشی</span>
          <p>
            تصاویر، مشخصات بسته و مدل‌های فعلی برای بررسی رابط هستند. موجودی و
            اطلاعات واقعی فروشنده هنوز ثبت نشده‌اند.
          </p>
        </div>
      </section>
      <section className="wholesale-section" id="wholesale">
        <div className="container wholesale-layout">
          <Reveal>
            <div className="eyebrow">برای فروشگاه‌ها و مراکز پخش</div>
            <h2>
              یک کاتالوگ.
              <br />
              دو مقیاس عرضه.
            </h2>
            <p>
              مدل‌ها را به تفکیک بسته و باکس مرور کنید. اطلاعات همکاری و مراجعه
              حضوری از مسیر شعب در دسترس قرار می‌گیرد.
            </p>
            <div className="wholesale-actions">
              <a
                className="button primary"
                href="#catalog"
                onClick={() => setMode("wholesale")}
              >
                مدل‌های عمده <ArrowUpLeft size={18} />
              </a>
              <Link className="text-link" href="/branches">
                اطلاعات همکاری حضوری <ArrowLeft size={17} />
              </Link>
            </div>
          </Reveal>
          <div className="wholesale-visual" aria-hidden="true">
            <div className="wholesale-box">
              <PackBox tone="blue" format="carton" variant="BLUE" />
            </div>
            <div className="wholesale-pack">
              <PackBox tone="blue" variant="BLUE" />
            </div>
            <span>PACK → CARTON</span>
          </div>
        </div>
      </section>
      <section className="container trade-details">
        <Reveal>
          <div className="trade-details-heading">
            <div className="eyebrow">ساختار عرضه</div>
            <h2>واحد هر مدل مشخص است.</h2>
          </div>
          <div className="trade-detail-grid">
            <div>
              <span>01</span>
              <h3>بسته</h3>
              <p>نمایش مدل و تعداد نخ در بسته، برای بررسی عرضه تکی حضوری.</p>
            </div>
            <div>
              <span>02</span>
              <h3>باکس</h3>
              <p>
                تعداد بسته در باکس و مسیر همکاری برای فروشگاه‌ها و مراکز پخش.
              </p>
            </div>
            <div>
              <span>03</span>
              <h3>برند</h3>
              <p>
                وینستون، نقطه شروع کاتالوگ؛ افزودن برندهای بعدی از پنل مدیریت.
              </p>
            </div>
          </div>
        </Reveal>
      </section>
      <div className="health-notice container">
        مصرف دخانیات به سلامت آسیب می‌رساند. عرضه به افراد زیر ۱۸ سال مجاز نیست.
        فروش اینترنتی سیگار در این سایت فعال نیست.
      </div>
    </div>
  );
}
