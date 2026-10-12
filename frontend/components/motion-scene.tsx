"use client";
import Link from "next/link";
import { ArrowDown, ArrowUpLeft, Pause, Play } from "lucide-react";
import HomepageSmoke from "./homepage-smoke";
import ReferenceArt from "./reference-art";
export default function MotionScene({
  paused,
  reduced,
  onPause,
}: {
  paused: boolean;
  reduced: boolean;
  onPause: () => void;
}) {
  return (
    <section
      className={`cigarette-hero ${paused || reduced ? "scene-static" : ""}`}
      aria-label="معرفی کاتالوگ اسموک‌شاپ"
    >
      <div className="hero-sticky">
        <HomepageSmoke disabled={paused || reduced} reduced={reduced} />
        <div className="container scene-layout">
          <div className="cigarette-hero-copy">
            <div className="scene-eyebrow">SMOKE SHOP / TITANIUM SILVER</div>
            <h1>مینیمال، دقیق، متفاوت</h1>
            <div className="scene-edition" dir="ltr">
              Smoke Shop Titanium Edition
            </div>
            <p>
              مدل‌ها و ملزومات را با تصاویر، مشخصات ثبت‌شده و اطلاعات عرضه مرور
              کنید.
            </p>
            <div className="scene-actions">
              <Link href="/catalog" className="button primary">
                مشاهده محصولات <ArrowUpLeft size={18} />
              </Link>
              <Link href="/brands" className="button secondary">
                برندهای کاتالوگ <ArrowUpLeft size={18} />
              </Link>
            </div>
          </div>
          <div
            className="scene-hero-visual"
            role="img"
            aria-label="ترکیب تصویری نمایشی تجهیزات مطابق ماکاپ تأییدشده"
          >
            <ReferenceArt area="hero" className="scene-hero-image" />
          </div>
        </div>
        <div className="container scene-bottom">
          <a href="#catalog" className="scroll-hint">
            <ArrowDown size={16} /> مرور کاتالوگ
          </a>
          <button
            className="motion-toggle"
            aria-pressed={paused || reduced}
            disabled={reduced}
            onClick={onPause}
          >
            {paused || reduced ? <Play size={14} /> : <Pause size={14} />}
            {paused || reduced ? "حرکت متوقف است" : "توقف حرکت"}
          </button>
        </div>
      </div>
    </section>
  );
}
