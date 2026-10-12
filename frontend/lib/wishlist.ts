"use client";
import { useMemo, useSyncExternalStore } from "react";
import { safeSlugs, decodeFavorites } from "./wishlist-storage";
const key = "smokeshop-wishlist";
const event = "smokeshop-wishlist-change";
function snapshot() {
  try {
    return localStorage.getItem(key) || "[]";
  } catch {
    return "[]";
  }
}
function subscribe(listener: () => void) {
  window.addEventListener(event, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(event, listener);
    window.removeEventListener("storage", listener);
  };
}
export function useFavorites() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  return useMemo(() => decodeFavorites(raw), [raw]);
}
export function toggleFavorite(slug: string) {
  let current: string[];
  try {
    current = safeSlugs(JSON.parse(snapshot()));
  } catch {
    current = [];
  }
  const values = current.includes(slug)
    ? current.filter((v) => v !== slug)
    : safeSlugs([...current, slug]);
  try {
    localStorage.setItem(key, JSON.stringify(values));
    window.dispatchEvent(new Event(event));
    return true;
  } catch {
    return false;
  }
}
export const shoppingChanged = () =>
  window.dispatchEvent(new Event("smokeshop-shopping-change"));
