import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("برندهای کاتالوگ", "برندهای کالاهای ثبت‌شده و دسترسی به مشخصات هر مدل.", "/brands");
import Link from "next/link";
import { readCatalog } from "@/lib/catalog-data";
export const dynamic = "force-dynamic";
export default async function Brands() {
  const { catalog, unavailable } = await readCatalog({});
  return (
    <section className="container brand-page">
      <div className="eyebrow">BRANDS / TITANIUM SILVER</div>
      <h1>برندهای کاتالوگ</h1>
      <p>
        برندهای کالاهای عمومی ثبت‌شده؛ اطلاعات هر مدل در صفحه محصول قابل بررسی
        است.
      </p>
      {unavailable ? (
        <div className="empty-state" role="alert">
          دریافت برندها انجام نشد.
        </div>
      ) : catalog.brands.length ? (
        <div className="brand-grid">
          {catalog.brands.map((b) => (
            <Link
              className="brand-card"
              href={`/brands/${encodeURIComponent(b)}`}
              key={b}
            >
              <h2 dir="auto">{b}</h2>
              <span>مشاهده محصولات برند</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">هنوز برندی ثبت نشده است.</div>
      )}
    </section>
  );
}
