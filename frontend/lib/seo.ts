import type { Metadata } from "next";

export function siteUrl(): URL | undefined {
  const raw = process.env.SITE_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new Error(
      "SITE_URL must be an HTTPS origin without credentials, path, query or fragment",
    );
  }
  return url;
}
export function pageMetadata(
  title: string,
  description: string,
  path: string,
  image?: string | null,
): Metadata {
  const base = siteUrl();
  const url = base ? new URL(path, base).href : undefined;
  const images =
    base && image?.startsWith("/") && !image.startsWith("//")
      ? [{ url: new URL(image, base).href, alt: title }]
      : undefined;
  return {
    title,
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      title,
      description,
      siteName: "اسموک‌شاپ",
      locale: "fa_IR",
      type: "website",
      ...(url ? { url } : {}),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      ...(images ? { images: images.map((i) => i.url) } : {}),
    },
  };
}
