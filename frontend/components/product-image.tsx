import { Product } from "@/lib/api";
import type { CSSProperties } from "react";
import { ProductArt } from "./product-art";
import { PackBox } from "./pack-3d";
import CigaretteStick from "./cigarette-stick";

// Top edge of each packet within the supplied full-frame photo; never crop the photo.
const packetTops = [
  0.077, 0.128, 0.113, 0.121, 0.091, 0.124, 0.116, 0.052, 0.1, 0.113, 0.093,
  0.098, 0.095, 0.118,
];

export default function ProductImage({ product }: { product: Product }) {
  if (product.image && product.product_type === "cigarette") {
    const number = product.image.match(/\/optimized\/(\d{2})\.webp$/)?.[1];
    const top = number ? (packetTops[Number(number) - 1] ?? 0.1) : 0.1;
    return (
      <div
        className="photographed-pack"
        style={{ "--photo-pack-top": top } as CSSProperties}
      >
        <div className="photo-stick-window" aria-hidden="true">
          <CigaretteStick />
        </div>
        <img
          className="product-pack-photo"
          src={product.image}
          alt={product.title}
          width="1122"
          height="1402"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }
  return product.image ? (
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
