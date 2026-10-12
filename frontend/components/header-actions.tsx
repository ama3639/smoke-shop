"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Heart, ShoppingBag, UserRound } from "lucide-react";
import { api, Cart, number } from "@/lib/api";
import { useFavorites } from "@/lib/wishlist";
export default function HeaderActions() {
  const path = usePathname();
  const favorites = useFavorites();
  const [count, setCount] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const update = () => {
      void api<Cart>("cart/", { signal: controller.signal })
        .then((c) => setCount(c.items.reduce((sum, i) => sum + i.quantity, 0)))
        .catch(() => {});
      void api<{ authenticated: boolean }>("account/", {
        signal: controller.signal,
      })
        .then((a) => setLoggedIn(a.authenticated))
        .catch(() => {});
    };
    update();
    window.addEventListener("smokeshop-shopping-change", update);
    return () => {
      controller.abort();
      window.removeEventListener("smokeshop-shopping-change", update);
    };
  }, [path]);
  return (
    <div className="header-actions">
      <Link href={loggedIn ? "/account" : "/login"} aria-label="حساب کاربری">
        <UserRound size={21} />
      </Link>
      <Link href="/wishlist" aria-label="علاقه‌مندی‌ها">
        <Heart size={21} />
        {favorites.length > 0 && (
          <span className="count">{number(favorites.length)}</span>
        )}
      </Link>
      <Link href="/cart" className="cart-link" aria-label="سبد اقلام مجاز">
        <ShoppingBag size={21} />
        {count > 0 && <span className="count">{number(count)}</span>}
      </Link>
    </div>
  );
}
