"use client";

export default function HomepageSmoke({ disabled, reduced }: { disabled: boolean; reduced: boolean }) {
  return (
    <div className="hero-atmosphere" aria-hidden="true" data-motion={disabled || reduced ? "paused" : "ambient"}>
      <svg viewBox="0 0 800 600" fill="none" preserveAspectRatio="xMidYMid slice">
        <path d="M-80 520C90 610 40 80 290 125S330 560 650 450 900 45 960 150" />
        <path d="M-110 545C110 580 65 55 310 100S365 590 675 425 890 80 940 140" />
        <path d="M-140 570C130 550 90 30 330 75S400 620 700 400 880 115 920 130" />
        <circle cx="430" cy="275" r="190" />
      </svg>
    </div>
  );
}
