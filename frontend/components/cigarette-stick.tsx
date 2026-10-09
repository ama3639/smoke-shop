import type { CSSProperties } from "react";

/** Sixteen modeled faces and circular ends; unlit, decorative product preview. */
export default function CigaretteStick() {
  return (
    <div className="pack-cigarette" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <span
          className="cigarette-facet"
          key={i}
          style={
            {
              "--facet-angle": `${i * 22.5}deg`,
              "--facet-shade": 0.76 + Math.cos((i * Math.PI) / 8) * 0.18,
            } as CSSProperties
          }
        >
          <i />
        </span>
      ))}
      <span className="cigarette-filter-end" />
      <span className="cigarette-tobacco-end" />
    </div>
  );
}
