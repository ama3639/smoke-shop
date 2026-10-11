import Link from "next/link";
import { serverApi, Vendor } from "@/lib/api";

export const dynamic = "force-dynamic";
export default async function Sellers() {
  let vendors: Vendor[] = [];
  let unavailable = false;
  try { vendors = await serverApi<Vendor[]>("vendors/"); } catch { unavailable = true; }
  return <section className="container prose-page">
    <div className="eyebrow">شبکه عرضه / فروشندگان</div>
    <h1>فروشندگان کاتالوگ</h1>
    <p>اطلاعات عمومی فروشندگان تأییدشده و مسیر مراجعه.</p>
    {unavailable ? <p role="alert">اطلاعات فروشندگان اکنون در دسترس نیست.</p> : vendors.length ? <div className="seller-directory">
      {vendors.map(v => <article className="branch-card" key={v.slug}>
        <h2>{v.title}</h2><p>{v.description}</p><p>{v.city}</p><p>{v.address}</p>
        {v.phone && <a href={`tel:${v.phone}`} dir="ltr">{v.phone}</a>}
        <p><Link href={`/?vendor=${encodeURIComponent(v.slug)}#catalog`}>مشاهده کالاهای فروشنده</Link></p>
      </article>)}
    </div> : <p>هنوز فروشنده تأییدشده‌ای ثبت نشده است.</p>}
  </section>;
}
