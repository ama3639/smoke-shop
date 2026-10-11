import { existsSync } from "node:fs";
import { join } from "node:path";
import Storefront from "@/components/storefront";
import { CatalogParams, readCatalog } from "@/lib/catalog-data";

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  const { products, catalog, filters, unavailable } = await readCatalog(await searchParams, true);
  // Use the exact hero photo supplied through Git; keep a real packet photo until upload.
  const heroImage = existsSync(
    join(process.cwd(), "public/images/hero/winston-collection.png"),
  )
    ? "/images/hero/winston-collection.png"
    : "/images/products/winston/optimized/12.webp";
  return <Storefront key={JSON.stringify(filters)} heroImage={heroImage} initialPage={products}
    initialVendor={filters.vendor} initialCategory={filters.category} initialBrand={filters.brand}
    initialQuery={filters.q} initialMode={filters.mode} catalog={catalog} unavailable={unavailable} />;
}
