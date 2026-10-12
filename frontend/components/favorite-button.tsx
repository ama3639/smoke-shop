"use client";
import { useState } from "react";
import { Heart } from "lucide-react";
import { toggleFavorite, useFavorites } from "@/lib/wishlist";
export default function FavoriteButton({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const favorites = useFavorites();
  const [error, setError] = useState("");
  const selected = favorites.includes(slug);
  return (
    <>
      <button
        className="favorite-toggle"
        aria-label={`${selected ? "حذف از" : "افزودن به"} علاقه‌مندی‌ها: ${title}`}
        aria-pressed={selected}
        onClick={() => {
          setError(
            toggleFavorite(slug) ? "" : "ذخیره در مرورگر امکان‌پذیر نیست.",
          );
        }}
      >
        <Heart size={17} fill={selected ? "currentColor" : "none"} />
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
