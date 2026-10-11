import type { Metadata } from "next";
import Storefront from "@/components/storefront";
import { CatalogParams, readCatalog } from "@/lib/catalog-data";

export const metadata: Metadata = { title: "کاتالوگ همه کالاها و اکسسوری" };
export const dynamic = "force-dynamic";

export default async function CatalogPage({ searchParams }: {
  searchParams: Promise<CatalogParams>;
}) {
  const { products, catalog, filters, unavailable } = await readCatalog(await searchParams);
  return <Storefront key={JSON.stringify(filters)} home={false} initialPage={products} initialVendor={filters.vendor}
    initialType={filters.type} initialMode={filters.mode} initialCategory={filters.category}
    initialBrand={filters.brand} initialQuery={filters.q} catalog={catalog} unavailable={unavailable} />;
}
