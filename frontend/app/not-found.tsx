import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container empty-state">
      <h1>این صفحه پیدا نشد.</h1>
      <p>ممکن است کالا از کاتالوگ خارج شده باشد.</p>
      <Link className="button primary" href="/">
        بازگشت به فروشگاه
      </Link>
    </div>
  );
}
