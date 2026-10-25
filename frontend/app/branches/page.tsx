import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("شعب حضوری", "نشانی و ساعات فعالیت شعب حضوری ثبت‌شده.", "/branches");
import { serverApi } from "@/lib/api";
export const dynamic = "force-dynamic";
type Branch = {
  id: number;
  title: string;
  city: string;
  address: string;
  phone: string;
  hours: string;
};
export default async function Branches() {
  const branches = await serverApi<Branch[]>("branches/");
  return (
    <section className="container prose-page">
      <div className="eyebrow">اطلاعات مراجعه</div>
      <h1>شعب حضوری</h1>
      {branches.length ? (
        branches.map((b) => (
          <article key={b.id} className="branch-card">
            <h2>
              {b.title} · {b.city}
            </h2>
            <p>{b.address}</p>
            <p>ساعات فعالیت: {b.hours}</p>
            <p>
              تلفن: <bdi>{b.phone}</bdi>
            </p>
          </article>
        ))
      ) : (
        <>
          <p className="lead">
            هنوز نشانی و ساعت فعالیت تأییدشده‌ای برای شعب ثبت نشده است.
          </p>
          <div className="notice">
            پس از ثبت اطلاعات واقعی فروشگاه، نشانی، راه ارتباطی و ساعات فعالیت
            در این صفحه قرار می‌گیرد. تا آن زمان امکان هماهنگی مراجعه از طریق
            وب‌سایت فراهم نیست.
          </div>
        </>
      )}
    </section>
  );
}
