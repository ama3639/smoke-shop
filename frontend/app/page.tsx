import Storefront from "@/components/storefront";
import { Catalog, Product, serverApi } from "@/lib/api";

export const dynamic = "force-dynamic";
export default async function Home() {
  try {
    const [products, catalog] = await Promise.all([
      serverApi<Product[]>("catalog/products/?type=cigarette"),
      serverApi<Catalog>("catalog/?type=cigarette"),
    ]);
    return (
      <Storefront
        initialProducts={products}
        catalog={catalog}
        unavailable={false}
      />
    );
  } catch {
    return (
      <Storefront
        initialProducts={[]}
        catalog={{ categories: [], devices: [], checkout_enabled: false }}
        unavailable
      />
    );
  }
}
