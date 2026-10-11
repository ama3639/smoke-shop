import { Catalog, ProductPage, serverApi } from "./api";

export type SaleMode = "all" | "retail" | "wholesale";
export type CatalogParams = Record<string, string | string[] | undefined>;

function value(params: CatalogParams, key: string) {
  const raw = params[key];
  return (typeof raw === "string" ? raw : raw?.[0] || "").slice(0, 100);
}

export async function readCatalog(params: CatalogParams, home = false) {
  const requestedType = value(params, "type");
  const kind = home ? "cigarette" :
    ["accessory", "cigarette", "tobacco", "other"].includes(requestedType) ? requestedType : "";
  const requestedMode = value(params, "mode");
  const mode: SaleMode = requestedMode === "retail" || requestedMode === "wholesale" ? requestedMode : "all";
  const filters = {
    type: kind, vendor: value(params, "vendor"), mode,
    category: value(params, "category"), brand: value(params, "brand"), q: value(params, "q"),
  };
  let unavailable = false;
  let products: ProductPage = { items: [], total: 0, page: 1, page_size: 24, pages: 1, has_next: false };
  let catalog: Catalog = { categories: [], devices: [], checkout_enabled: false, brands: [], types: [], vendors: [], total: 0, updated_at: null };
  try {
    const query = new URLSearchParams({ ...filters, pagination: "1", page_size: "24" });
    [products, catalog] = await Promise.all([
      serverApi<ProductPage>(`catalog/products/?${query}`),
      serverApi<Catalog>(home ? "catalog/?type=cigarette" : "catalog/"),
    ]);
  } catch { unavailable = true; }
  return { products, catalog, filters, unavailable };
}
