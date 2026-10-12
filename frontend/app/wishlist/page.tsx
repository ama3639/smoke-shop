"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Product } from "@/lib/api";
import { toggleFavorite, useFavorites } from "@/lib/wishlist";
import ProductCard from "@/components/product-card";
export default function WishlistPage() {
  const slugs = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    Promise.all(
      slugs.map(async (slug) => {
        try {
          return {
            slug,
            product: await api<Product>(`catalog/products/${slug}/`, {
              signal: controller.signal,
            }),
          };
        } catch {
          return { slug, product: null };
        }
      }),
    ).then((result) => {
      if (controller.signal.aborted) return;
      setProducts(result.flatMap((r) => (r.product ? [r.product] : [])));
      setMissing(result.filter((r) => !r.product).map((r) => r.slug));
      setError("");
      setBusy(false);
    });
    return () => controller.abort();
  }, [slugs]);
  return (
    <section className="container wishlist-page">
      <div className="eyebrow">انتخاب‌های ذخیره‌شده</div>
      <h1>علاقه‌مندی‌ها</h1>
      <p>
        این فهرست در همین مرورگر نگهداری می‌شود؛ قیمت و وضعیت کالا هنگام بازدید
        دوباره دریافت می‌شوند.
      </p>
      {error && <p role="alert">{error}</p>}
      {busy ? (
        <p role="status">در حال دریافت کالاها…</p>
      ) : products.length ? (
        <div className="product-grid">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i + 1} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>هنوز کالایی برای نمایش ندارید.</h2>
          <Link className="button primary" href="/catalog">
            مرور کاتالوگ
          </Link>
        </div>
      )}
      {missing.length > 0 && (
        <div className="notice">
          <p>
            بعضی کالاهای ذخیره‌شده در دسترس نیستند. پس از بررسی اتصال می‌توانید
            دوباره تلاش کنید یا از فهرست حذفشان کنید.
          </p>
          {missing.map((slug) => (
            <button
              className="button secondary"
              key={slug}
              onClick={() => {
                if (!toggleFavorite(slug)) setError("حذف از مرورگر انجام نشد.");
              }}
            >
              حذف انتخاب در دسترس نیست: {slug}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
