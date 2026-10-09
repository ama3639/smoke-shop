"use client";

import { useEffect, useRef } from "react";

export default function HomepageSmoke({
  disabled,
  reduced,
}: {
  disabled: boolean;
  reduced: boolean;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = layer.current;
    const media = video.current;
    if (
      !element ||
      !media ||
      disabled ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let frame = 0;
    let target = 0;
    const seek = () => {
      if (
        !media.seeking &&
        Number.isFinite(media.duration) &&
        Math.abs(media.currentTime - target) > 0.08
      )
        media.currentTime = target;
    };
    const draw = () => {
      frame = 0;
      const distance = Math.max(
        1,
        document.documentElement.scrollHeight - innerHeight,
      );
      const progress = Math.min(1, Math.max(0, scrollY / distance));
      element.style.setProperty("--page-progress", String(progress));
      if (Number.isFinite(media.duration))
        target = progress * Math.max(0, media.duration - 0.15);
      seek();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    media.addEventListener("loadedmetadata", draw);
    media.addEventListener("seeked", seek);
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    draw();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      media.removeEventListener("loadedmetadata", draw);
      media.removeEventListener("seeked", seek);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
    };
  }, [disabled, reduced]);
  return (
    <div
      ref={layer}
      className="homepage-smoke"
      aria-hidden="true"
      data-motion={disabled ? "paused" : "scroll"}
    >
      {reduced ? (
        <img src="/images/homepage-smoke-poster.webp" alt="" />
      ) : (
        <video
          ref={video}
          poster="/images/homepage-smoke-poster.webp"
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
        >
          <source src="/videos/homepage-smoke.webm" type="video/webm" />
          <source src="/videos/homepage-smoke.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}
