"use client";
import { useEffect, useState } from "react";
import { api, mutate } from "@/lib/api";
type Access = {
  users: {
    id: number;
    username: string;
    groups: number[];
    is_staff: boolean;
    has_direct_permissions: boolean;
    token: string;
  }[];
  groups: { id: number; name: string; permissions: number[]; token: string }[];
  permissions: { id: number; codename: string; name: string }[];
};
export default function AccessControls() {
  const [data, setData] = useState<Access | null>(null);
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    api<Access>("operations/?access=1", { signal: c.signal })
      .then(setData)
      .catch((e: Error) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  async function save(payload: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setData(await mutate<Access>("operations/", payload));
      setMessage("دسترسی با ثبت سابقه به‌روز شد.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  const user = data?.users.find((u) => String(u.id) === userId);
  const role = data?.groups.find((g) => String(g.id) === roleId);
  return (
    <section className="purchase-box operations-editor">
      <h2>نقش‌ها و دسترسی‌ها — مدیر ارشد</h2>
      <p>
        تغییر مجوزهای نقش بر همهٔ اعضای آن اثر دارد. حساب تأمین‌کننده
        به‌خودی‌خود نیازی به staff یا نقش مدیریت ندارد.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          <label>
            کاربر (حداکثر ۲۰۰ حساب؛ فهرست کامل در مدیریت پیشرفته)
            <select
              value={userId}
              disabled={busy}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">انتخاب کنید</option>
              {data.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          </label>
          {user && (
            <form
              key={user.token}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save({
                  action: "save_access",
                  user_id: user.id,
                  groups: f.getAll("groups").map(Number),
                  is_staff: f.get("is_staff") === "on",
                  token: user.token,
                });
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  <input
                    type="checkbox"
                    name="is_staff"
                    defaultChecked={user.is_staff}
                  />
                  اجازهٔ ورود به پنل مدیریت
                </label>
                {user.has_direct_permissions && (
                  <p>
                    این حساب مجوز مستقیم هم دارد؛ تغییر گروه‌ها آن مجوزها را حذف
                    نمی‌کند. بازبینی از مدیریت پیشرفته توسط مدیر ارشد انجام شود.
                  </p>
                )}
                {data.groups.map((g) => (
                  <label key={g.id}>
                    <input
                      type="checkbox"
                      name="groups"
                      value={g.id}
                      defaultChecked={user.groups.includes(g.id)}
                    />
                    {g.name}
                  </label>
                ))}
                <button className="button primary">ثبت دسترسی کاربر</button>
              </fieldset>
            </form>
          )}
          <hr />
          <label>
            نقش
            <select
              value={roleId}
              disabled={busy}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value="">ایجاد نقش جدید</option>
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <form
            key={role?.token || "new"}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save({
                action: "save_role",
                role_id: role?.id ?? null,
                name: f.get("name"),
                permissions: f.getAll("permissions").map(Number),
                token: role?.token,
              });
            }}
          >
            <fieldset disabled={busy}>
              <label>
                نام نقش
                <input
                  name="name"
                  required
                  maxLength={150}
                  defaultValue={role?.name || ""}
                  readOnly={Boolean(role)}
                />
              </label>
              <div className="operations-permissions">
                {data.permissions.map((p) => (
                  <label key={p.id}>
                    <input
                      type="checkbox"
                      name="permissions"
                      value={p.id}
                      defaultChecked={role?.permissions.includes(p.id)}
                    />
                    {p.name} <small dir="ltr">{p.codename}</small>
                  </label>
                ))}
              </div>
              <button className="button primary">ثبت مجوزهای نقش</button>
            </fieldset>
          </form>
        </>
      )}
    </section>
  );
}
