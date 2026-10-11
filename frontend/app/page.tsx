import { existsSync } from "node:fs";
import { join } from "node:path";
import Storefront from "@/components/storefront";
import { Catalog, Product, serverApi } from "@/lib/api";

export const dynamic = "force-dynamic";
export default async function Home() {
  // Use the exact hero photo supplied through Git; keep a real packet photo until upload.
  const heroImage = existsSync(
    join(process.cwd(), "public/images/hero/winston-collection.png"),
  )
    ? "/images/hero/winston-collection.png"
    : "/images/products/winston/optimized/12.webp";
  try {
    const [products, catalog] = await Promise.all([
      serverApi<Product[]>("catalog/products/?type=cigarette"),
      serverApi<Catalog>("catalog/?type=cigarette"),
    ]);
    return (
      <Storefront
        heroImage={heroImage}
        initialProducts={products}
        catalog={catalog}
        unavailable={false}
      />
    );
  } catch {
    return (
      <Storefront
        heroImage={heroImage}
        initialProducts={[]}
        catalog={{ categories: [], devices: [], checkout_enabled: false }}
        unavailable
      />
    );
  }
}
