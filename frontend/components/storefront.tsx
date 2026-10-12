"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
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
import Reveal from "./reveal";

type Mode = SaleMode;
export default function Storefront({
  initialPage,
  initialVendor,
  catalog: initialCatalog,
  unavailable,
  initialType = "",
  initialMode = "all",
  initialCategory = "",
  initialBrand = "",
  initialQuery = "",
  initialFlavor = "",
  initialWeight = "",
  heading = "",
}: {
  initialPage: ProductPage;
  initialVendor: string;
  catalog: Catalog;
  unavailable: boolean;
  initialType?: string;
  initialMode?: Mode;
  initialCategory?: string;
  initialBrand?: string;
  initialQuery?: string;
  initialFlavor?: string;
  initialWeight?: string;
  heading?: string;
}) {
  const [pageData, setPageData] = useState(initialPage);
  const [catalog, setCatalog] = useState(initialCatalog);
  const products = pageData.items;
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState(initialType);
  const [vendor, setVendor] = useState(initialVendor);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [brand, setBrand] = useState(initialBrand);
  const [flavor, setFlavor] = useState(initialFlavor);
  const [weight, setWeight] = useState(initialWeight);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const metadataIdentity = useRef(`${initialType}:0`);
  useEffect(() => {
    const identity = `${kind}:${retry}`;
    if (metadataIdentity.current === identity) return;
    metadataIdentity.current = identity;
    const controller = new AbortController();
    api<Catalog>(`catalog/?${new URLSearchParams({ type: kind })}`, {
      signal: controller.signal,
    })
      .then(setCatalog)
      .catch(() => {});
    return () => controller.abort();
  }, [retry, kind]);
  const [error, setError] = useState(
    unavailable ? "ارتباط با کاتالوگ برقرار نشد. دوباره تلاش کنید." : "",
  );
  const brands = catalog.brands;
  const selectedWeight =
    catalog.weights.find((w) => Number(w) === Number(weight)) || weight;
  function selectMode(value: Mode) {
    setMode(value);
    setPage(1);
  }
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
          flavor,
          weight,
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
  }, [
    query,
    category,
    flavor,
    weight,
    brand,
    mode,
    available,
    retry,
    page,
    kind,
    vendor,
  ]);
  function clear() {
    setQuery("");
    setCategory("");
    setFlavor("");
    setWeight("");
    setBrand("");
    setMode("all");
    setAvailable(false);
    setKind("");
    setVendor("");
    setPage(1);
  }
  function selectKind(value: string) {
    setKind(value);
    setCategory("");
    setBrand("");
    setFlavor("");
    setWeight("");
    setPage(1);
  }
  const Heading = "h1";
  const specialist = kind === "tobacco" || category === "hookah";

  return (
    <div className="catalog-page">
      <section className="container cigarette-catalog" id="catalog">
        <Reveal>
          <div
            className={`catalog-heading ${specialist ? "specialist-intro" : ""}`}
          >
            <div>
              <div className="eyebrow">
                کاتالوگ /{" "}
                {kind === "tobacco"
                  ? "تنباکو"
                  : category === "hookah"
                    ? "قلیان"
                    : "همه دسته‌ها"}
              </div>
              <Heading>
                {heading ? (
                  heading
                ) : specialist ? (
                  kind === "tobacco" ? (
                    "تنباکو؛ مشخصات هر بسته."
                  ) : (
                    "قلیان؛ مدل‌ها و ملزومات."
                  )
                ) : (
                  <>
                    انتخاب‌ها را
                    <br />
                    <span>کنار هم ببینید.</span>
                  </>
                )}
              </Heading>
            </div>
            <p>
              {specialist ? (
                kind === "tobacco" ? (
                  "برند، دسته، طعم و وزن را از اطلاعات ثبت‌شده بررسی کنید."
                ) : (
                  "مدل‌های ثبت‌شده را مرور کنید؛ قطعات و ابزار در کاتالوگ اکسسوری هستند."
                )
              ) : (
                <>
                  نام مدل، نوع بسته‌بندی و مسیر عرضه.
                  <br />
                  اطلاعات روشن برای مراجعه و همکاری.
                </>
              )}
              {category === "hookah" && (
                <>
                  <br />
                  <Link href="/catalog?type=accessory">
                    مرور اکسسوری <ArrowUpLeft size={16} />
                  </Link>
                </>
              )}
            </p>
          </div>
        </Reveal>
        <div className="catalog-kinds" aria-label="گروه کالا">
          <button
            className={!kind ? "active" : ""}
            aria-pressed={!kind}
            onClick={() => {
              selectKind("");
            }}
          >
            همه کالاها
          </button>
          {catalog.types.map((t) => (
            <button
              key={t.value}
              className={kind === t.value ? "active" : ""}
              aria-pressed={kind === t.value}
              onClick={() => {
                selectKind(t.value);
              }}
            >
              {t.title}
            </button>
          ))}
        </div>
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
            <div
              className="category-tabs"
              aria-label={kind === "cigarette" ? "نوع بسته‌بندی" : "دسته کالا"}
            >
              <button
                className={!category ? "selected" : ""}
                onClick={() => {
                  setCategory("");
                  setPage(1);
                }}
              >
                همه نوع‌ها
              </button>
              {catalog.categories.map((c) => (
                <button
                  className={category === c.slug ? "selected" : ""}
                  key={c.slug}
                  onClick={() => {
                    setCategory(c.slug);
                    setPage(1);
                  }}
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              {query && (
                <button
                  aria-label="پاک کردن جست‌وجو"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
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
                onChange={(e) => {
                  setBrand(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">همه برندها</option>
                {brands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="brand-filter">
              فروشنده
              <select
                aria-label="فیلتر فروشنده"
                value={vendor}
                onChange={(e) => {
                  setVendor(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">همه فروشندگان</option>
                {catalog.vendors.map((v) => (
                  <option key={v.slug} value={v.slug}>
                    {v.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => {
                  setAvailable(e.target.checked);
                  setPage(1);
                }}
              />{" "}
              فقط موجود
            </label>
          </div>
          {(kind === "tobacco" || flavor || weight) && (
            <div className="tobacco-filters" aria-label="مشخصات تنباکو">
              <label>
                طعم
                <select
                  aria-label="فیلتر طعم"
                  value={flavor}
                  onChange={(e) => {
                    setFlavor(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">همه طعم‌ها</option>
                  {flavor && !catalog.flavors.includes(flavor) && (
                    <option value={flavor}>{flavor}</option>
                  )}
                  {catalog.flavors.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label>
                وزن بسته
                <select
                  aria-label="فیلتر وزن"
                  value={selectedWeight}
                  onChange={(e) => {
                    setWeight(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">همه وزن‌ها</option>
                  {weight && !catalog.weights.includes(selectedWeight) && (
                    <option value={weight}>{number(Number(weight))} گرم</option>
                  )}
                  {catalog.weights.map((w) => (
                    <option key={w} value={w}>
                      {number(Number(w))} گرم
                    </option>
                  ))}
                </select>
              </label>
              {!catalog.flavors.length && !catalog.weights.length && (
                <p>طعم و وزن برای این کاتالوگ هنوز ثبت نشده‌اند.</p>
              )}
            </div>
          )}
          {(query ||
            category ||
            flavor ||
            weight ||
            brand ||
            vendor ||
            available ||
            mode !== "all" ||
            kind) && (
            <div className="active-filters" aria-label="فیلترهای فعال">
              <span>انتخاب شما</span>
              {kind && (
                <button
                  aria-label="حذف فیلتر نوع"
                  onClick={() => selectKind("")}
                >
                  {catalog.types.find((t) => t.value === kind)?.title || kind}
                  <X size={13} />
                </button>
              )}
              {query && (
                <button
                  aria-label="حذف فیلتر جست‌وجو"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
                >
                  {query}
                  <X size={13} />
                </button>
              )}
              {category && (
                <button
                  aria-label="حذف فیلتر دسته"
                  onClick={() => {
                    setCategory("");
                    setPage(1);
                  }}
                >
                  {catalog.categories.find((c) => c.slug === category)?.title ||
                    (category === "vape-pod"
                      ? "ویپ و پاد"
                      : category === "pipe"
                        ? "پیپ"
                        : category === "hookah"
                          ? "قلیان"
                          : category)}
                  <X size={13} />
                </button>
              )}
              {flavor && (
                <button
                  aria-label="حذف فیلتر طعم"
                  onClick={() => {
                    setFlavor("");
                    setPage(1);
                  }}
                >
                  {flavor}
                  <X size={13} />
                </button>
              )}
              {weight && (
                <button
                  aria-label="حذف فیلتر وزن"
                  onClick={() => {
                    setWeight("");
                    setPage(1);
                  }}
                >
                  {number(Number(weight))} گرم
                  <X size={13} />
                </button>
              )}
              {brand && (
                <button
                  aria-label="حذف فیلتر برند"
                  onClick={() => {
                    setBrand("");
                    setPage(1);
                  }}
                >
                  {brand}
                  <X size={13} />
                </button>
              )}
              {vendor && (
                <button
                  aria-label="حذف فیلتر فروشنده"
                  onClick={() => {
                    setVendor("");
                    setPage(1);
                  }}
                >
                  {catalog.vendors.find((v) => v.slug === vendor)?.title ||
                    vendor}
                  <X size={13} />
                </button>
              )}
              {mode !== "all" && (
                <button
                  aria-label="حذف فیلتر عرضه"
                  onClick={() => selectMode("all")}
                >
                  {mode === "retail" ? "تکی / بسته" : "عمده / باکس"}
                  <X size={13} />
                </button>
              )}
              {available && (
                <button
                  aria-label="حذف فیلتر موجودی"
                  onClick={() => {
                    setAvailable(false);
                    setPage(1);
                  }}
                >
                  فقط موجود
                  <X size={13} />
                </button>
              )}
              <button className="reset-filters" onClick={clear}>
                پاک کردن همه فیلترها
              </button>
            </div>
          )}
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
              <ProductCard
                key={p.id}
                product={p}
                index={(page - 1) * 24 + index + 1}
              />
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
          <span role="status">
            {loading
              ? "در حال دریافت…"
              : `${number(pageData.total)} کالا · صفحه ${number(pageData.page)} از ${number(pageData.pages)}`}
          </span>
          {pageData.pages > 1 && (
            <div>
              <button
                disabled={loading || page <= 1}
                onClick={() => {
                  setPage((p) => p - 1);
                  document.getElementById("catalog")?.scrollIntoView();
                }}
              >
                صفحه قبل
              </button>
              <button
                disabled={loading || !pageData.has_next}
                onClick={() => {
                  setPage((p) => p + 1);
                  document.getElementById("catalog")?.scrollIntoView();
                }}
              >
                صفحه بعد
              </button>
            </div>
          )}
          <button
            className="catalog-refresh"
            disabled={loading}
            onClick={() => setRetry((v) => v + 1)}
          >
            تازه‌سازی کاتالوگ
          </button>
        </div>
        <div className="sample-note">
          <span>اطلاعات کاتالوگ</span>
          <p>
            تصاویر بسته‌ها از فایل‌های ارسالی فروشنده هستند. موجودی و مشخصات
            عرضه پس از تأیید فروشنده تکمیل می‌شوند.
          </p>
        </div>
      </section>
      <div className="health-notice container">
        مصرف دخانیات به سلامت آسیب می‌رساند. عرضه به افراد زیر ۱۸ سال مجاز نیست.
        فروش اینترنتی سیگار در این سایت فعال نیست.
      </div>
    </div>
  );
}
