"use client";
import { use, useEffect, useState } from "react";
import { api, money, number } from "@/lib/api";

type Order = {
  id: string;
  total: number;
  status: string;
  items: { title: string; quantity: number; unit_price: number }[];
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
              : "در انتظار بررسی اپراتور؛ پرداختی انجام نشده است."}
          </p>
          <code dir="ltr">{order.id}</code>
          {order.items.map((i, index) => (
            <div className="compatibility-row" key={index}>
              <strong>{i.title}</strong>
              <span>
                {number(i.quantity)} عدد · {money(i.unit_price)}
              </span>
            </div>
          ))}
          <p>جمع: {money(order.total)}</p>
          <p>برای مشاهده مجدد این سفارش، از همین مرورگر استفاده کنید.</p>
        </>
      ) : (
        <p role="status">در حال دریافت وضعیت…</p>
      )}
    </section>
  );
}
