import type { Metadata } from "next";
import Storefront from "@/components/storefront";
import { Catalog, ProductPage, serverApi } from "@/lib/api";

export const metadata: Metadata = { title: "کاتالوگ همه کالاها و اکسسوری" };
export const dynamic = "force-dynamic";

export default async function CatalogPage({ searchParams }: {
  searchParams: Promise<{ type?: string; vendor?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const kind = ["accessory", "cigarette", "tobacco", "other"].includes(params.type || "") ? params.type! : "";
  const vendor = params.vendor || "";
  const mode = params.mode === "retail" || params.mode === "wholesale" ? params.mode : "all";
  let unavailable = false;
  let products: ProductPage = { items: [], total: 0, page: 1, page_size: 24, pages: 1, has_next: false };
  let catalog: Catalog = { categories: [], devices: [], checkout_enabled: false, brands: [], types: [], vendors: [], total: 0, updated_at: null };
  try {
    const query = new URLSearchParams({ type: kind, vendor, mode, pagination: "1", page_size: "24" });
    [products, catalog] = await Promise.all([
      serverApi<ProductPage>(`catalog/products/?${query}`),
      serverApi<Catalog>("catalog/"),
    ]);
  } catch { unavailable = true; }
  return <Storefront key={`${kind}:${vendor}:${mode}`} home={false} initialPage={products} initialVendor={vendor}
    initialType={kind} initialMode={mode} catalog={catalog} unavailable={unavailable} />;
}
