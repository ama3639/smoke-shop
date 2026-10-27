"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, mutate, upload, number, money } from "@/lib/api";
import AccessControls from "./access-controls";
import {
  Boxes,
  Package,
  ShoppingBag,
  Users,
  Store,
  ClipboardList,
  FileSpreadsheet,
  History,
  Settings,
  RefreshCw,
} from "lucide-react";

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
  can_create: boolean;
  can_change: boolean;
  can_manage_access: boolean;
  can_view_details: boolean;
  filters: { value: string; title: string }[];
};
type RecordForm = {
  section: string;
  record_id: string;
  token: string;
  fields: {
    name: string;
    label: string;
    kind: string;
    required: boolean;
    disabled: boolean;
    help: string;
    value: string | boolean;
    options: [string, string][];
    max_length: number | null;
  }[];
};
type OrderDetail = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  expires_at: string | null;
  can_cancel: boolean;
  items: {
    title: string;
    seller_name: string;
    quantity: number;
    unit_price: number;
  }[];
};
type CustomerDetail = {
  id: number;
  title: string;
  username: string;
  email: string;
  active: boolean;
  created_at: string;
  order_count: number;
  orders:
    | { id: string; status: string; total: number; created_at: string }[]
    | null;
  supply_requests:
    | { title: string; status: string; quantity: number; created_at: string }[]
    | null;
};
const navigation = [
  { title: "فروشگاه", keys: ["products", "offers", "orders", "customers"] },
  {
    title: "تأمین و همکاری",
    keys: ["suppliers", "submissions", "supply", "vendors"],
  },
  { title: "نظارت و تنظیمات", keys: ["items", "stock", "audit", "settings"] },
];
const sectionIcons: Record<string, typeof Package> = {
  products: Package,
  offers: Boxes,
  orders: ShoppingBag,
  customers: Users,
  suppliers: Store,
  submissions: FileSpreadsheet,
  supply: ClipboardList,
  vendors: Store,
  items: ClipboardList,
  stock: Boxes,
  audit: History,
  settings: Settings,
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
  phone: "شماره تماس (تأییدنشده)",
  username: "نام کاربری",
  email: "ایمیل (تأییدنشده)",
  order_count: "تعداد رزرو",
};
const statuses: Record<string, string> = {
  PENDING_REVIEW: "در انتظار بررسی",
  CANCELLED: "لغوشده",
  EXPIRED: "منقضی‌شده",
};
function display(key: string, value: unknown) {
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  if (typeof value === "number") return number(value);
  if (typeof value === "string" && key.endsWith("_at"))
    return new Date(value).toLocaleString("fa-IR");
  return key === "status"
    ? statuses[String(value)] || String(value ?? "—")
    : String(value || "—");
}
export default function OperationsPanel() {
  const [record, setRecord] = useState<RecordForm | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (record || order || customer) editorHeading.current?.focus();
  }, [record, order, customer]);
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
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showAccess, setShowAccess] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setRecord(null);
    setOrder(null);
    setCustomer(null);
    setError("");
    setPreview(null);
    setEdit(null);
    setImportFile(null);
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
  async function filePreview() {
    if (!importFile) return;
    setBusy(true);
    setError("");
    setPreview(null);
    const form = new FormData();
    form.set("action", "preview");
    form.set("file", importFile);
    try {
      setPreview(await upload<Preview>("operations/", form));
    } catch (e) {
      setError(e instanceof Error ? e.message : "فایل خوانده نشد.");
    } finally {
      setBusy(false);
    }
  }
  async function openRecord(id: string | number) {
    if (!data) return;
    setBusy(true);
    setError("");
    setRecord(null);
    setOrder(null);
    setCustomer(null);
    setEdit(null);
    setPreview(null);
    setCancelConfirmed(false);
    try {
      const path = `operations/?section=${data.section}&record=${encodeURIComponent(id)}`;
      if (data.section === "customers")
        setCustomer(await api<CustomerDetail>(path));
      else if (data.section === "orders")
        setOrder(await api<OrderDetail>(path));
      else setRecord(await api<RecordForm>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "فرم دریافت نشد.");
    } finally {
      setBusy(false);
    }
  }
  async function saveRecord(form: HTMLFormElement) {
    if (!record) return;
    const payload = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const csrf = await api<{ csrf_token: string }>("session/");
      payload.set("action", "save_record");
      payload.set("token", record.token);
      const response = await fetch("/api/v1/operations/", {
        method: "POST",
        headers: { "X-CSRFToken": csrf.csrf_token },
        body: payload,
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error?.message || "ثبت انجام نشد.");
      setMessage("اطلاعات ثبت شد.");
      setRecord(null);
      setRevision((r) => r + 1);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "ارتباط برقرار نشد؛ نتیجه را بازبینی کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function cancelOrder() {
    if (!order || !cancelConfirmed) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await mutate("operations/", { action: "cancel_order", id: order.id });
      setOrder(null);
      setMessage("رزرو لغو شد؛ موجودی آزاد شده است.");
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "لغو انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  const columns = [
    ...new Set(data?.rows.flatMap((r) => Object.keys(r)) || []),
  ].filter((k) => k in labels);
  function selectSection(key: string) {
    setSection(key);
    setShowAccess(false);
    setPage(1);
    setState("");
    setSearch("");
    setQuery("");
    setMessage("");
  }
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
        <button
          className="button secondary"
          disabled={loading || busy}
          onClick={() => setRevision((r) => r + 1)}
        >
          <RefreshCw size={16} aria-hidden="true" /> تازه‌سازی اطلاعات
        </button>
      </div>
      <div
        className={`operations-workspace${data ? "" : " operations-workspace-empty"}`}
      >
        <aside className="operations-sidebar" hidden={!data}>
          <nav aria-label="بخش‌های پنل">
            {navigation.map((group) => {
              const sections = group.keys.flatMap(
                (key) => data?.sections.filter((s) => s.key === key) || [],
              );
              return (
                sections.length > 0 && (
                  <div className="operations-nav-group" key={group.title}>
                    <p>{group.title}</p>
                    {sections.map((s) => {
                      const Icon = sectionIcons[s.key] || ClipboardList;
                      return (
                        <button
                          key={s.key}
                          className="operations-nav-link"
                          aria-label={s.title}
                          aria-current={
                            data?.section === s.key && !showAccess
                              ? "page"
                              : undefined
                          }
                          disabled={busy}
                          onClick={() => selectSection(s.key)}
                        >
                          <Icon size={18} aria-hidden="true" />
                          <span>{s.title}</span>
                          <span className="operations-count" aria-hidden="true">
                            {number(data?.stats[s.title] || 0)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )
              );
            })}
            {data?.can_manage_access && (
              <button
                className="operations-nav-link"
                aria-pressed={showAccess}
                disabled={busy}
                onClick={() => {
                  setShowAccess((v) => !v);
                  setRecord(null);
                  setOrder(null);
                  setCustomer(null);
                  setEdit(null);
                  setPreview(null);
                }}
              >
                <Users size={18} aria-hidden="true" /> مدیریت نقش‌ها و دسترسی‌ها
              </button>
            )}
          </nav>
        </aside>
        <div className="operations-main" aria-busy={loading}>
          {(loading || message) && (
            <p role="status">{loading ? "در حال دریافت اطلاعات…" : message}</p>
          )}
          {error && (
            <p role="alert" className="operations-error">
              {error}
            </p>
          )}
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
              {data.can_manage_access && showAccess && <AccessControls />}
              {!showAccess && (
                <>
                  <div className="operations-stats">
                    {data.sections
                      .filter((s) =>
                        ["products", "offers", "orders", "customers"].includes(
                          s.key,
                        ),
                      )
                      .map((s) => (
                        <button
                          key={s.key}
                          onClick={() => selectSection(s.key)}
                          disabled={busy}
                          aria-label={`مشاهدهٔ ${s.title}`}
                        >
                          <span>{s.title}</span>
                          <strong>{number(data.stats[s.title])}</strong>
                          <small>مشاهدهٔ فهرست</small>
                        </button>
                      ))}
                  </div>
                  <h2>
                    {data.sections.find((s) => s.key === data.section)?.title}
                  </h2>
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
                    {data.filters.length > 0 && (
                      <label>
                        وضعیت
                        <select
                          value={state}
                          onChange={(e) => {
                            setState(e.target.value);
                            setPage(1);
                          }}
                        >
                          <option value="">همه وضعیت‌ها</option>
                          {data.filters.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button className="button secondary" disabled={busy}>
                      جست‌وجو
                    </button>
                  </form>
                  {data.can_create && (
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => void openRecord("new")}
                    >
                      ثبت مورد جدید
                    </button>
                  )}
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
                                {(data.can_change || data.can_view_details) && (
                                  <button
                                    className="button secondary"
                                    disabled={busy}
                                    onClick={() => void openRecord(r.id)}
                                  >
                                    {data.section === "customers"
                                      ? "پرونده مشتری"
                                      : data.section === "orders"
                                        ? "جزئیات رزرو"
                                        : "ویرایش اطلاعات"}
                                  </button>
                                )}
                                {r.url && (
                                  <a href={r.url}>
                                    {data.section === "submissions"
                                      ? "دریافت فایل خصوصی"
                                      : "مدیریت پیشرفته"}
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty-state">
                      ردیفی مطابق این فیلتر ثبت نشده است.
                    </p>
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
                      <a
                        href="/api/v1/operations/?export=csv"
                        className="text-link"
                      >
                        دریافت خروجی و قالب CSV
                      </a>
                      {data.can_edit_offers && (
                        <>
                          <p>
                            فقط ستون‌های price و stock را تغییر دهید. شناسه،
                            SKU، فروشنده و زمان تغییر را حفظ کنید. هر فایل
                            حداکثر ۵۰۰ ردیف؛ متن شناسه‌ها برای ایمنی صفحه‌گسترده
                            با علامت &apos; صادر می‌شود.
                          </p>
                          <label>
                            فایل CSV یا Excel
                            <input
                              type="file"
                              accept=".csv,.xlsx"
                              disabled={busy}
                              onChange={async (e) => {
                                setPreview(null);
                                setCsv("");
                                setImportFile(null);
                                setError("");
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 1000000) {
                                  setError(
                                    "فایل باید کوچک‌تر از یک مگابایت باشد.",
                                  );
                                  return;
                                }
                                try {
                                  if (file.name.toLowerCase().endsWith(".xlsx"))
                                    setImportFile(file);
                                  else setCsv(await file.text());
                                } catch {
                                  setError("فایل خوانده نشد.");
                                }
                              }}
                            />
                          </label>
                          <button
                            className="button primary"
                            disabled={busy || (!csv && !importFile)}
                            onClick={() =>
                              void (importFile
                                ? filePreview()
                                : action({ action: "preview", csv }))
                            }
                          >
                            بررسی و پیش‌نمایش فایل
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {record && (
            <form
              className="purchase-box operations-editor"
              onSubmit={(e) => {
                e.preventDefault();
                void saveRecord(e.currentTarget);
              }}
            >
              <h2 ref={editorHeading} tabIndex={-1}>
                {record.record_id === "new"
                  ? "ثبت اطلاعات جدید"
                  : "ویرایش اطلاعات"}
              </h2>
              <p>
                فقط اطلاعات واقعی و دارای منبع را ثبت کنید. سیاست خرید و قیمت
                سفارش‌های قبلی تغییر نمی‌کند. قیمت و موجودی عرضهٔ موجود از فرم
                پیش‌نمایش مدیریت می‌شود.
              </p>
              <fieldset disabled={busy} className="operations-fields">
                {record.fields.map((f) => (
                  <label key={f.name}>
                    {f.label}
                    {f.kind === "boolean" ? (
                      <input
                        type="checkbox"
                        name={f.name}
                        defaultChecked={Boolean(f.value)}
                        disabled={f.disabled}
                      />
                    ) : f.kind === "select" ? (
                      <select
                        name={f.name}
                        defaultValue={String(f.value)}
                        required={f.required}
                        disabled={f.disabled}
                      >
                        {f.options.map(([v, label]) => (
                          <option value={v} key={v}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : f.kind === "textarea" ? (
                      <textarea
                        name={f.name}
                        defaultValue={String(f.value)}
                        required={f.required}
                        maxLength={f.max_length || undefined}
                        disabled={f.disabled}
                      />
                    ) : f.kind === "file" ? (
                      <>
                        <input
                          type="file"
                          name={f.name}
                          accept="image/png,image/jpeg,image/webp"
                        />
                        {f.value && (
                          <span>
                            فایل فعلی: {String(f.value)}؛ انتخاب نکردن فایل،
                            تصویر فعلی را حفظ می‌کند.
                          </span>
                        )}
                      </>
                    ) : (
                      <input
                        type={f.kind}
                        name={f.name}
                        defaultValue={String(f.value)}
                        required={f.required}
                        maxLength={f.max_length || undefined}
                        disabled={f.disabled}
                        step={
                          f.name === "weight_grams" ||
                          f.name.endsWith("_percent")
                            ? "0.01"
                            : "1"
                        }
                      />
                    )}
                    {f.help && <small>{f.help}</small>}
                  </label>
                ))}
              </fieldset>
              <div className="operations-toolbar">
                <button className="button primary" disabled={busy}>
                  ثبت اطلاعات
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setRecord(null)}
                >
                  بستن فرم
                </button>
              </div>
            </form>
          )}
          {order && (
            <div className="purchase-box operations-editor">
              <h2 ref={editorHeading} tabIndex={-1}>
                جزئیات رزرو
              </h2>
              <p>
                {order.id} — {order.status}
              </p>
              <p>مبلغ درخواست: {money(order.total)}</p>
              <p>
                ثبت: {display("created_at", order.created_at)}؛ انقضا:{" "}
                {order.expires_at
                  ? display("expires_at", order.expires_at)
                  : "ثبت نشده"}
              </p>
              <ul>
                {order.items.map((item, i) => (
                  <li key={i}>
                    {item.title} — {item.seller_name || "عرضه مستقیم"} —{" "}
                    {number(item.quantity)} عدد × {money(item.unit_price)}
                  </li>
                ))}
              </ul>
              {order.can_cancel && (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={cancelConfirmed}
                      onChange={(e) => setCancelConfirmed(e.target.checked)}
                      disabled={busy}
                    />
                    لغو این رزرو و آزادسازی موجودی را تأیید می‌کنم.
                  </label>
                  <button
                    className="button primary"
                    disabled={busy || !cancelConfirmed}
                    onClick={() => void cancelOrder()}
                  >
                    لغو رزرو
                  </button>
                </>
              )}
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setOrder(null)}
              >
                بستن جزئیات
              </button>
            </div>
          )}
          {customer && !showAccess && (
            <div className="purchase-box operations-editor">
              <h2 ref={editorHeading} tabIndex={-1}>
                پرونده مشتری — {customer.title}
              </h2>
              <dl className="operations-customer-info">
                <div>
                  <dt>نام کاربری</dt>
                  <dd dir="auto">{customer.username}</dd>
                </div>
                <div>
                  <dt>ایمیل (تأییدنشده)</dt>
                  <dd dir="auto">{customer.email || "ثبت نشده"}</dd>
                </div>
                <div>
                  <dt>وضعیت حساب</dt>
                  <dd>{customer.active ? "فعال" : "غیرفعال"}</dd>
                </div>
                <div>
                  <dt>تاریخ عضویت</dt>
                  <dd>{display("created_at", customer.created_at)}</dd>
                </div>
              </dl>
              <p>
                اطلاعات این پرونده فقط خواندنی است؛ نقش و دسترسی از بخش مدیر
                ارشد تعیین می‌شود. رزروها گزارش پرداخت نیستند.
              </p>
              <h3>رزروهای مشتری — {number(customer.order_count)} مورد</h3>
              {customer.orders === null ? (
                <p>مجوز مشاهدهٔ سفارش‌ها به این حساب داده نشده است.</p>
              ) : customer.orders.length ? (
                <ul>
                  {customer.orders.map((o) => (
                    <li key={o.id}>
                      <span dir="ltr">{o.id}</span> —{" "}
                      {display("status", o.status)} — {money(o.total)}
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            setOrder(
                              await api<OrderDetail>(
                                `operations/?section=orders&record=${encodeURIComponent(o.id)}`,
                              ),
                            );
                            setCustomer(null);
                          } catch (e) {
                            setError(
                              e instanceof Error
                                ? e.message
                                : "جزئیات دریافت نشد.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        جزئیات رزرو
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>رزروی برای این حساب ثبت نشده است.</p>
              )}
              <h3>درخواست‌های تأمین</h3>
              {customer.supply_requests === null ? (
                <p>مجوز مشاهدهٔ درخواست تأمین به این حساب داده نشده است.</p>
              ) : customer.supply_requests.length ? (
                <ul>
                  {customer.supply_requests.map((r, i) => (
                    <li key={i}>
                      {r.title} — {number(r.quantity)} عدد — {r.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>درخواست تأمینی ثبت نشده است.</p>
              )}
              <small>
                حداکثر ۲۰ مورد آخر هر فهرست؛ برای پیگیری کامل از بخش مربوط
                استفاده کنید.
              </small>
              <button
                className="button secondary"
                onClick={() => setCustomer(null)}
              >
                بستن پرونده
              </button>
            </div>
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
                    void action(
                      { action: "confirm", token: preview.token },
                      true,
                    )
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
        </div>
      </div>
    </section>
  );
}
