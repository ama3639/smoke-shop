import Image from "next/image";
import { Product } from "@/lib/api";
import { ProductArt } from "./product-art";
import { PackBox } from "./pack-3d";

export default function ProductImage({
  product,
  eager = false,
}: {
  product: Product;
  eager?: boolean;
}) {
  if (product.image && product.product_type === "cigarette") {
    return (
      <div className="photographed-pack">
        <Image
          className="product-pack-photo"
          src={product.image}
          alt={product.title}
          width={1122}
          height={1402}
          loading={eager ? "eager" : "lazy"}
          sizes="(max-width: 680px) 90vw, (max-width: 1000px) 45vw, 36vw"
          decoding="async"
        />
      </div>
    );
  }
  return product.image ? (
    <Image
      className="real-product-image"
      src={product.image}
      alt={product.title}
      loading={eager ? "eager" : "lazy"}
      sizes="(max-width: 680px) 90vw, (max-width: 1000px) 45vw, 36vw"
      width={640}
      height={500}
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
