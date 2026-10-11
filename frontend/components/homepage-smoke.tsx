"use client";

import { useEffect, useRef, useState } from "react";

export default function HomepageSmoke({ disabled, reduced }: { disabled: boolean; reduced: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const film = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = film.current;
    const element = container.current;
    if (!video || !element || reduced) return;
    let visible = false;
    video.playbackRate = 0.65;
    const update = () => {
      if (visible && !disabled && !document.hidden) {
        void video.play().catch(() => setPlaying(false));
      } else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.05;
      update();
    }, { threshold: 0.05 });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      video.pause();
    };
  }, [disabled, reduced]);

  return <div ref={container} className="hero-smoke" aria-hidden="true"
    data-motion={disabled || reduced || !playing ? "paused" : "ambient"}>
    {!reduced && <video ref={film} muted loop playsInline preload="none"
      onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}>
      <source src="/videos/homepage-smoke.webm" type="video/webm" />
      <source src="/videos/homepage-smoke.mp4" type="video/mp4" />
    </video>}
  </div>;
}
