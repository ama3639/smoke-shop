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
import { api, Catalog, number, ProductPage } from "@/lib/api";
import type { SaleMode } from "@/lib/catalog-data";
import ProductCard from "./product-card";
import { CatalogSections } from "./catalog-sections";
import MotionScene from "./motion-scene";
import Reveal from "./reveal";
import { PackBox } from "./pack-3d";

type Mode = SaleMode;
export default function Storefront({
  initialPage,
  initialVendor,
  catalog: initialCatalog,
  unavailable,
  heroImage = "",
  home = true,
  initialType = "",
  initialMode = "all",
  initialCategory = "",
  initialBrand = "",
  initialQuery = "",
}: {
  initialPage: ProductPage;
  initialVendor: string;
  catalog: Catalog;
  unavailable: boolean;
  heroImage?: string;
  home?: boolean;
  initialType?: string;
  initialMode?: Mode;
  initialCategory?: string;
  initialBrand?: string;
  initialQuery?: string;
}) {
  const [pageData, setPageData] = useState(initialPage);
  const [catalog, setCatalog] = useState(initialCatalog);
  const products = pageData.items;
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState(home ? "cigarette" : initialType);
  const [vendor, setVendor] = useState(initialVendor);
  const [paused, setPaused] = useState(false);
  // Keep motion media unloaded until the device's preference is known.
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [brand, setBrand] = useState(initialBrand);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!retry) return;
    const controller = new AbortController();
    api<Catalog>(home ? "catalog/?type=cigarette" : "catalog/", { signal: controller.signal }).then(setCatalog).catch(() => {});
    return () => controller.abort();
  }, [retry, home]);
  const [error, setError] = useState(
    unavailable ? "ارتباط با کاتالوگ برقرار نشد. دوباره تلاش کنید." : "",
  );
  const brands = catalog.brands;
  function selectMode(value: Mode) { setMode(value); setPage(1); }
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
          type: kind,
          q: query,
          category,
          brand,
          mode,
          available: available ? "1" : "0",
          vendor,
          pagination: "1",
          page: String(page),
          page_size: "24",
        });
        const result = await api<ProductPage>(`catalog/products/?${params}`, {
            signal: controller.signal,
          });
        if (controller.signal.aborted) return;
        setPageData(result);
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
  }, [query, category, brand, mode, available, retry, page, kind, vendor]);
  function clear() {
    setQuery("");
    setCategory("");
    setBrand("");
    setMode("all");
    setAvailable(false);
    setKind(home ? "cigarette" : ""); setVendor(""); setPage(1);
  }
  const Heading = home ? "h2" : "h1";

  return (
    <div
      className={`${home ? "homepage-shell" : "catalog-page"} ${paused || reduced ? "motion-paused" : ""}`}
    >
      {home && <><MotionScene
        heroImage={heroImage}
        onMode={selectMode}
        paused={paused}
        reduced={reduced}
        onPause={() => setPaused((v) => !v)}
      />
      <div className="brand-strip">
        <div className="container brand-strip-inner">
          <span>CATALOG / INDEX</span>
          <strong>{number(catalog.total)} مدل سیگار</strong>
          <p>
            کاتالوگ چندفروشنده{" "}
            <span>برندها، دسته‌ها و عرضه‌ها در یک مسیر.</span>
          </p>
          <a href="#catalog">
            مرور مدل‌ها <ArrowLeft size={16} />
          </a>
        </div>
      </div>
      <CatalogSections brands={catalog.brands} /></>}
      <section className="container cigarette-catalog" id="catalog">
        <Reveal>
          <div className="catalog-heading">
            <div>
            <div className="eyebrow">کاتالوگ / {home ? "مدل‌های سیگار" : "همه دسته‌ها"}</div>
              <Heading>
                انتخاب‌ها را
                <br />
                <span>کنار هم ببینید.</span>
              </Heading>
            </div>
            <p>
              نام مدل، نوع بسته‌بندی و مسیر عرضه.
              <br />
              اطلاعات روشن برای مراجعه و همکاری.
            </p>
          </div>
        </Reveal>
        {home ? <div className="catalog-route-links"><Link href="/catalog">همه کالاها <ArrowUpLeft size={16} /></Link><Link href="/catalog?type=accessory">اکسسوری و ملزومات <ArrowUpLeft size={16} /></Link></div> : <div className="catalog-kinds" aria-label="گروه کالا">
          <button className={!kind ? "active" : ""} aria-pressed={!kind} onClick={() => { setKind(""); setCategory(""); setPage(1); }}>همه کالاها</button>
          {catalog.types.map(t => <button key={t.value} className={kind === t.value ? "active" : ""} aria-pressed={kind === t.value} onClick={() => { setKind(t.value); setCategory(""); setPage(1); }}>{t.title}</button>)}
        </div>}
        <div className="catalog-controls">
        <div className="sale-mode-tabs" aria-label="نوع عرضه">
          <button
            className={mode === "all" ? "active" : ""}
            aria-pressed={mode === "all"}
            onClick={() => selectMode("all")}
          >
            همه مدل‌ها
          </button>
          <button
            className={mode === "retail" ? "active" : ""}
            aria-pressed={mode === "retail"}
            onClick={() => selectMode("retail")}
          >
            <Package size={16} /> تکی / بسته
          </button>
          <button
            className={mode === "wholesale" ? "active" : ""}
            aria-pressed={mode === "wholesale"}
            onClick={() => selectMode("wholesale")}
          >
            <Boxes size={17} /> عمده / باکس
          </button>
          <span>{number(pageData.total)} نتیجه</span>
        </div>
        <div className="catalog-toolbar">
          <div className="category-tabs" aria-label="نوع بسته‌بندی">
            <button
              className={!category ? "selected" : ""}
              onClick={() => { setCategory(""); setPage(1); }}
            >
              همه نوع‌ها
            </button>
            {catalog.categories.map((c) => (
              <button
                className={category === c.slug ? "selected" : ""}
                key={c.slug}
                onClick={() => { setCategory(c.slug); setPage(1); }}
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
              maxLength={100}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            />
            {query && (
              <button
                aria-label="پاک کردن جست‌وجو"
                onClick={() => { setQuery(""); setPage(1); }}
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
              onChange={(e) => { setBrand(e.target.value); setPage(1); }}
            >
              <option value="">همه برندها</option>
              {brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="brand-filter">فروشنده
            <select aria-label="فیلتر فروشنده" value={vendor} onChange={e => { setVendor(e.target.value); setPage(1); }}>
              <option value="">همه فروشندگان</option>
              {catalog.vendors.map(v => <option key={v.slug} value={v.slug}>{v.title}</option>)}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => { setAvailable(e.target.checked); setPage(1); }}
            />{" "}
            فقط موجود
          </label>
        </div>
        {(query || category || brand || vendor || available || mode !== "all" || (!home && kind)) && <div className="active-filters" aria-label="فیلترهای فعال">
          <span>انتخاب شما</span>
          {!home && kind && <button aria-label="حذف فیلتر نوع" onClick={() => { setKind(""); setPage(1); }}>{catalog.types.find(t => t.value === kind)?.title || kind}<X size={13} /></button>}
          {query && <button aria-label="حذف فیلتر جست‌وجو" onClick={() => { setQuery(""); setPage(1); }}>{query}<X size={13} /></button>}
          {category && <button aria-label="حذف فیلتر دسته" onClick={() => { setCategory(""); setPage(1); }}>{catalog.categories.find(c => c.slug === category)?.title || (category === "vape-pod" ? "ویپ و پاد" : category === "pipe" ? "پیپ" : category)}<X size={13} /></button>}
          {brand && <button aria-label="حذف فیلتر برند" onClick={() => { setBrand(""); setPage(1); }}>{brand}<X size={13} /></button>}
          {vendor && <button aria-label="حذف فیلتر فروشنده" onClick={() => { setVendor(""); setPage(1); }}>{catalog.vendors.find(v => v.slug === vendor)?.title || vendor}<X size={13} /></button>}
          {mode !== "all" && <button aria-label="حذف فیلتر عرضه" onClick={() => selectMode("all")}>{mode === "retail" ? "تکی / بسته" : "عمده / باکس"}<X size={13} /></button>}
          {available && <button aria-label="حذف فیلتر موجودی" onClick={() => { setAvailable(false); setPage(1); }}>فقط موجود<X size={13} /></button>}
          <button className="reset-filters" onClick={clear}>پاک کردن همه فیلترها</button>
        </div>}
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
              <ProductCard key={p.id} product={p} index={(page - 1) * 24 + index + 1} />
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
        <div className="catalog-pagination" aria-label="صفحه‌بندی کاتالوگ">
          <span role="status">{loading ? "در حال دریافت…" : `${number(pageData.total)} کالا · صفحه ${number(pageData.page)} از ${number(pageData.pages)}`}</span>
          {pageData.pages > 1 && <div>
            <button disabled={loading || page <= 1} onClick={() => { setPage(p => p - 1); document.getElementById("catalog")?.scrollIntoView(); }}>صفحه قبل</button>
            <button disabled={loading || !pageData.has_next} onClick={() => { setPage(p => p + 1); document.getElementById("catalog")?.scrollIntoView(); }}>صفحه بعد</button>
          </div>}
          <button className="catalog-refresh" disabled={loading} onClick={() => setRetry(v => v + 1)}>تازه‌سازی کاتالوگ</button>
        </div>
        <div className="sample-note">
          <span>اطلاعات کاتالوگ</span>
          <p>
            تصاویر بسته‌ها از فایل‌های ارسالی فروشنده هستند. موجودی و مشخصات
            عرضه پس از تأیید فروشنده تکمیل می‌شوند.
          </p>
        </div>
      </section>
      {home && <><section className="wholesale-section" id="wholesale">
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
              onClick={() => selectMode("wholesale")}
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
      </section></>}
      <div className="health-notice container">
        مصرف دخانیات به سلامت آسیب می‌رساند. عرضه به افراد زیر ۱۸ سال مجاز نیست.
        فروش اینترنتی سیگار در این سایت فعال نیست.
      </div>
    </div>
  );
}
