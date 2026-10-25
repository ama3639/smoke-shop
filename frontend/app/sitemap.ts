import type { MetadataRoute } from "next";
import { Catalog, ProductPage, serverApi } from "@/lib/api";
import { siteUrl } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  if (!site) return [];
  const catalog = await serverApi<Catalog>("catalog/");
  const paths = [
    "/",
    "/catalog",
    "/brands",
    "/branches",
    "/sellers",
    "/guide",
    "/policy",
    ...catalog.brands.map((b) => `/brands/${encodeURIComponent(b)}`),
  ];
  const entries: MetadataRoute.Sitemap = paths.map((path) => ({
    url: new URL(path, site).href,
  }));
  let page = 1;
  let more = true;
  while (more) {
    const result = await serverApi<ProductPage>(
      `catalog/products/?pagination=1&page_size=100&page=${page}`,
    );
    entries.push(
      ...result.items.map((p) => ({
        url: new URL(`/products/${encodeURIComponent(p.slug)}`, site).href,
        lastModified: p.updated_at,
      })),
    );
    more = result.has_next;
    page += 1;
  }
  return entries;
}
