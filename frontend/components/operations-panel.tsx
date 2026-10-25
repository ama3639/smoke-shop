"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, mutate, number, money } from "@/lib/api";

type Row = {
  id: number | string;
  title: string;
  sku?: string;
  vendor_slug?: string;
  price?: number;
  stock?: number;
  updated_at?: string;
  editable?: boolean;
  url?: string;
  [key: string]: unknown;
};
type Dashboard = {
  sections: { key: string; title: string }[];
  section: string;
  stats: Record<string, number>;
  rows: Row[];
  page: number;
  total: number;
  has_next: boolean;
  can_edit_offers: boolean;
};
type Preview = {
  token: string | null;
  errors: { line: number; message: string }[];
  changes: {
    id: number;
    title: string;
    before_price: number;
    before_stock: number;
    price: number;
    stock: number;
  }[];
};
const labels: Record<string, string> = {
  id: "شناسه",
  title: "عنوان",
  sku: "SKU",
  vendor: "فروشنده",
  price: "قیمت (تومان)",
  stock: "موجودی",
  approved: "تأیید مدیریت",
  active: "فعال",
  updated_at: "آخرین تغییر",
  status: "وضعیت",
  total: "مبلغ درخواست (تومان)",
  quantity: "تعداد",
  delta: "تغییر موجودی",
  reason: "دلیل",
  created_at: "زمان",
  actor: "کاربر",
};
function display(key: string, value: unknown) {
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  if (typeof value === "number") return number(value);
  if (typeof value === "string" && key.endsWith("_at"))
    return new Date(value).toLocaleString("fa-IR");
  return String(value ?? "—");
}
export default function OperationsPanel() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [section, setSection] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Row | null>(null);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError("");
    setPreview(null);
    setEdit(null);
    const params = new URLSearchParams({
      q: search,
      page: String(page),
      state,
    });
    if (section) params.set("section", section);
    void api<Dashboard>(`operations/?${params}`, { signal: controller.signal })
      .then(setData)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [section, search, state, page, revision]);
  async function action(payload: unknown, confirm = false) {
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);
    try {
      if (confirm) {
        const result = await mutate<{ updated: number }>(
          "operations/",
          payload,
        );
        setMessage(`${number(result.updated)} عرضه به‌روزرسانی شد.`);
        setCsv("");
        setEdit(null);
        setRevision((r) => r + 1);
      } else setPreview(await mutate<Preview>("operations/", payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  const columns = [
    ...new Set(data?.rows.flatMap((r) => Object.keys(r)) || []),
  ].filter((k) => k in labels);
  return (
    <section className="container operations-page">
      <div className="eyebrow">مدیریت فروشگاه</div>
      <h1>پنل عملیات اسموک‌شاپ</h1>
      <p>
        کالا، عرضه و موجودی را از اینجا پیگیری کنید. مبلغ درخواست، گزارش پرداخت
        یا تسویه نیست.
      </p>
      <div className="operations-toolbar">
        <Link className="text-link" href="/login">
          ورود به حساب مدیریت
        </Link>
        <Link className="text-link" href="/account">
          حساب من
        </Link>
        <a className="text-link" href="/admin/">
          مدیریت پیشرفته
        </a>
      </div>
      {loading && <p role="status">در حال دریافت اطلاعات…</p>}
      {error && (
        <p role="alert" className="operations-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!loading && !data && (
        <button
          className="button secondary"
          onClick={() => setRevision((r) => r + 1)}
        >
          تلاش دوباره
        </button>
      )}
      {data && (
        <>
          <div className="operations-stats">
            {Object.entries(data.stats).map(([title, count]) => (
              <div key={title}>
                <span>{title}</span>
                <strong>{number(count)}</strong>
              </div>
            ))}
          </div>
          <nav className="operations-toolbar" aria-label="بخش‌های پنل">
            {data.sections.map((s) => (
              <button
                className="button secondary"
                key={s.key}
                aria-current={data.section === s.key ? "page" : undefined}
                disabled={busy}
                onClick={() => {
                  setSection(s.key);
                  setPage(1);
                  setState("");
                }}
              >
                {s.title}
              </button>
            ))}
          </nav>
          <form
            className="operations-toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query);
              setPage(1);
            }}
          >
            <label>
              جست‌وجو
              <input
                value={query}
                maxLength={100}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {data.section === "offers" && (
              <label>
                وضعیت
                <select
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">همه عرضه‌ها</option>
                  <option value="pending">در انتظار تأیید</option>
                  <option value="empty">بدون موجودی</option>
                  <option value="inactive">غیرفعال</option>
                </select>
              </label>
            )}
            <button className="button secondary" disabled={busy}>
              جست‌وجو
            </button>
          </form>
          {data.rows.length ? (
            <div
              className="operations-table"
              tabIndex={0}
              role="region"
              aria-label="جدول عملیات"
            >
              <table>
                <caption>
                  {number(data.total)} ردیف؛ صفحهٔ {number(data.page)}
                </caption>
                <thead>
                  <tr>
                    {columns.map((k) => (
                      <th scope="col" key={k}>
                        {labels[k]}
                      </th>
                    ))}
                    <th scope="col">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      {columns.map((k) => (
                        <td key={k}>{display(k, r[k])}</td>
                      ))}
                      <td>
                        {r.editable && (
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => {
                              setEdit({ ...r });
                              setPreview(null);
                            }}
                          >
                            ویرایش قیمت و موجودی
                          </button>
                        )}
                        {r.url && <a href={r.url}>مشاهده و مدیریت</a>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">ردیفی مطابق این فیلتر ثبت نشده است.</p>
          )}
          <div className="operations-toolbar">
            <button
              className="button secondary"
              disabled={page <= 1 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              صفحه قبل
            </button>
            <button
              className="button secondary"
              disabled={!data.has_next || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              صفحه بعد
            </button>
          </div>
          {edit && (
            <form
              className="purchase-box operations-editor"
              onSubmit={(e) => {
                e.preventDefault();
                void action({
                  action: "edit",
                  row: {
                    offer_id: String(edit.id),
                    product_sku: edit.sku,
                    vendor_slug: edit.vendor_slug,
                    price: String(edit.price),
                    stock: String(edit.stock),
                    updated_at: edit.updated_at,
                  },
                });
              }}
            >
              <h2>ویرایش {edit.title}</h2>
              <label>
                قیمت به تومان
                <input
                  required
                  type="number"
                  min="0"
                  max="9007199254740991"
                  step="1"
                  value={edit.price}
                  onChange={(e) => {
                    setPreview(null);
                    setEdit({ ...edit, price: Number(e.target.value) });
                  }}
                />
              </label>
              <label>
                موجودی
                <input
                  required
                  type="number"
                  min="0"
                  max="2147483647"
                  step="1"
                  value={edit.stock}
                  onChange={(e) => {
                    setPreview(null);
                    setEdit({ ...edit, stock: Number(e.target.value) });
                  }}
                />
              </label>
              <div className="operations-toolbar">
                <button className="button primary" disabled={busy}>
                  پیش‌نمایش تغییر
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setEdit(null);
                    setPreview(null);
                  }}
                >
                  انصراف
                </button>
              </div>
            </form>
          )}
          {data.section === "offers" && (
            <div className="purchase-box operations-editor">
              <h2>قیمت و موجودی گروهی</h2>
              <a href="/api/v1/operations/?export=csv" className="text-link">
                دریافت خروجی و قالب CSV
              </a>
              {data.can_edit_offers && (
                <>
                  <p>
                    فقط ستون‌های price و stock را تغییر دهید. شناسه، SKU،
                    فروشنده و زمان تغییر را حفظ کنید. هر فایل حداکثر ۵۰۰ ردیف؛
                    متن شناسه‌ها برای ایمنی صفحه‌گسترده با علامت &apos; صادر
                    می‌شود.
                  </p>
                  <label>
                    فایل CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      disabled={busy}
                      onChange={async (e) => {
                        setPreview(null);
                        setCsv("");
                        setError("");
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 1000000) {
                          setError("فایل باید کوچک‌تر از یک مگابایت باشد.");
                          return;
                        }
                        try {
                          setCsv(await file.text());
                        } catch {
                          setError("فایل خوانده نشد.");
                        }
                      }}
                    />
                  </label>
                  <button
                    className="button primary"
                    disabled={busy || !csv}
                    onClick={() => void action({ action: "preview", csv })}
                  >
                    بررسی و پیش‌نمایش فایل
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
      {preview && (
        <div className="purchase-box operations-editor" aria-live="polite">
          <h2>بازبینی پیش از ثبت</h2>
          {preview.errors.map((e) => (
            <p className="operations-error" key={e.line}>
              ردیف {number(e.line)}: {e.message}
            </p>
          ))}
          <p>
            تا زدن دکمهٔ تأیید، هیچ تغییری ثبت نمی‌شود. اعتبار پیش‌نمایش ۱۰
            دقیقه است.
          </p>
          <div className="operations-table">
            <table>
              <thead>
                <tr>
                  <th>کالا</th>
                  <th>قیمت قبل ← جدید</th>
                  <th>موجودی قبل ← جدید</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td>
                      {money(c.before_price)} ← {money(c.price)}
                    </td>
                    <td>
                      {number(c.before_stock)} ← {number(c.stock)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="operations-toolbar">
            <button
              className="button primary"
              disabled={busy || !preview.token || !!preview.errors.length}
              onClick={() =>
                void action({ action: "confirm", token: preview.token }, true)
              }
            >
              {busy ? "در حال ثبت…" : "تأیید و ثبت تغییرات"}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              لغو پیش‌نمایش
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
