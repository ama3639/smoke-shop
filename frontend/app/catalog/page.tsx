import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Storefront from "@/components/storefront";
import { CatalogParams, readCatalog } from "@/lib/catalog-data";

export async function generateMetadata({ searchParams }: { searchParams: Promise<CatalogParams> }): Promise<Metadata> {
  const params = await searchParams;
  return { ...pageMetadata("کاتالوگ همه کالاها و اکسسوری", "مشخصات، برند و عرضه‌های ثبت‌شدهٔ کاتالوگ.", "/catalog"),
    ...(Object.keys(params).length ? { robots: { index: false, follow: true } } : {}) };
}
export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogParams>;
}) {
  const { products, catalog, filters, unavailable } = await readCatalog(
    await searchParams,
  );
  return (
    <Storefront
      key={JSON.stringify(filters)}
      initialPage={products}
      initialVendor={filters.vendor}
      initialType={filters.type}
      initialMode={filters.mode}
      initialCategory={filters.category}
      initialFlavor={filters.flavor}
      initialWeight={filters.weight}
      initialBrand={filters.brand}
      initialQuery={filters.q}
      catalog={catalog}
      unavailable={unavailable}
    />
  );
}
