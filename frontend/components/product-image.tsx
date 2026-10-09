import { Product } from "@/lib/api";
import { ProductArt } from "./product-art";

export default function ProductImage({ product }: { product: Product }) {
  return product.image ? (
    <img
      className="real-product-image"
      src={product.image}
      alt={product.title}
      loading="lazy"
      width="640"
      height="500"
    />
  ) : (
    <ProductArt kind={product.illustration} />
  );
}
