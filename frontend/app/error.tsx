"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container empty-state" role="alert">
      <h1>دریافت اطلاعات انجام نشد.</h1>
      <p>اتصال فروشگاه را بررسی کنید و دوباره تلاش کنید.</p>
      <button className="button primary" onClick={reset}>
        تلاش دوباره
      </button>
    </div>
  );
}
