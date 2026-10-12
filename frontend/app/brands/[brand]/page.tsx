import { notFound } from "next/navigation";
import Storefront from "@/components/storefront";
import { readCatalog } from "@/lib/catalog-data";
export const dynamic = "force-dynamic";
export default async function BrandPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  const { catalog, products, filters, unavailable } = await readCatalog({
    brand,
  });
  if (!unavailable && !catalog.brands.includes(brand)) notFound();
  return (
    <Storefront
      key={brand}
      initialPage={products}
      initialVendor=""
      initialBrand={filters.brand}
      catalog={catalog}
      unavailable={unavailable}
      heading={`کاتالوگ ${brand}`}
    />
  );
}
