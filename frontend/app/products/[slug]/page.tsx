import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Product, number, serverApi } from "@/lib/api";
import ProductImage from "@/components/product-image";
import Purchase from "@/components/purchase";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const p = await serverApi<Product>(`catalog/products/${slug}/`);
    return { title: p.title, description: p.description };
  } catch {
    return { title: "مشخصات کالا" };
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let p: Product;
  try {
    p = await serverApi<Product>(`catalog/products/${slug}/`);
  } catch (e) {
    if (e instanceof Error && e.message === "API 404") notFound();
    throw e;
  }
  return (
    <div className="container detail-page">
      <div className="breadcrumb">
        <Link href="/#catalog">کاتالوگ</Link>
        <span>/</span>
        <span>{p.title}</span>
      </div>
      <div className="detail-grid">
        <div className="detail-image">
          <ProductImage product={p} />
          {!p.image && <span>تصویر نمونه نمایشی</span>}
        </div>
        <div className="detail-copy">
          <div className="eyebrow">
            {p.category_title} / <span dir="ltr">{p.sku}</span>
          </div>
          <h1>{p.title}</h1>
          <p>{p.description}</p>
          <dl className="spec-table">
            {p.product_type === "cigarette" ? (
              <>
                <div>
                  <dt>برند</dt>
                  <dd>{p.brand || "ثبت نشده"}</dd>
                </div>
                <div>
                  <dt>واحد بسته</dt>
                  <dd>{number(p.sticks_per_pack)} نخ</dd>
                </div>
                <div>
                  <dt>واحد باکس</dt>
                  <dd>{number(p.packs_per_carton)} بسته</dd>
                </div>
                <div>
                  <dt>مسیر عرضه حضوری</dt>
                  <dd>
                    {p.retail_available && p.wholesale_available
                      ? "تکی و عمده"
                      : p.wholesale_available
                        ? "عمده"
                        : "تکی"}
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt>جنس</dt>
                  <dd>{p.material || "ثبت نشده"}</dd>
                </div>
                <div>
                  <dt>ابعاد</dt>
                  <dd>{p.dimensions || "ثبت نشده"}</dd>
                </div>
              </>
            )}
            <div>
              <dt>موجودی</dt>
              <dd>{p.stock > 0 ? "موجود" : "بدون موجودی ثبت‌شده"}</dd>
            </div>
          </dl>
          <Purchase product={p} />
        </div>
      </div>
      {p.product_type !== "cigarette" && (
        <section className="compatibility-detail">
          <div className="eyebrow">قبل از انتخاب بررسی کنید</div>
          <h2>سازگاری قطعه</h2>
          {p.compatibility.length ? (
            p.compatibility.map((r, i) => (
              <div className="compatibility-row" key={i}>
                <strong>{r.model}</strong>
                <span>
                  {r.incompatible
                    ? "ناسازگار"
                    : r.confidence === "CONFIRMED"
                      ? "تأییدشده"
                      : r.confidence === "PROBABLE"
                        ? "محتمل"
                        : "آزمایشی"}
                </span>
                <p>
                  {r.source} · بررسی:{" "}
                  {new Date(r.verified).toLocaleDateString("fa-IR")}
                </p>
              </div>
            ))
          ) : (
            <p>
              برای این کالا هنوز رابطه سازگاری ثبت نشده است. تطابق ابعاد و مدل
              را پیش از انتخاب بررسی کنید.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
