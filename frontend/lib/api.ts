export type Compatibility = {
  model: string;
  confidence: string;
  source: string;
  verified: string;
  incompatible: boolean;
};
export type Product = {
  id: number;
  title: string;
  slug: string;
  sku: string;
  category: string;
  category_title: string;
  description: string;
  material: string;
  dimensions: string;
  illustration: string;
  image: string | null;
  price: number | null;
  stock: number;
  legal_status: string;
  purchasable: boolean;
  compatibility: Compatibility[];
  updated_at: string;
  product_type: "accessory" | "cigarette";
  brand: string;
  sticks_per_pack: number | null;
  packs_per_carton: number | null;
  retail_available: boolean;
  wholesale_available: boolean;
};
export type Catalog = {
  categories: { title: string; slug: string }[];
  devices: { title: string; slug: string }[];
  checkout_enabled: boolean;
};
export type Cart = {
  items: { product: Product; quantity: number }[];
  total: number;
  checkout_enabled: boolean;
  latest_order_id: string | null;
};
export const number = (value: number) =>
  new Intl.NumberFormat("fa-IR").format(value);
export const money = (value: number) => `${number(value)} تومان`;

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch {
    throw new Error("ارتباط با فروشگاه برقرار نشد. دوباره تلاش کنید.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("ارتباط با فروشگاه برقرار نشد. دوباره تلاش کنید.");
  }
  if (!response.ok || !result.success)
    throw new Error(
      result.error?.message || "درخواست انجام نشد. دوباره تلاش کنید.",
    );
  return result.data;
}

export async function mutate<T>(
  path: string,
  data: unknown,
  method = "POST",
): Promise<T> {
  const session = await api<{ csrf_token: string }>("session/");
  return api<T>(path, {
    method,
    headers: { "X-CSRFToken": session.csrf_token },
    body: JSON.stringify(data),
  });
}

export async function serverApi<T>(path: string): Promise<T> {
  const response = await fetch(
    `${process.env.BACKEND_URL || "http://127.0.0.1:8000"}/api/v1/${path}`,
    { cache: "no-store", signal: AbortSignal.timeout(5000) },
  );
  if (!response.ok) throw new Error(`API ${response.status}`);
  return (await response.json()).data;
}
