"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpLeft, Pause, Play } from "lucide-react";
import { PackBox } from "./pack-3d";
import SmokePlume from "./smoke-plume";

export default function MotionScene({
  onMode,
}: {
  onMode: (mode: "retail" | "wholesale") => void;
}) {
  const scene = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
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
      aria-label="معرفی کاتالوگ سیگار وینستون"
    >
      <div className="hero-sticky">
        <div className="scene-bg-word" aria-hidden="true" dir="ltr">
          Winston
        </div>
        <div className="scene-grain" aria-hidden="true" />
        <SmokePlume />
        <div className="container scene-layout">
          <div className="cigarette-hero-copy">
            <div className="scene-eyebrow">
              <span /> اسموک‌شاپ / کاتالوگ وینستون
            </div>
            <h1>
              سیگار.
              <br />
              <span>از بسته</span> <br />
              تا کارتن.
            </h1>
            <p>
              کاتالوگ وینستون برای مراجعه تکی و همکاری با فروشگاه‌ها و مراکز
              پخش.
            </p>
            <div className="scene-actions">
              <a
                href="#catalog"
                className="button light-button"
                onClick={() => onMode("retail")}
              >
                کاتالوگ تکی <ArrowUpLeft size={18} />
              </a>
              <a
                href="#wholesale"
                className="scene-link"
                onClick={() => onMode("wholesale")}
              >
                همکاری عمده <ArrowUpLeft size={18} />
              </a>
            </div>
            <div className="scene-brand-note">
              <span dir="ltr">WINSTON</span>
              <span>
                نخستین برند کاتالوگ
                <br />
                برندهای دیگر، در ادامه
              </span>
            </div>
          </div>
          <div className="display-stage" aria-hidden="true">
            <div className="scene-orbit orbit-one" />
            <div className="scene-orbit orbit-two" />
            <div className="scene-pack scene-pack-back">
              <PackBox tone="silver" variant="SILVER" />
            </div>
            <div className="scene-pack scene-pack-blue">
              <PackBox tone="blue" variant="BLUE" />
            </div>
            <div className="scene-pack scene-pack-main">
              <PackBox tone="red" variant="RED" />
            </div>
            <div className="scene-carton">
              <PackBox tone="blue" format="carton" variant="BLUE" />
            </div>
            <span className="stage-annotation annotation-pack">01 / PACK</span>
            <span className="stage-annotation annotation-carton">
              02 / CARTON
            </span>
            <div className="stage-platform" />
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
            onClick={() => setPaused((v) => !v)}
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
