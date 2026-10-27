"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { mutate, Product, money } from "@/lib/api";
import { shoppingChanged } from "@/lib/wishlist";

export default function Purchase({ product }: { product: Product }) {
  const [adult, setAdult] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState(false);
  const [offerId, setOfferId] = useState<number | undefined>(
    () =>
      (
        product.offers.find((o) => o.purchasable && o.stock > 0) ||
        product.offers.find((o) => o.purchasable)
      )?.id,
  );
  const offer = product.offers.find((o) => o.id === offerId);
  const stock = offer ? offer.stock : product.stock;
  const price = offer ? offer.price : product.price;
  async function add() {
    setBusy(true);
    setMessage("");
    try {
      await mutate("session/", { adult });
      await mutate("cart/", {
        product_id: product.id,
        offer_id: offerId,
        quantity,
      });
      setAdded(true);
      shoppingChanged();
      setMessage("کالا به سبد خرید اضافه شد.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "درخواست انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  async function requestSupply() {
    setBusy(true);
    setMessage("");
    try {
      await mutate("supply-requests/", { product_id: product.id, quantity });
      setMessage(
        "درخواست تأمین ثبت شد؛ بدون پرداخت، رزرو موجودی یا تضمین تأمین. پاسخ در حساب من نمایش داده می‌شود.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "درخواست ثبت نشد.");
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
          {["cigarette", "tobacco"].includes(product.product_type)
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
      <h3>{money(price || 0)}</h3>
      {product.stock === 0 && (
        <div className="notice">
          <p>بدون موجودی؛ درخواست تأمین سفارش قطعی نیست و پرداخت ندارد.</p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void requestSupply()}
          >
            درخواست تأمین کالای ناموجود
          </button>
          <Link href="/account">پیگیری در حساب من</Link>
        </div>
      )}
      {product.offers.length > 0 && (
        <label className="quantity-field">
          فروشنده
          <select
            aria-label="انتخاب فروشنده"
            value={offerId}
            onChange={(e) => {
              setOfferId(Number(e.target.value));
              setQuantity(1);
              setAdded(false);
            }}
          >
            {product.offers
              .filter((o) => o.purchasable)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.vendor} — {money(o.price || 0)}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className="quantity-field">
        تعداد{" "}
        <input
          aria-label="تعداد"
          type="number"
          min="1"
          max={product.stock === 0 ? 20 : Math.min(20, stock)}
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
        disabled={
          busy ||
          !adult ||
          !stock ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > Math.min(20, stock)
        }
        onClick={add}
      >
        <ShoppingBag size={18} />
        {busy ? "در حال افزودن…" : stock ? "افزودن به سبد" : "ناموجود"}
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
