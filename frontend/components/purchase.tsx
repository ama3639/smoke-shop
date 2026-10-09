"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { mutate, Product, money } from "@/lib/api";

export default function Purchase({ product }: { product: Product }) {
  const [adult, setAdult] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState(false);
  async function add() {
    setBusy(true);
    setMessage("");
    try {
      await mutate("session/", { adult });
      await mutate("cart/", { product_id: product.id, quantity });
      setAdded(true);
      setMessage("کالا به سبد خرید اضافه شد.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "درخواست انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  if (!product.purchasable)
    return (
      <div className="purchase-box">
        <span className="eyebrow">
          {product.legal_status === "IN_PERSON_ONLY"
            ? "عرضه حضوری"
            : "فقط کاتالوگ"}
        </span>
        <h3>
          {product.product_type === "cigarette"
            ? "معرفی عرضه تکی و عمده حضوری"
            : "مشخصات برای بررسی، عرضه پس از تأیید."}
        </h3>
        <p>
          خرید آنلاین این کالا فعال نیست. وضعیت عرضه و اطلاعات شعبه را در صفحه
          شعب بررسی کنید.
        </p>
        <Link href="/branches" className="button secondary">
          اطلاعات شعب حضوری <ArrowLeft size={18} />
        </Link>
      </div>
    );
  return (
    <div className="purchase-box">
      <h3>{money(product.price || 0)}</h3>
      <label className="quantity-field">
        تعداد{" "}
        <input
          aria-label="تعداد"
          type="number"
          min="1"
          max={Math.min(20, product.stock)}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </label>
      <label className="age-consent">
        <input
          type="checkbox"
          checked={adult}
          onChange={(e) => setAdult(e.target.checked)}
        />{" "}
        تأیید می‌کنم که ۱۸ سال یا بیشتر دارم.
      </label>
      <button
        className="button primary"
        disabled={busy || !adult || !product.stock || quantity < 1}
        onClick={add}
      >
        <ShoppingBag size={18} />
        {busy ? "در حال افزودن…" : product.stock ? "افزودن به سبد" : "ناموجود"}
      </button>
      {message && <p role="status">{message}</p>}
      {added && (
        <Link href="/cart" className="text-link">
          مشاهده سبد <ArrowLeft size={17} />
        </Link>
      )}
    </div>
  );
}
