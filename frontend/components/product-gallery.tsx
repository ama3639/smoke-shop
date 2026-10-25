"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";
import type { Product } from "@/lib/api";
import ProductImage from "./product-image";
import FavoriteButton from "./favorite-button";
export default function ProductGallery({ product }: { product: Product }) {
  const [opened, setOpened] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <div className="gallery-main" style={{ position: "relative" }}>
        <FavoriteButton slug={product.slug} title={product.title} />
        <ProductImage product={product} eager />
      </div>
      {product.image ? (
        <>
          <button
            className="gallery-button"
            onClick={() => {
              setOpened(true);
              dialog.current?.showModal();
            }}
            aria-label="بزرگ‌نمایی تصویر کالا"
          >
            <Image
              src={product.image}
              alt="بزرگ‌نمایی همان تصویر ثبت‌شده"
              sizes="80px"
              width={80}
              height={75}
            />
            <ZoomIn size={16} />
          </button>
          <dialog
            className="gallery-dialog"
            ref={dialog}
            aria-label={`تصویر ${product.title}`}
            onClose={() => setOpened(false)}
          >
            <button
              className="icon-button"
              aria-label="بستن تصویر"
              onClick={() => dialog.current?.close()}
              autoFocus
            >
              <X size={20} />
            </button>
            {opened && (
              <Image
                width={1122}
                height={1402}
                sizes="90vw"
                className="gallery-full"
                src={product.image}
                alt={product.title}
              />
            )}
          </dialog>
        </>
      ) : (
        <span>تصویر واقعی این کالا هنوز ثبت نشده است.</span>
      )}
    </>
  );
}
