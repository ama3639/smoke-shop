"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, mutate, money } from "@/lib/api";
import { shoppingChanged } from "@/lib/wishlist";
type Account = {
  authenticated: boolean;
  user?: { username: string; name: string; email: string };
  orders: { id: string; total: number; status: string; created_at: string }[];
  pagination?: {
    page: number;
    pages: number;
    has_next: boolean;
    total: number;
  };
};
export default function AccountView({
  mode,
}: {
  mode: "login" | "register" | "account";
}) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const c = new AbortController();
    api<Account>("account/", { signal: c.signal })
      .then(setAccount)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await mutate<Account>("account/", {
        action: mode === "account" ? "update" : mode,
        username: form.get("username"),
        password: form.get("password"),
        confirm: form.get("confirm"),
        email: form.get("email"),
        name: form.get("name"),
        adult: form.get("adult") === "on",
      });
      setAccount(result);
      shoppingChanged();
      if (mode !== "account") router.replace("/account");
      else setMessage("اطلاعات حساب به‌روز شد.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "درخواست انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await mutate("account/", { action: "logout" });
      shoppingChanged();
      router.replace("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خروج انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  async function orderPage(page: number) {
    setBusy(true);
    try {
      setAccount(await api<Account>(`account/?order_page=${page}`));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  const registering = mode === "register";
  return (
    <section className="container account-page">
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {!account && !error ? (
        <p role="status">در حال دریافت حساب…</p>
      ) : mode === "account" && !account?.authenticated ? (
        <div className="empty-state">
          <h1>حساب کاربری</h1>
          <p>برای مشاهده مشخصات و درخواست‌های خود وارد شوید.</p>
          <Link href="/login" className="button primary">
            ورود به حساب
          </Link>
          <Link href="/register" className="button secondary">
            ثبت‌نام
          </Link>
        </div>
      ) : account?.authenticated && mode !== "account" ? (
        <div className="empty-state">
          <h1>شما وارد حساب شده‌اید.</h1>
          <Link href="/account" className="button primary">
            مشاهده حساب
          </Link>
        </div>
      ) : mode !== "account" ? (
        <form className="auth-form" onSubmit={submit}>
          <div className="eyebrow">SMOKE SHOP / ACCOUNT</div>
          <h1>{registering ? "ساخت حساب کاربری" : "ورود به حساب"}</h1>
          <label>
            نام کاربری
            <input
              name="username"
              aria-label="نام کاربری"
              dir="auto"
              autoComplete="username"
              required
              minLength={registering ? 3 : 1}
              maxLength={150}
            />
          </label>
          {registering && (
            <>
              <label>
                نام نمایشی
                <input
                  name="name"
                  aria-label="نام نمایشی"
                  autoComplete="name"
                  maxLength={150}
                />
              </label>
              <label>
                ایمیل اختیاری
                <input
                  name="email"
                  aria-label="ایمیل"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  maxLength={254}
                />
              </label>
            </>
          )}
          <label>
            رمز عبور
            <input
              name="password"
              aria-label="رمز عبور"
              type="password"
              dir="ltr"
              autoComplete={registering ? "new-password" : "current-password"}
              required
              minLength={registering ? 8 : 1}
              maxLength={128}
            />
          </label>
          {registering && (
            <>
              <label>
                تکرار رمز عبور
                <input
                  name="confirm"
                  aria-label="تکرار رمز عبور"
                  type="password"
                  autoComplete="new-password"
                  required
                  maxLength={128}
                />
              </label>
              <label className="age-consent">
                <input name="adult" type="checkbox" required />
                تأیید می‌کنم ۱۸ سال یا بیشتر دارم و شرایط سایت را خوانده‌ام.
              </label>
            </>
          )}
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "در حال پردازش…" : registering ? "ثبت‌نام" : "ورود"}
          </button>
          <div className="auth-links">
            <Link href={registering ? "/login" : "/register"}>
              {registering ? "حساب دارم؛ ورود" : "ساخت حساب جدید"}
            </Link>
            <Link href="/policy">شرایط و حریم خصوصی</Link>
          </div>
        </form>
      ) : (
        <>
          <div className="account-heading">
            <div>
              <div className="eyebrow">حساب شخصی</div>
              <h1>{account?.user?.name || account?.user?.username}</h1>
            </div>
            <button
              className="button secondary"
              disabled={busy}
              onClick={logout}
            >
              خروج از حساب
            </button>
          </div>
          <div className="account-grid">
            <aside className="account-panel">
              <Link href="/wishlist">علاقه‌مندی‌های مرورگر</Link>
              <Link href="/cart">سبد فعلی</Link>
              <Link href="/policy">شرایط و حریم خصوصی</Link>
            </aside>
            <div>
              <form className="account-panel" onSubmit={submit}>
                <h2>مشخصات حساب</h2>
                <label>
                  نام نمایشی
                  <input
                    name="name"
                    aria-label="ویرایش نام نمایشی"
                    defaultValue={account?.user?.name}
                    maxLength={150}
                  />
                </label>
                <label>
                  ایمیل اختیاری
                  <input
                    name="email"
                    aria-label="ویرایش ایمیل"
                    type="email"
                    dir="ltr"
                    defaultValue={account?.user?.email}
                    maxLength={254}
                  />
                </label>
                <button
                  type="submit"
                  className="button primary"
                  disabled={busy}
                >
                  ذخیره مشخصات
                </button>
              </form>
              <div className="account-panel">
                <h2>درخواست‌های من</h2>
                {account?.orders.length ? (
                  account.orders.map((o) => (
                    <Link
                      className="account-order"
                      key={o.id}
                      href={`/orders/${o.id}`}
                    >
                      <span>
                        {new Date(o.created_at).toLocaleDateString("fa-IR")}
                      </span>
                      <span>{money(o.total)}</span>
                      <span>
                        {o.status === "EXPIRED"
                          ? "منقضی"
                          : o.status === "CANCELLED"
                            ? "لغوشده"
                            : "در انتظار بررسی"}
                      </span>
                      <span>مشاهده درخواست</span>
                    </Link>
                  ))
                ) : (
                  <p>درخواستی برای این حساب ثبت نشده است.</p>
                )}
                {account?.pagination && account.pagination.pages > 1 && (
                  <div className="catalog-pagination">
                    <button
                      disabled={busy || account.pagination.page <= 1}
                      onClick={() => orderPage(account.pagination!.page - 1)}
                    >
                      صفحه قبل درخواست‌ها
                    </button>
                    <span>
                      صفحه {account.pagination.page} از{" "}
                      {account.pagination.pages}
                    </span>
                    <button
                      disabled={busy || !account.pagination.has_next}
                      onClick={() => orderPage(account.pagination!.page + 1)}
                    >
                      صفحه بعد درخواست‌ها
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
