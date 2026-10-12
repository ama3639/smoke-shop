import Storefront from "@/components/storefront";
import { CatalogParams, readCatalog } from "@/lib/catalog-data";
export const dynamic = "force-dynamic";
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<CatalogParams>;
}) {
  const { catalog, products, filters, unavailable } = await readCatalog(
    await searchParams,
  );
  return (
    <Storefront
      key={JSON.stringify(filters)}
      initialPage={products}
      initialVendor={filters.vendor}
      initialBrand={filters.brand}
      initialCategory={filters.category}
      initialType={filters.type}
      initialQuery={filters.q}
      initialFlavor={filters.flavor}
      initialWeight={filters.weight}
      initialMode={filters.mode}
      catalog={catalog}
      unavailable={unavailable}
      heading="نتایج جست‌وجو"
    />
  );
}
