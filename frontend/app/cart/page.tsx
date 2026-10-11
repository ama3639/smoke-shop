"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Trash2 } from "lucide-react";
import { api, Cart, money, mutate, number } from "@/lib/api";
import ProductImage from "@/components/product-image";

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState("");
  const key = useRef("");
  async function load() {
    try {
      const data = await api<Cart>("cart/");
      setCart(data);
      if (data.latest_order_id) setOrder(data.latest_order_id);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "سبد دریافت نشد.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function remove(id: number) {
    setBusy(true);
    try {
      setCart(await mutate<Cart>("cart/", { item_id: id }, "DELETE"));
      key.current = "";
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      key.current ||= crypto.randomUUID();
      const result = await mutate<{ id: string }>("orders/", {
        idempotency_key: key.current,
      });
      setOrder(result.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "سفارش ثبت نشد.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="container cart-page">
      <div className="eyebrow">انتخاب‌های شما</div>
      <h1>سبد خرید</h1>
      {error && (
        <div className="error-message" role="alert">
          {error}
          <button className="text-link" onClick={load}>
            تلاش دوباره
          </button>
        </div>
      )}
      {order && (
        <div className="notice" role="status">
          آخرین درخواست سفارش شما؛ پرداختی انجام نشده است.{" "}
          <Link href={`/orders/${order}`}>مشاهده وضعیت سفارش</Link>
        </div>
      )}
      {!cart ? (
        <p role="status">در حال دریافت سبد…</p>
      ) : !cart.items.length ? (
        <div className="empty-state cart-empty">
          <ShoppingBag size={44} strokeWidth={1} />
          <h2>هنوز انتخابی در سبد ندارید.</h2>
          <p>فقط اقلام تأییدشده و موجود به سبد اضافه می‌شوند.</p>
          <Link href="/#catalog" className="button primary">
            بازگشت به کاتالوگ <ArrowLeft size={18} />
          </Link>
        </div>
      ) : (
        <div className="cart-grid">
          <div>
            {cart.items.map(({ id, product: p, quantity, seller_name }) => (
              <div className="cart-row" key={id}>
                <div className="cart-product-image">
                  <ProductImage product={p} />
                </div>
                <div>
                  <Link href={`/products/${p.slug}`}>
                    <h3>{p.title}</h3>
                  </Link>
                  {seller_name && <p>فروشنده: {seller_name}</p>}
                  <p>
                    {number(quantity)} عدد ·{" "}
                    {p.price !== null
                      ? money(p.price)
                      : "عرضه آنلاین غیرفعال شده است"}
                  </p>
                </div>
                <button
                  disabled={busy}
                  className="icon-button"
                  aria-label={`حذف ${p.title}`}
                  onClick={() => remove(id)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <aside className="cart-summary">
            <h2>خلاصه سبد</h2>
            <div>
              <span>جمع کالاها</span>
              <strong>{money(cart.total)}</strong>
            </div>
            <p>
              ثبت درخواست، رزرو موجودی برای بررسی اپراتور است و به معنی پرداخت
              یا تأیید نهایی سفارش نیست.
            </p>
            <button
              className="button primary"
              onClick={submit}
              disabled={
                busy ||
                !cart.checkout_enabled ||
                cart.items.some((i) => !i.product.purchasable)
              }
            >
              {busy ? "در حال ثبت…" : "ثبت درخواست سفارش"}
            </button>
            {!cart.checkout_enabled && <p>ثبت سفارش هنوز فعال نشده است.</p>}
          </aside>
        </div>
      )}
    </section>
  );
}
