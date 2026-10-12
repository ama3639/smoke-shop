import test from "node:test";
import assert from "node:assert/strict";
import { safeSlugs, decodeFavorites } from "../lib/wishlist-storage.ts";
test("corrupt or unsupported stored state does not enter the product API", () => {
  for (const input of ["{broken", "null", "{}", '"hello"'])
    assert.deepEqual(decodeFavorites(input), []);
});
test("stored selections reject paths, objects and oversized identifiers", () => {
  assert.deepEqual(
    safeSlugs([
      "winston-red",
      "../admin",
      "https://example.com",
      {},
      3,
      "x".repeat(101),
      "winston-red",
    ]),
    ["winston-red"],
  );
});
test("large stored lists are bounded and deduplicated without discarding valid ordering", () => {
  const slugs = Array.from({ length: 130 }, (_, i) => `item-${i}`);
  assert.equal(safeSlugs(slugs).length, 100);
  assert.equal(safeSlugs(slugs)[99], "item-99");
  assert.deepEqual(decodeFavorites('["one","one","two"]'), ["one", "two"]);
});
