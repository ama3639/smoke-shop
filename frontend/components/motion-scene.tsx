"use client";

import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUpLeft, Pause, Play } from "lucide-react";
import HomepageSmoke from "./homepage-smoke";

export default function MotionScene({
  onMode,
  heroImage,
  paused,
  reduced,
  onPause,
}: {
  heroImage: string;
  onMode: (mode: "retail" | "wholesale") => void;
  paused: boolean;
  reduced: boolean;
  onPause: () => void;
}) {
  const scene = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    if (paused || reduced) {
      element.style.setProperty("--scene-progress", "0");
      return;
    }
    let frame = 0;
    const draw = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const distance = Math.max(1, rect.height - innerHeight + 90);
      element.style.setProperty(
        "--scene-progress",
        String(Math.min(1, Math.max(0, -rect.top / distance))),
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    draw();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => {
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [paused, reduced]);

  return (
    <section
      ref={scene}
      className={`cigarette-hero ${paused || reduced ? "scene-static" : ""}`}
      aria-label="معرفی کاتالوگ اسموک‌شاپ"
    >
      <div className="hero-sticky">
        <HomepageSmoke disabled={paused || reduced} reduced={reduced} />
        <div className="scene-hero-visual">
          <img
            className="scene-hero-image"
            src={heroImage}
            alt="بسته‌بندی وینستون"
            width="1254"
            height="1254"
            fetchPriority="high"
            decoding="async"
            draggable={false}
          />
          <span className="scene-collection-label" dir="ltr">WINSTON / COLLECTION</span>
        </div>
        <div className="container scene-layout">
          <div className="cigarette-hero-copy">
            <div className="scene-eyebrow">
              <span /> اسموک‌شاپ / کاتالوگ چندفروشنده
            </div>
            <h1>
              کاتالوگ اسموک‌شاپ.
              <br />
              <span>مدل‌ها، از نزدیک.</span>
            </h1>
            <p>
              نمایش کامل بسته‌بندی، مشخصات ثبت‌شده و مسیر مراجعه. سیگار، قلیان، تنباکو و ملزومات در دسته‌های مستقل.
            </p>
            <div className="scene-actions">
              <a
                href="#catalog"
                className="button light-button"
                onClick={() => onMode("retail")}
              >
                مرور مدل‌های سیگار <ArrowUpLeft size={18} />
              </a>
              <a
                href="/catalog"
                className="scene-link"
              >
                همه دسته‌ها <ArrowUpLeft size={18} />
              </a>
            </div>
            <div className="scene-brand-note">
              <span dir="ltr">WINSTON</span>
              <span>
                نخستین برند کاتالوگ
                <br />
              همه برندها در کاتالوگ
              </span>
            </div>
          </div>
        </div>
        <div className="container scene-bottom">
          <a href="#catalog" className="scroll-hint">
            <ArrowDown size={17} />
            <span>کاتالوگ را با اسکرول مرور کنید</span>
          </a>
          <div className="scene-progress" aria-hidden="true">
            <span>01</span>
            <i>
              <b />
            </i>
            <span>02</span>
          </div>
          <button
            className="motion-toggle"
            aria-pressed={paused || reduced}
            onClick={onPause}
            disabled={reduced}
          >
            {paused || reduced ? <Play size={14} /> : <Pause size={14} />}
            <span>{paused || reduced ? "حرکت متوقف است" : "توقف حرکت"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

