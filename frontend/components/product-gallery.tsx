"use client";
import { useRef } from "react";
import { X, ZoomIn } from "lucide-react";
import type { Product } from "@/lib/api";
import ProductImage from "./product-image";
import FavoriteButton from "./favorite-button";
export default function ProductGallery({ product }: { product: Product }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <div className="gallery-main" style={{ position: "relative" }}>
        <FavoriteButton slug={product.slug} title={product.title} />
        <ProductImage product={product} />
      </div>
      {product.image ? (
        <>
          <button
            className="gallery-button"
            onClick={() => dialog.current?.showModal()}
            aria-label="بزرگ‌نمایی تصویر کالا"
          >
            <img
              src={product.image}
              alt="نمای ثبت‌شده کالا"
              width={80}
              height={75}
            />
            <ZoomIn size={16} />
          </button>
          <dialog
            className="gallery-dialog"
            ref={dialog}
            aria-label={`تصویر ${product.title}`}
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                event.preventDefault();
                dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
              }
            }}
          >
            <button
              className="icon-button"
              aria-label="بستن تصویر"
              onClick={() => dialog.current?.close()}
              autoFocus
            >
              <X size={20} />
            </button>
            <img
              className="gallery-full"
              src={product.image}
              alt={product.title}
            />
          </dialog>
        </>
      ) : (
        <span>تصویر واقعی این کالا هنوز ثبت نشده است.</span>
      )}
    </>
  );
}
