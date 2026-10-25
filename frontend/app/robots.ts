import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  const site = siteUrl();
  return site
    ? {
        rules: {
          userAgent: "*",
          allow: "/",
          disallow: ["/api/", "/admin/", "/manage"],
        },
        sitemap: new URL("/sitemap.xml", site).href,
      }
    : { rules: { userAgent: "*", disallow: "/" } };
}
