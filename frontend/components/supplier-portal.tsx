"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, mutate, upload } from "@/lib/api";

type Portal = {
  profile: {
    title: string;
    phone: string;
    status: string;
    review_note: string;
  } | null;
  submissions: {
    id: number;
    filename: string;
    status: string;
    review_note: string;
  }[];
};
const statuses: Record<string, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأییدشده",
  SUSPENDED: "تعلیق‌شده",
  REVIEWED: "بررسی‌شده",
  REJECTED: "ردشده",
};

export default function SupplierPortal() {
  const [data, setData] = useState<Portal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const c = new AbortController();
    api<Portal>("supplier/", { signal: c.signal })
      .then(setData)
      .catch((e: Error) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  async function submit(form: HTMLFormElement, action: "apply" | "submit") {
    const payload = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (action === "apply")
        setData(
          await mutate<Portal>("supplier/", {
            action,
            title: payload.get("title"),
            phone: payload.get("phone"),
          }),
        );
      else {
        payload.set("action", action);
        setData(await upload<Portal>("supplier/", payload));
        form.reset();
      }
      setMessage(
        "درخواست ثبت شد؛ انتشار قیمت فقط پس از بررسی ادمین انجام می‌شود.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "ارسال انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="container account-page">
      <h1>حساب خصوصی تأمین‌کننده</h1>
      <p>
        برای درخواست همکاری ابتدا حساب عادی بسازید و وارد شوید. ثبت درخواست،
        دسترسی مدیریت یا اجازهٔ انتشار قیمت ایجاد نمی‌کند.
      </p>
      <div className="operations-toolbar">
        <Link href="/register">ساخت حساب</Link>
        <Link href="/login">ورود</Link>
        <Link href="/account">حساب من</Link>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!data && !error && <p role="status">در حال دریافت…</p>}
      {data && (
        <>
          {data.profile && (
            <p>
              وضعیت: {statuses[data.profile.status]}؛ {data.profile.review_note}
            </p>
          )}
          {data.profile?.status !== "SUSPENDED" && (
            <form
              className="purchase-box operations-editor"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(e.currentTarget, "apply");
              }}
            >
              <h2>درخواست / اصلاح مشخصات همکاری</h2>
              <p>
                شماره تماس هنوز احراز نشده است. تغییر مشخصات، درخواست را دوباره
                در صف بررسی قرار می‌دهد.
              </p>
              <fieldset disabled={busy} className="operations-fields">
                <label>
                  نام تأمین‌کننده
                  <input
                    name="title"
                    required
                    maxLength={150}
                    defaultValue={data.profile?.title || ""}
                  />
                </label>
                <label>
                  شماره تماس
                  <input
                    name="phone"
                    type="tel"
                    required
                    maxLength={30}
                    defaultValue={data.profile?.phone || ""}
                  />
                </label>
                <button className="button primary">
                  ارسال برای بررسی ادمین
                </button>
              </fieldset>
            </form>
          )}
          {data.profile?.status === "APPROVED" && (
            <form
              className="purchase-box operations-editor"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(e.currentTarget, "submit");
              }}
            >
              <h2>ارائهٔ لیست جدید</h2>
              <p>
                CSV با UTF-8 یا XLSX تک‌برگ بدون فرمول؛ ستون‌ها به ترتیب:
                product_sku,purchase_price,stock. قیمت، بهای خرید سایت به تومان
                است؛ حداکثر ۵۰۰ ردیف و یک مگابایت. PDF فقط مرجع بررسی دستی است.
              </p>
              <a
                className="text-link"
                download="supplier-template.csv"
                href="data:text/csv;charset=utf-8,product_sku%2Cpurchase_price%2Cstock%0A"
              >
                دریافت قالب CSV
              </a>
              <fieldset disabled={busy}>
                <label>
                  فایل لیست
                  <input
                    name="file"
                    type="file"
                    required
                    accept=".csv,.xlsx,.pdf"
                  />
                </label>
                <button className="button primary">ارسال لیست خصوصی</button>
              </fieldset>
            </form>
          )}
          <h2>آخرین ۳۰ لیست من</h2>
          {!data.submissions.length && <p>هنوز لیستی ثبت نشده است.</p>}
          {data.submissions.map((s) => (
            <div className="purchase-box" key={s.id}>
              <a href={`/api/v1/supplier/?download=${s.id}`}>{s.filename}</a>
              <p>
                {statuses[s.status]}؛ {s.review_note}
              </p>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
