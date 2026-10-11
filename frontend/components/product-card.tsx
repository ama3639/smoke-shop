import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { money, number, Product } from "@/lib/api";
import ProductImage from "./product-image";

export default function ProductCard({ product: p, index }: { product: Product; index: number }) {
  return (
    <Link className="product-card" href={`/products/${p.slug}`}>
      <div className="product-image">
        <span className="cig-model-number" dir="ltr">{String(index).padStart(2, "0")} / {p.brand.toUpperCase()}</span>
        <ProductImage product={p} />
        <span className="product-status">{p.purchasable ? "عرضه آنلاین مجاز" : p.legal_status === "IN_PERSON_ONLY" ? "عرضه حضوری" : "کاتالوگ"}</span>
        <span className="product-photo-note">{p.image ? "تصویر کالا" : p.slug === "winston-silver" ? "تصویر مرجع سیلور" : "عکس واقعی ثبت نشده"}</span>
        <span className="card-arrow"><ArrowUpLeft size={20} /></span>
      </div>
      <div className="product-meta"><span>{p.category_title}</span><span dir="ltr">{p.brand}</span></div>
      <h3>{p.title}</h3>
      {(p.sticks_per_pack !== null || p.packs_per_carton !== null) && (
        <div className="pack-format-line">
          {p.sticks_per_pack !== null && <span>{number(p.sticks_per_pack)} نخ / بسته</span>}
          {p.packs_per_carton !== null && <span>{number(p.packs_per_carton)} بسته / باکس</span>}
        </div>
      )}
      <div className="product-bottom">
        <span>{p.retail_available && p.wholesale_available ? "تکی و عمده" : p.wholesale_available ? "عمده" : p.retail_available ? "تکی" : "عرضه ثبت نشده"}</span>
        <span>{p.stock > 0 ? "موجودی ثبت‌شده" : "موجودی ثبت نشده"}</span>
      </div>
      <div className="catalog-card-foot">{p.offers.length ? `${number(p.offers.length)} فروشنده` : "عرضه مستقیم"}<span>{p.price !== null && p.purchasable ? money(p.price) : "مشاهده مشخصات"}</span></div>
    </Link>
  );
}
