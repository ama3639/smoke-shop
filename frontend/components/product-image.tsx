import { Product } from "@/lib/api";
import { ProductArt } from "./product-art";
import { PackBox } from "./pack-3d";

export default function ProductImage({ product }: { product: Product }) {
  return product.image && product.product_type !== "cigarette" ? (
    <img
      className="real-product-image"
      src={product.image}
      alt={product.title}
      loading="lazy"
      width="640"
      height="500"
    />
  ) : product.product_type === "cigarette" ? (
    <div className="catalog-pack-art" aria-hidden="true">
      <PackBox
        frontImage={
          product.image ||
          (product.slug === "winston-silver"
            ? "/images/winston-silver-reference.webp"
            : undefined)
        }
        brand={product.brand || "CATALOG"}
        format={product.illustration === "carton" ? "carton" : "pack"}
        tone={
          product.title.includes("سیلور")
            ? "silver"
            : product.title.includes("آبی")
              ? "blue"
              : "red"
        }
        variant={
          product.title.includes("سیلور")
            ? "SILVER"
            : product.title.includes("آبی")
              ? "BLUE"
              : "RED"
        }
      />
    </div>
  ) : (
    <ProductArt kind={product.illustration} />
  );
}
