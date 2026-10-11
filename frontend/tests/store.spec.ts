import { test, expect } from "@playwright/test";

test("all fourteen seller photos load as full-frame product images", async ({
  page,
}) => {
  await page.goto("/");
  const cards = page.locator(".product-card");
  await expect(cards).toHaveCount(14);
  await expect(cards.locator(".catalog-pack-art")).toHaveCount(0);
  const urls = new Set<string>();
  for (const card of await cards.all()) {
    const photo = card.locator(".product-pack-photo");
    await photo.scrollIntoViewIfNeeded();
    await expect
      .poll(() => photo.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(1122);
    expect(
      await photo.evaluate((el) => (el as HTMLImageElement).naturalHeight),
    ).toBe(1402);
    expect(await photo.evaluate((el) => getComputedStyle(el).objectFit)).toBe(
      "contain",
    );
    await expect(photo).toHaveAttribute(
      "alt",
      (await card.locator("h3").innerText()).trim(),
    );
    urls.add((await photo.getAttribute("src"))!);
  }
  expect(urls.size).toBe(14);
  await expect(
    page.locator('a.product-card[href="/products/winston-xs-black"] h3'),
  ).toHaveText("وینستون XS مشکی");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("RTL, local font, catalog and normalized search", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("سیگار");
  await expect(page.locator(".product-card")).toHaveCount(14);
  await page.getByRole("textbox", { name: "جست‌وجوی کالا" }).fill("كامپكت");
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.fonts.check("14px Vazirmatn")),
  ).toBeTruthy();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("category, brand and retail/wholesale filters show relevant models", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "XS", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(3);
  await page.getByRole("button", { name: "همه نوع‌ها", exact: true }).click();
  await page.getByRole("button", { name: "عمده / باکس", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(13);
  await page.getByRole("button", { name: "تکی / بسته", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(13);
  await page.getByLabel("فیلتر برند").selectOption("Winston");
  await expect(page.locator(".product-card")).toHaveCount(13);
});

test("catalog-only product cannot be purchased and missing product returns 404", async ({
  page,
}) => {
  await page.goto("/products/winston-red");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "وینستون قرمز",
  );
  await expect(page.getByRole("button", { name: "افزودن به سبد" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: /اطلاعات شعب حضوری/ }),
  ).toBeVisible();
  await page.goto("/products/not-a-product");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "پیدا نشد",
  );
});

test("approved fixture flows through age consent, cart, order reservation and tracking", async ({
  page,
}) => {
  await page.goto("/products/e2e-approved");
  const add = page.getByRole("button", { name: "افزودن به سبد" });
  await expect(add).toBeDisabled();
  await page.getByRole("checkbox", { name: /۱۸ سال/ }).check();
  await add.click();
  await expect(page.getByRole("status")).toContainText("اضافه شد");
  await page.getByRole("link", { name: /مشاهده سبد/ }).click();
  await expect(page.locator(".cart-row")).toHaveCount(1);
  await page.getByRole("button", { name: "ثبت درخواست سفارش" }).click();
  await expect(page.getByRole("status")).toContainText(
    "آخرین درخواست سفارش شما",
  );
  await page.reload();
  await expect(
    page.getByRole("link", { name: "مشاهده وضعیت سفارش" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "مشاهده وضعیت سفارش" }).click();
  await expect(
    page.getByText("در انتظار بررسی اپراتور؛ پرداختی انجام نشده است."),
  ).toBeVisible();
  await expect(page.getByText("کیف آزمون خرید", { exact: true })).toBeVisible();
});

test("empty cart and branches are honest and keyboard navigation works", async ({
  page,
}) => {
  await page.goto("/cart");
  await expect(
    page.getByRole("heading", { name: "هنوز انتخابی در سبد ندارید." }),
  ).toBeVisible();
  await page.goto("/branches");
  await expect(
    page.getByText(
      "هنوز نشانی و ساعت فعالیت تأییدشده‌ای برای شعب ثبت نشده است.",
    ),
  ).toBeVisible();
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "رفتن به محتوای اصلی" }),
  ).toBeFocused();
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("smoke follows scroll across the whole page and freezes when paused", async ({
  page,
}) => {
  await page.goto("/");
  const layer = page.locator(".homepage-smoke");
  const video = layer.locator("video");
  const pack = page.locator(".scene-pack-main");
  await expect(layer).toHaveAttribute("aria-hidden", "true");
  expect(await layer.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe(
    "none",
  );
  expect(await layer.evaluate((el) => getComputedStyle(el).position)).toBe(
    "fixed",
  );
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).duration))
    .toBeGreaterThan(30);
  const initialPack = await pack.evaluate(
    (el) => getComputedStyle(el).transform,
  );
  await page.evaluate(() => scrollTo(0, Math.round(innerHeight * 0.65)));
  await expect
    .poll(() => pack.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe(initialPack);
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBeGreaterThan(1);
  await page.locator(".trade-details").scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBeGreaterThan(20);
  expect(await layer.evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).readyState))
    .toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "توقف حرکت" }).click();
  await expect(layer).toHaveAttribute("data-motion", "paused");
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).seeking))
    .toBe(false);
  const pausedTime = await video.evaluate(
    (el) => (el as HTMLVideoElement).currentTime,
  );
  await page.locator(".trade-details").scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBe(pausedTime);
  await expect(page.locator(".cigarette-hero")).toHaveClass(/scene-static/);
  await page.getByRole("button", { name: "حرکت متوقف است" }).click();
  await expect(layer).toHaveAttribute("data-motion", "scroll");
  await page.locator(".trade-details").scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBeGreaterThan(20);
});

test("reduced motion uses a static smoke poster without downloading the film", async ({
  page,
}) => {
  const filmRequests: string[] = [];
  page.on("request", (request) => {
    if (/homepage-smoke\.(mp4|webm)/.test(request.url()))
      filmRequests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".cigarette-hero")).toHaveClass(/scene-static/);
  await expect(page.locator(".homepage-smoke video")).toHaveCount(0);
  await expect(page.locator(".homepage-smoke img")).toBeVisible();
  expect(filmRequests).toEqual([]);
  await expect(
    page.getByRole("button", { name: "حرکت متوقف است" }),
  ).toBeDisabled();
  await page.evaluate(() => scrollTo(0, 400));
  expect(
    await page
      .locator(".cigarette-hero")
      .evaluate((el) =>
        Number(getComputedStyle(el).getPropertyValue("--scene-progress")),
      ),
  ).toBe(0);
  expect(
    await page
      .locator(".homepage-smoke img")
      .evaluate((el) => getComputedStyle(el).transform),
  ).not.toBe("none");
});

test("packet reveals a three-dimensional stick on hover or first touch", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const card = page.locator('a.product-card[href="/products/winston-silver"]');
  const stick = card.locator(".pack-cigarette");
  await card.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      card
        .locator(".product-pack-photo")
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(1000);
  await expect(stick.locator(".cigarette-facet")).toHaveCount(16);
  await expect(card.locator(".product-pack-photo")).toHaveAttribute(
    "src",
    "/images/products/winston/optimized/12.webp",
  );
  const before = await stick.evaluate((el) => getComputedStyle(el).transform);
  if (isMobile) {
    await card.tap();
    await expect(page).toHaveURL(/\/$/);
    await expect(card.getByRole("status")).toContainText("دوباره لمس کنید");
  } else {
    await card.hover();
  }
  await expect
    .poll(() => stick.evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBe(1);
  await expect
    .poll(() => stick.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe(before);
  expect(
    await stick.evaluate((el) => getComputedStyle(el).transform),
  ).toContain("matrix3d");
  await page.screenshot({
    path: `test-results/packet-preview-${test.info().project.name}.png`,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  if (isMobile) await card.tap();
  else await card.click();
  await expect(page).toHaveURL(/\/products\/winston-silver$/);
});

test("keyboard selection reveals the packet and Enter opens details immediately", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.locator('a.product-card[href="/products/winston-silver"]');
  await card.focus();
  await expect(card).toBeFocused();
  await expect
    .poll(() =>
      card
        .locator(".pack-cigarette")
        .evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBe(1);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/products\/winston-silver$/);
});
