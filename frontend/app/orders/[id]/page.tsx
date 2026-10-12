"use client";
import { use, useEffect, useState } from "react";
import { api, money, number } from "@/lib/api";

type Order = {
  id: string;
  total: number;
  status: string;
  expires_at: string | null;
  items: {
    title: string;
    quantity: number;
    unit_price: number;
    seller_name: string;
  }[];
};
export default function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<Order>(`orders/${id}/`)
      .then(setOrder)
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <section className="container prose-page">
      <div className="eyebrow">پیگیری سفارش</div>
      <h1>وضعیت درخواست شما</h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : order ? (
        <>
          <p>
            {order.status === "CANCELLED"
              ? "سفارش لغو شده است."
              : order.status === "EXPIRED"
                ? "مهلت درخواست پایان یافته و موجودی آزاد شده است."
                : "در انتظار بررسی اپراتور؛ پرداختی انجام نشده است."}
          </p>
          <code dir="ltr">{order.id}</code>
          {order.status === "PENDING_REVIEW" && order.expires_at && (
            <p>
              مهلت رزرو:{" "}
              {new Intl.DateTimeFormat("fa-IR", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(order.expires_at))}
            </p>
          )}
          {order.items.map((i, index) => (
            <div className="compatibility-row" key={index}>
              <strong>{i.title}</strong>
              {i.seller_name && <span>فروشنده: {i.seller_name}</span>}
              <span>
                {number(i.quantity)} عدد · {money(i.unit_price)}
              </span>
            </div>
          ))}
          <p>جمع: {money(order.total)}</p>
          <p>
            درخواست مهمان در همین نشست مرورگر قابل پیگیری است؛ درخواست متصل به
            حساب پس از ورود از حساب کاربری در دسترس است.
          </p>
        </>
      ) : (
        <p role="status">در حال دریافت وضعیت…</p>
      )}
    </section>
  );
}
