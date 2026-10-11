import { existsSync } from "node:fs";
import { join } from "node:path";
import Storefront from "@/components/storefront";
import { Catalog, ProductPage, serverApi } from "@/lib/api";

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ vendor?: string }> }) {
  const vendor = (await searchParams).vendor || "";
  // Use the exact hero photo supplied through Git; keep a real packet photo until upload.
  const heroImage = existsSync(
    join(process.cwd(), "public/images/hero/winston-collection.png"),
  )
    ? "/images/hero/winston-collection.png"
    : "/images/products/winston/optimized/12.webp";
  try {
    const [products, catalog] = await Promise.all([
      serverApi<ProductPage>(`catalog/products/?type=cigarette&pagination=1&page_size=24&vendor=${encodeURIComponent(vendor)}`),
      serverApi<Catalog>("catalog/?type=cigarette"),
    ]);
    return (
      <Storefront
        heroImage={heroImage}
        initialPage={products}
        initialVendor={vendor}
        catalog={catalog}
        unavailable={false}
      />
    );
  } catch {
    return (
      <Storefront
        heroImage={heroImage}
        initialPage={{ items: [], total: 0, page: 1, page_size: 24, pages: 1, has_next: false }}
        initialVendor={vendor}
        catalog={{ categories: [], devices: [], checkout_enabled: false, brands: [], types: [], vendors: [], total: 0, updated_at: null }}
        unavailable
      />
    );
  }
}
