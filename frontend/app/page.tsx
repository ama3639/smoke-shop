import HomeContent from "@/components/home-content";
import { readCatalog } from "@/lib/catalog-data";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { products, catalog, unavailable } = await readCatalog({}, true);
  return (
    <HomeContent
      products={products}
      catalog={catalog}
      unavailable={unavailable}
    />
  );
}
