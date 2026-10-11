import type { CSSProperties } from "react";

export type PackTone = "red" | "blue" | "silver";

export function PackBox({
  tone = "red",
  format = "pack",
  brand = "Winston",
  variant = "RED",
  decorative = true,
  frontImage,
}: {
  tone?: PackTone;
  format?: "pack" | "carton";
  brand?: string;
  variant?: string;
  decorative?: boolean;
  frontImage?: string;
}) {
  const colors = { red: "#884334", blue: "#324e69", silver: "#777d79" };
  return (
    <div
      className={`pack-box ${format === "carton" ? "carton-box" : ""} ${frontImage ? "photo-pack" : ""}`}
      style={{ "--pack-color": colors[tone] } as CSSProperties}
      aria-hidden={decorative}
    >
      <div className="pack-face pack-front">
        {frontImage ? (
          <img
            className="pack-front-photo"
            src={frontImage}
            alt=""
            draggable={false}
          />
        ) : (
          <>
            <div className="pack-seal">
              <span>
                {format === "carton" ? "CARTON" : "CIGARETTE CATALOG"}
              </span>
              <span>18+</span>
            </div>
            <div className="pack-mark">
              <span className="pack-rule" />
              <strong>{brand}</strong>
              <span className="pack-variant">{variant}</span>
              <span className="pack-rule" />
            </div>
            <div className="pack-lower">
              <span>SMOKESHOP</span>
              <span>تصویر نمایشی</span>
            </div>
            <div className="pack-warning">
              مصرف دخانیات
              <br />
              به سلامت آسیب می‌رساند.
            </div>
          </>
        )}
      </div>
      <div className="pack-face pack-back">
        <strong>{brand}</strong>
        <span>اطلاعات محصول</span>
        <div className="pack-barcode" />
        <small>بسته‌بندی نمایشی کاتالوگ</small>
      </div>
      <div className="pack-face pack-left">
        <span>{brand}</span>
      </div>
      <div className="pack-face pack-right">
        <span>{variant} / SMOKESHOP</span>
      </div>
      <div className="pack-face pack-top">
        <span>{brand}</span>
      </div>
      <div className="pack-face pack-bottom" />
    </div>
  );
}
