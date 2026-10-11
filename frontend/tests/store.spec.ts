import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }, info) => {
  if (!info.title.includes("age gate")) {
    await context.addInitScript(() => sessionStorage.setItem("smokeshop-age-confirmed", "true"));
  }
});

test("all fourteen seller photos load as full-frame product images", async ({
  page,
}) => {
  await page.goto("/");
  const cards = page.locator(".product-card").filter({ has: page.locator(".product-pack-photo") });
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
  await expect(page.getByRole("heading", { level: 1 })).toContainText("کاتالوگ");
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
  await page.getByLabel("فیلتر برند", { exact: true }).selectOption("Winston");
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
  // Full-page screenshots must include images below the browser's lazy-load range.
  for (const photo of await page.locator(".product-pack-photo").all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  const copy = await page.locator(".cigarette-hero-copy").boundingBox();
  const controls = await page.locator(".scene-bottom").boundingBox();
  expect(copy).not.toBeNull();
  expect(controls).not.toBeNull();
  expect(copy!.y + copy!.height).toBeLessThan(controls!.y);
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("real smoke plays only inside the hero, pauses manually and when offscreen", async ({ page }) => {
  await page.goto("/");
  const smoke = page.locator(".hero-smoke");
  const video = smoke.locator("video");
  await expect(smoke).toHaveAttribute("data-motion", "ambient");
  await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).currentTime)).toBeGreaterThan(0.1);
  expect(await video.evaluate(el => (el as HTMLVideoElement).muted)).toBeTruthy();
  expect(await smoke.evaluate(el => getComputedStyle(el).pointerEvents)).toBe("none");
  expect(await smoke.evaluate(el => getComputedStyle(el).position)).toBe("absolute");
  expect(await page.locator(".cigarette-hero").evaluate(el => getComputedStyle(el).filter)).toBe("none");
  expect(await page.locator(".cigarette-hero-copy").evaluate(el => getComputedStyle(el).filter)).toBe("none");
  expect(await video.evaluate(el => getComputedStyle(el).filter)).not.toContain("blur");
  if (process.env.VISUAL_REVIEW_PATH) {
    await video.evaluate(el => new Promise<void>(resolve => {
      el.addEventListener("seeked", () => resolve(), {once: true});
      (el as HTMLVideoElement).currentTime = 12;
    }));
    await page.screenshot({path: `${process.env.VISUAL_REVIEW_PATH}/smoke-${test.info().project.name}.png`});
  }
  await page.getByRole("button", { name: "توقف حرکت" }).click();
  await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).paused)).toBeTruthy();
  await expect(smoke).toHaveAttribute("data-motion", "paused");
  await page.getByRole("button", { name: "حرکت متوقف است" }).click();
  await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).paused)).toBeFalsy();
  await page.locator(".catalog-heading").evaluate(el => el.scrollIntoView({block: "start"}));
  await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).paused)).toBeTruthy();
});

test("reduced motion keeps the hero static and does not load smoke media", async ({ page }) => {
  const films: string[] = [];
  page.on("request", r => { if (/homepage-smoke\.(mp4|webm)/.test(r.url())) films.push(r.url()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".hero-smoke")).toHaveAttribute("data-motion", "paused");
  await expect(page.getByRole("button", { name: "حرکت متوقف است" })).toBeDisabled();
  await expect(page.locator("video")).toHaveCount(0);
  expect(films).toEqual([]);
});

test("all product types, seller directory and seller selection work", async ({ page }) => {
  await page.goto("/catalog");
  await page.getByRole("button", { name: "اکسسوری", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("button", { name: "همه کالاها", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(15);
  await page.getByLabel("فیلتر فروشنده").selectOption("e2e-two");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.locator(".product-card").click();
  await expect(page.getByRole("heading", { name: "فروشندگان این کالا" })).toBeVisible();
  await page.getByLabel("انتخاب فروشنده").selectOption({ label: "فروشنده آزمون دو — ۱۳۵٬۰۰۰ تومان" });
  await page.getByRole("checkbox", { name: /۱۸ سال/ }).check();
  await page.getByRole("button", { name: "افزودن به سبد" }).click();
  await page.getByRole("link", { name: /مشاهده سبد/ }).click();
  await expect(page.getByText("فروشنده: فروشنده آزمون دو")).toBeVisible();
  await page.getByRole("button", { name: "ثبت درخواست سفارش" }).click();
  await page.getByRole("link", { name: "مشاهده وضعیت سفارش" }).click();
  await expect(page.getByText("فروشنده: فروشنده آزمون دو")).toBeVisible();
  await page.goto("/sellers");
  await expect(page.locator(".seller-directory .branch-card")).toHaveCount(2);
  await page.getByRole("link", { name: "مشاهده کالاهای فروشنده" }).last().click();
  await expect(page.locator(".product-card")).toHaveCount(1);
});

test("product photos stay intact on hover and open details with one click or tap", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const hero = page.locator(".scene-hero-image");
  await expect(hero).toBeVisible();
  await expect
    .poll(() => hero.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  expect(await hero.evaluate((el) => getComputedStyle(el).objectFit)).toBe(
    "contain",
  );
  const card = page.locator('a.product-card[href="/products/winston-silver"]');
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator(".product-pack-photo")).toHaveAttribute(
    "src",
    "/images/products/winston/optimized/12.webp",
  );
  if (!isMobile) await card.hover();
  await expect(
    page.locator(".pack-cigarette, .pack-lid, .photo-stick-window, .product-preview-note"),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/packet-${test.info().project.name}.png`,
  });
  if (isMobile) await card.tap();
  else await card.click();
  await expect(page).toHaveURL(/\/products\/winston-silver$/);
  await expect(page.locator(".pack-cigarette, .pack-lid")).toHaveCount(0);
});

test("keyboard focus keeps the packet closed and Enter opens details", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.locator('a.product-card[href="/products/winston-silver"]');
  await card.focus();
  await expect(card).toBeFocused();
  await expect(
    page.locator(".pack-cigarette, .pack-lid, .product-preview-note"),
  ).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/products\/winston-silver$/);
});

test("responsive hero and catalog stay readable at narrow, tablet and wide widths", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".product-card")).toHaveCount(14);
    await expect(page.getByRole("navigation", {name: "منوی اصلی"})).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const title = await page.locator("h1").boundingBox();
    const image = await page.locator(".scene-hero-image").boundingBox();
    expect(title).not.toBeNull(); expect(image).not.toBeNull();
    if (title && image) {
      expect(title.x).toBeGreaterThanOrEqual(0);
      expect(title.x + title.width).toBeLessThanOrEqual(width);
      if (width <= 740) expect(image.y).toBeGreaterThan(title.y + title.height);
      else expect(image.x + image.width).toBeLessThanOrEqual(title.x + 12);
    }
    if (process.env.VISUAL_REVIEW_PATH) {
      await page.screenshot({path: `${process.env.VISUAL_REVIEW_PATH}/home-${width}.png`});
      await page.locator(".catalog-heading").scrollIntoViewIfNeeded();
      await page.evaluate(async () => {
        await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>(".product-pack-photo")).map(img => img.decode().catch(() => {})));
      });
      await page.locator(".catalog-heading").evaluate(el => el.getAnimations({subtree: true}).forEach(a => a.finish()));
      await page.screenshot({path: `${process.env.VISUAL_REVIEW_PATH}/catalog-${width}.png`});
    }
  }
});


test("accessories move off the homepage and remain available in the full catalog", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a.product-card[href="/products/e2e-approved"]')).toHaveCount(0);
  await expect(page.locator(".product-card")).toHaveCount(14);
  await page.getByRole("link", { name: "اکسسوری و ملزومات" }).click();
  await expect(page).toHaveURL(/\/catalog\?type=accessory$/);
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator('a.product-card[href="/products/e2e-approved"]')).toBeVisible();
  await expect(page.locator(".cigarette-hero, .hero-smoke, video")).toHaveCount(0);
  if (process.env.VISUAL_REVIEW_PATH) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path: `${process.env.VISUAL_REVIEW_PATH}/accessories-${test.info().project.name}.png`});
  }
  await page.getByRole("button", {name: "همه کالاها", exact: true}).click();
  await expect(page.locator(".product-card")).toHaveCount(15);
  await page.getByLabel("جست‌وجوی کالا").fill("does-not-exist");
  await expect(page.locator(".product-card")).toHaveCount(0);
  await page.getByRole("button", {name: "پاک کردن فیلترها"}).click();
  await expect(page.locator(".product-card")).toHaveCount(15);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("category discovery uses real catalog routes and missing categories stay empty", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".discovery-card")).toHaveCount(4);
  await expect(page.getByRole("link", { name: "دسته سیگار", exact: true })).toHaveAttribute("href", "/catalog?type=cigarette");
  await expect(page.getByRole("link", { name: "دسته اکسسوری", exact: true })).toHaveAttribute("href", "/catalog?type=accessory");
  await page.getByRole("link", { name: "دسته ویپ و پاد", exact: true }).click();
  await expect(page).toHaveURL(/category=vape-pod/);
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "حذف فیلتر دسته" })).toContainText("ویپ و پاد");
  await expect(page.getByRole("heading", { name: "مدلی با این مشخصات پیدا نشد." })).toBeVisible();
  await page.getByRole("button", { name: "حذف فیلتر دسته" }).click();
  await expect(page.locator(".product-card")).toHaveCount(15);
  await page.goto("/catalog?category=pipe");
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "حذف فیلتر دسته" })).toContainText("پیپ");
});

test("global search and brand/category deep links preserve initial filters", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "جست‌وجوی همه کالاها" }).fill("كامپكت");
  await page.getByRole("button", { name: "اجرای جست‌وجو" }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await expect(page.getByRole("textbox", { name: "جست‌وجوی کالا" })).toHaveValue("كامپكت");
  await page.reload();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.goto("/catalog?type=cigarette&brand=Winston&category=xs");
  await expect(page.locator(".product-card")).toHaveCount(3);
  await expect(page.getByLabel("فیلتر برند", { exact: true })).toHaveValue("Winston");
  await page.getByRole("button", { name: "حذف فیلتر دسته" }).click();
  await expect(page.locator(".product-card")).toHaveCount(14);
  await page.getByRole("button", { name: "پاک کردن همه فیلترها" }).click();
  await expect(page.locator(".product-card")).toHaveCount(15);
  await expect(page.getByLabel("فیلتر برند", { exact: true })).toHaveValue("");
  await page.goto("/");
  await page.locator(".brand-index").getByRole("link", { name: "Winston", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(14);
  await expect(page.getByLabel("فیلتر برند", { exact: true })).toHaveValue("Winston");
});

test("premium navigation and filter controls fit at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("searchbox", { name: "جست‌وجوی همه کالاها" })).toBeVisible();
  await page.locator(".catalog-discovery").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.goto("/catalog?brand=Winston&category=xs");
  await expect(page.locator(".product-card")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("age gate requires an explicit adult choice and remembers this session", async ({ page }) => {
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "تأیید سن برای ورود" });
  await expect(gate).toBeVisible();
  await expect(page.getByRole("button", { name: "۱۸ سال یا بیشتر دارم", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(gate).toBeVisible();
  await page.getByRole("button", { name: "۱۸ سال یا بیشتر دارم", exact: true }).click();
  await expect(gate).toHaveCount(0);
  await page.getByRole("link", { name: "دسته سیگار", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("age gate denies underage entry and offers a neutral exit", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "زیر ۱۸ سال دارم", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("زیر ۱۸ سال");
  await expect(page.getByRole("button", { name: "۱۸ سال یا بیشتر دارم", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "خروج از سایت", exact: true }).click();
  await expect(page).toHaveURL("about:blank");
});
