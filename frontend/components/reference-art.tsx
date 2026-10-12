import type { CSSProperties } from "react";
const areas = {
  hero: [385, 44, 365, 268],
  cigarette: [632, 358, 115, 105],
  vape: [509, 358, 112, 105],
  pipe: [386, 358, 112, 105],
  hookah: [263, 358, 112, 105],
  tobacco: [141, 358, 110, 105],
  accessory: [18, 358, 110, 105],
} as const;
export type ReferenceArea = keyof typeof areas;
// CSS viewports of the owner's mockup are editorial illustrations, never SKU photos.
export default function ReferenceArt({
  area,
  className = "",
}: {
  area: ReferenceArea;
  className?: string;
}) {
  const [x, y, w, h] = areas[area];
  return (
    <div
      className={`reference-art ${className}`}
      aria-hidden="true"
      style={
        {
          "--art-ratio": `${w} / ${h}`,
          backgroundSize: `${(765 / w) * 100}% ${(960 / h) * 100}%`,
          backgroundPosition: `${(x / (765 - w)) * 100}% ${(y / (960 - h)) * 100}%`,
        } as CSSProperties
      }
    />
  );
}
