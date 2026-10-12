import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }, info) => {
  if (!info.title.includes("age gate")) {
    await context.addInitScript(() =>
      sessionStorage.setItem("smokeshop-age-confirmed", "true"),
    );
  }
});

test("all fourteen seller photos load as full-frame product images", async ({
  page,
}) => {
  await page.goto("/catalog?type=cigarette");
  const cards = page
    .locator(".product-card")
    .filter({ has: page.locator(".product-pack-photo") });
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
  await page.goto("/catalog?type=cigarette");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("انتخاب‌ها");
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
  await page.goto("/catalog?type=cigarette");
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
    await expect
      .poll(() => photo.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
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

test("real smoke plays only inside the hero, pauses manually and when offscreen", async ({
  page,
}) => {
  await page.goto("/");
  const smoke = page.locator(".hero-smoke");
  const video = smoke.locator("video");
  await expect(smoke).toHaveAttribute("data-motion", "ambient");
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.1);
  expect(
    await video.evaluate((el) => (el as HTMLVideoElement).muted),
  ).toBeTruthy();
  expect(await smoke.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe(
    "none",
  );
  expect(await smoke.evaluate((el) => getComputedStyle(el).position)).toBe(
    "absolute",
  );
  expect(
    await page
      .locator(".cigarette-hero")
      .evaluate((el) => getComputedStyle(el).filter),
  ).toBe("none");
  expect(
    await page
      .locator(".cigarette-hero-copy")
      .evaluate((el) => getComputedStyle(el).filter),
  ).toBe("none");
  expect(
    await video.evaluate((el) => getComputedStyle(el).filter),
  ).not.toContain("blur");
  if (process.env.VISUAL_REVIEW_PATH) {
    await video.evaluate(
      (el) =>
        new Promise<void>((resolve) => {
          el.addEventListener("seeked", () => resolve(), { once: true });
          (el as HTMLVideoElement).currentTime = 12;
        }),
    );
    await page.screenshot({
      path: `${process.env.VISUAL_REVIEW_PATH}/smoke-${test.info().project.name}.png`,
    });
  }
  await page.getByRole("button", { name: "توقف حرکت" }).click();
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).paused))
    .toBeTruthy();
  await expect(smoke).toHaveAttribute("data-motion", "paused");
  await page.getByRole("button", { name: "حرکت متوقف است" }).click();
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).paused))
    .toBeFalsy();
  await page
    .locator("#featured-heading")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).paused))
    .toBeTruthy();
});

test("reduced motion keeps the hero static and does not load smoke media", async ({
  page,
}) => {
  const films: string[] = [];
  page.on("request", (r) => {
    if (/homepage-smoke\.(mp4|webm)/.test(r.url())) films.push(r.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".hero-smoke")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await expect(
    page.getByRole("button", { name: "حرکت متوقف است" }),
  ).toBeDisabled();
  await expect(page.locator("video")).toHaveCount(0);
  expect(films).toEqual([]);
});

test("all product types, seller directory and seller selection work", async ({
  page,
}) => {
  await page.goto("/catalog");
  await page.getByRole("button", { name: "اکسسوری", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("button", { name: "همه کالاها", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(18);
  await page.getByLabel("فیلتر فروشنده").selectOption("e2e-two");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.locator(".product-card").click();
  await expect(
    page.getByRole("heading", { name: "فروشندگان این کالا" }),
  ).toBeVisible();
  await page
    .getByLabel("انتخاب فروشنده")
    .selectOption({ label: "فروشنده آزمون دو — ۱۳۵٬۰۰۰ تومان" });
  await page.getByRole("checkbox", { name: /۱۸ سال/ }).check();
  await page.getByRole("button", { name: "افزودن به سبد" }).click();
  await page.getByRole("link", { name: /مشاهده سبد/ }).click();
  await expect(page.getByText("فروشنده: فروشنده آزمون دو")).toBeVisible();
  await page.getByRole("button", { name: "ثبت درخواست سفارش" }).click();
  await page.getByRole("link", { name: "مشاهده وضعیت سفارش" }).click();
  await expect(page.getByText("فروشنده: فروشنده آزمون دو")).toBeVisible();
  await page.goto("/sellers");
  await expect(page.locator(".seller-directory .branch-card")).toHaveCount(2);
  await page
    .getByRole("link", { name: "مشاهده کالاهای فروشنده" })
    .last()
    .click();
  await expect(page.locator(".product-card")).toHaveCount(1);
});

test("product photos stay intact on hover and open details with one click or tap", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const hero = page.locator(".scene-hero-image");
  await expect(hero).toBeVisible();
  expect(
    await hero.evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toContain("titanium-reference.png");
  await page.goto("/catalog?type=cigarette");
  const card = page.locator('a.product-card[href="/products/winston-silver"]');
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator(".product-pack-photo")).toHaveAttribute(
    "src",
    "/images/products/winston/optimized/12.webp",
  );
  if (!isMobile) await card.hover();
  await expect(
    page.locator(
      ".pack-cigarette, .pack-lid, .photo-stick-window, .product-preview-note",
    ),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
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
  await page.goto("/catalog?type=cigarette");
  const card = page.locator('a.product-card[href="/products/winston-silver"]');
  await card.focus();
  await expect(card).toBeFocused();
  await expect(
    page.locator(".pack-cigarette, .pack-lid, .product-preview-note"),
  ).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/products\/winston-silver$/);
});

test("responsive hero and catalog stay readable at narrow, tablet and wide widths", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".product-card")).toHaveCount(6);
    await expect(
      page.getByRole("navigation", { name: "منوی اصلی" }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const title = await page.locator("h1").boundingBox();
    const image = await page.locator(".scene-hero-image").boundingBox();
    expect(title).not.toBeNull();
    expect(image).not.toBeNull();
    if (title && image) {
      expect(title.x).toBeGreaterThanOrEqual(0);
      expect(title.x + title.width).toBeLessThanOrEqual(width);
      if (width <= 740) expect(image.y).toBeGreaterThan(title.y + title.height);
      else expect(image.x).toBeGreaterThanOrEqual(title.x + title.width - 12);
    }
    if (process.env.VISUAL_REVIEW_PATH) {
      await page.screenshot({
        path: `${process.env.VISUAL_REVIEW_PATH}/home-${width}.png`,
      });
      await page.locator("#featured-heading").scrollIntoViewIfNeeded();
      await page.evaluate(async () => {
        await Promise.all(
          Array.from(
            document.querySelectorAll<HTMLImageElement>(".product-pack-photo"),
          ).map((img) => img.decode().catch(() => {})),
        );
      });
      await page
        .locator("#featured-heading")
        .evaluate((el) =>
          el.getAnimations({ subtree: true }).forEach((a) => a.finish()),
        );
      await page.screenshot({
        path: `${process.env.VISUAL_REVIEW_PATH}/catalog-${width}.png`,
      });
    }
  }
});

test("accessories move off the homepage and remain available in the full catalog", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator('a.product-card[href="/products/e2e-approved"]'),
  ).toHaveCount(0);
  await expect(page.locator(".product-card")).toHaveCount(6);
  await page.getByRole("link", { name: "اکسسوری و ملزومات" }).click();
  await expect(page).toHaveURL(/\/catalog\?type=accessory$/);
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(
    page.locator('a.product-card[href="/products/e2e-approved"]'),
  ).toBeVisible();
  await expect(page.locator(".cigarette-hero, .hero-smoke, video")).toHaveCount(
    0,
  );
  if (process.env.VISUAL_REVIEW_PATH) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${process.env.VISUAL_REVIEW_PATH}/accessories-${test.info().project.name}.png`,
    });
  }
  await page.getByRole("button", { name: "همه کالاها", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(18);
  await page.getByLabel("جست‌وجوی کالا").fill("does-not-exist");
  await expect(page.locator(".product-card")).toHaveCount(0);
  await page.getByRole("button", { name: "پاک کردن فیلترها" }).click();
  await expect(page.locator(".product-card")).toHaveCount(18);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("category discovery uses real catalog routes and missing categories stay empty", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".discovery-card")).toHaveCount(6);
  await expect(
    page.getByRole("link", { name: "دسته سیگار", exact: true }),
  ).toHaveAttribute("href", "/catalog?type=cigarette");
  await expect(
    page.getByRole("link", { name: "دسته اکسسوری", exact: true }),
  ).toHaveAttribute("href", "/catalog?type=accessory");
  await page.getByRole("link", { name: "دسته ویپ و پاد", exact: true }).click();
  await expect(page).toHaveURL(/category=vape-pod/);
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "حذف فیلتر دسته" }),
  ).toContainText("ویپ و پاد");
  await expect(
    page.getByRole("heading", { name: "مدلی با این مشخصات پیدا نشد." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "حذف فیلتر دسته" }).click();
  await expect(page.locator(".product-card")).toHaveCount(18);
  await page.goto("/catalog?category=pipe");
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "حذف فیلتر دسته" }),
  ).toContainText("پیپ");
});

test("global search and brand/category deep links preserve initial filters", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "جست‌وجوی همه کالاها" })
    .fill("كامپكت");
  await page.getByRole("button", { name: "اجرای جست‌وجو" }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await expect(
    page.getByRole("textbox", { name: "جست‌وجوی کالا" }),
  ).toHaveValue("كامپكت");
  await page.reload();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.goto("/catalog?type=cigarette&brand=Winston&category=xs");
  await expect(page.locator(".product-card")).toHaveCount(3);
  await expect(page.getByLabel("فیلتر برند", { exact: true })).toHaveValue(
    "Winston",
  );
  await page.getByRole("button", { name: "حذف فیلتر دسته" }).click();
  await expect(page.locator(".product-card")).toHaveCount(14);
  await page.getByRole("button", { name: "پاک کردن همه فیلترها" }).click();
  await expect(page.locator(".product-card")).toHaveCount(18);
  await expect(page.getByLabel("فیلتر برند", { exact: true })).toHaveValue("");
  await page.goto("/");
  await page
    .locator(".brand-index")
    .getByRole("link", { name: "Winston", exact: true })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(14);
  await expect(page.getByLabel("فیلتر برند", { exact: true })).toHaveValue(
    "Winston",
  );
});

test("premium navigation and filter controls fit at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("searchbox", { name: "جست‌وجوی همه کالاها" }),
  ).toBeVisible();
  await page.locator(".catalog-discovery").scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/catalog?brand=Winston&category=xs");
  await expect(page.locator(".product-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("age gate requires an explicit adult choice and remembers this session", async ({
  page,
}) => {
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "تأیید سن برای ورود" });
  await expect(gate).toBeVisible();
  await expect(
    page.getByRole("button", { name: "۱۸ سال یا بیشتر دارم", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(gate).toBeVisible();
  await page
    .getByRole("button", { name: "۱۸ سال یا بیشتر دارم", exact: true })
    .click();
  await expect(gate).toHaveCount(0);
  await page.getByRole("link", { name: "دسته سیگار", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("age gate denies underage entry and offers a neutral exit", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "زیر ۱۸ سال دارم", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "زیر ۱۸ سال",
  );
  await expect(
    page.getByRole("button", { name: "۱۸ سال یا بیشتر دارم", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "خروج از سایت", exact: true }).click();
  await expect(page).toHaveURL("about:blank");
});

test("hookah entry stays honest and links to accessory catalog", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "دسته قلیان", exact: true }).click();
  await expect(page).toHaveURL(/category=hookah/);
  await expect(
    page.getByRole("heading", { name: "قلیان؛ مدل‌ها و ملزومات." }),
  ).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "حذف فیلتر دسته" }),
  ).toContainText("قلیان");
  await page.getByRole("link", { name: "مرور اکسسوری", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
});

test("tobacco flavor weight and brand compose, survive reload and clear", async ({
  page,
}) => {
  await page.goto("/catalog?type=tobacco");
  await expect(page.locator(".product-card")).toHaveCount(3);
  await page.getByLabel("فیلتر طعم", { exact: true }).selectOption("نعناع");
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.getByLabel("فیلتر وزن", { exact: true }).selectOption("250.00");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page
    .getByLabel("فیلتر برند", { exact: true })
    .selectOption("E2E Tobacco");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.goto(
    "/catalog?type=tobacco&flavor=" +
      encodeURIComponent("نعناع") +
      "&weight=250&brand=E2E%20Tobacco",
  );
  await page.reload();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.getByLabel("فیلتر طعم", { exact: true })).toHaveValue(
    "نعناع",
  );
  await expect(
    page.getByRole("button", { name: "حذف فیلتر وزن" }),
  ).toContainText("۲۵۰ گرم");
  await page.getByRole("button", { name: "حذف فیلتر وزن" }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.getByRole("button", { name: "پاک کردن همه فیلترها" }).click();
  await expect(page.locator(".product-card")).toHaveCount(18);
  await expect(page.getByRole("button", { name: "حذف فیلتر طعم" })).toHaveCount(
    0,
  );
});

test("tobacco details expose known specs without a purchase action", async ({
  page,
}) => {
  await page.goto("/products/e2e-mint-large");
  await expect(page.locator(".spec-table")).toContainText("نعناع");
  await expect(page.locator(".spec-table")).toContainText("۲۵۰ گرم");
  await expect(page.getByRole("button", { name: "افزودن به سبد" })).toHaveCount(
    0,
  );
  await expect(page.locator(".compatibility-detail")).toHaveCount(0);
});

test("tobacco filters fit at 320px and show missing deep-link values honestly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/catalog?type=tobacco&flavor=missing&weight=500");
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(page.getByLabel("فیلتر طعم", { exact: true })).toHaveValue(
    "missing",
  );
  await expect(page.getByLabel("فیلتر وزن", { exact: true })).toHaveValue(
    "500",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "سیگار", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(14);
  await expect(page.getByLabel("فیلتر طعم", { exact: true })).toHaveCount(0);
});

test("editorial hero and six catalog entries stay visible and fit the viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".scene-hero-image")).toBeVisible();
  await expect(page.locator(".scene-edition")).toContainText(
    "Titanium Edition",
  );
  await expect(page.locator(".discovery-card")).toHaveCount(6);
  await expect(page.locator(".editorial-card")).toHaveCount(4);
  await expect(page.locator(".home-products .product-card")).toHaveCount(6);
  const art = await page.request.get("/images/titanium-reference.png");
  expect(art.status()).toBe(200);
  expect(art.headers()["content-type"]).toContain("image/png");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: test.info().outputPath("editorial-home.png"),
    fullPage: true,
  });
  await page.goto("/catalog?type=tobacco");
  await expect(page.getByLabel("فیلتر طعم", { exact: true })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("tobacco-catalog.png"),
    fullPage: true,
  });
});

test("wishlist persists, updates header and removes without navigating the product", async ({
  page,
}) => {
  await page.goto("/catalog?type=cigarette");
  await page
    .getByRole("button", {
      name: "افزودن به علاقه‌مندی‌ها: وینستون سیلور",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/catalog/);
  await expect(
    page.getByRole("link", { name: "علاقه‌مندی‌ها", exact: true }),
  ).toContainText("۱");
  await page.getByRole("link", { name: "علاقه‌مندی‌ها", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "حذف از علاقه‌مندی‌ها: وینستون سیلور",
      exact: true,
    })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "هنوز کالایی برای نمایش ندارید." }),
  ).toBeVisible();
});

test("real gallery opens, traps focus and closes with keyboard", async ({
  page,
}) => {
  await page.goto("/products/winston-silver");
  await page.getByRole("button", { name: "بزرگ‌نمایی تصویر کالا" }).click();
  const dialog = page.getByRole("dialog", { name: "تصویر وینستون سیلور" });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "بستن تصویر" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await expect
    .poll(() =>
      dialog
        .locator("img")
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: test.info().outputPath("gallery.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "بزرگ‌نمایی تصویر کالا" }),
  ).toBeFocused();
});

test("brand directory resolves actual products and unknown brands return 404", async ({
  page,
}) => {
  await page.goto("/brands");
  await expect(page.locator(".brand-card")).toHaveCount(2);
  await page.locator(".brand-card").filter({ hasText: "Winston" }).click();
  await expect(page).toHaveURL(/brands\/Winston/);
  await expect(page.locator(".product-card")).toHaveCount(14);
  await expect(page.getByLabel("فیلتر برند", { exact: true })).toHaveValue(
    "Winston",
  );
  const response = await page.goto("/brands/no-such-brand");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "پیدا نشد",
  );
});

test("guest cart survives registration, checkout and later login; other sessions cannot read order", async ({
  page,
  browser,
}) => {
  const username = "e2e-" + test.info().project.name + "-" + Date.now();
  const password = "T1tanium-safe-Complex$2026";
  await page.goto("/products/e2e-approved");
  await page.getByRole("checkbox", { name: /۱۸ سال/ }).check();
  await page.getByRole("button", { name: "افزودن به سبد" }).click();
  await expect(page.getByRole("status")).toContainText("اضافه شد");
  await page.goto("/register");
  await page
    .getByRole("textbox", { name: "نام کاربری", exact: true })
    .fill(username);
  await page
    .getByRole("textbox", { name: "نام نمایشی", exact: true })
    .fill("آزمون حساب");
  await page.getByLabel("رمز عبور", { exact: true }).fill(password);
  await page.getByLabel("تکرار رمز عبور", { exact: true }).fill(password);
  await page.getByRole("checkbox", { name: /۱۸ سال/ }).check();
  await page.getByRole("button", { name: "ثبت‌نام", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "آزمون حساب",
  );
  await page.getByLabel("ویرایش نام نمایشی").fill("نام تازه");
  await page.getByRole("button", { name: "ذخیره مشخصات" }).click();
  await expect(page.getByRole("status")).toContainText("به‌روز شد");
  await page.goto("/cart");
  await expect(page.locator(".cart-row")).toHaveCount(1);
  await page.getByRole("link", { name: "ادامه و بررسی درخواست" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.locator(".cart-row")).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath("checkout-populated.png"), fullPage: true });
  await page.getByRole("button", { name: "ثبت درخواست سفارش" }).click();
  const track = page.getByRole("link", { name: "مشاهده وضعیت سفارش" });
  await expect(track).toBeVisible();
  const orderPath = (await track.getAttribute("href"))!;
  const other = await browser.newContext();
  const denied = await other.request.get(
    "http://127.0.0.1:3010/api/v1" + orderPath + "/",
  );
  expect(denied.status()).toBe(404);
  await other.close();
  await page.goto("/account");
  await expect(page.locator(".account-order")).toHaveCount(1);
  await page.getByRole("button", { name: "خروج از حساب" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(orderPath);
  await expect(page.locator("main").getByRole("alert")).toContainText("پیدا نشد");
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill(username);
  await page.getByLabel("رمز عبور", { exact: true }).fill(password);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("نام تازه");
  await expect(page.locator(".account-order")).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath("account-populated.png"), fullPage: true });
  await page.locator(".account-order").click();
  await expect(page.getByText("کیف آزمون خرید", { exact: true })).toBeVisible();
});

test("all Titanium routes have shared surfaces, RTL and no overflow at mobile tablet desktop widths", async ({
  page,
}) => {
  test.setTimeout(300000);
  const routes = [
    "/",
    "/catalog",
    "/catalog?type=cigarette",
    "/catalog?category=vape-pod",
    "/catalog?category=pipe",
    "/catalog?category=hookah",
    "/catalog?type=tobacco",
    "/catalog?type=accessory",
    "/products/winston-silver",
    "/brands",
    "/brands/Winston",
    "/search?q=XS",
    "/wishlist",
    "/cart",
    "/checkout",
    "/login",
    "/register",
    "/account",
    "/sellers",
    "/branches",
    "/guide",
    "/policy",
    "/products/not-a-product",
  ];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [index, route] of routes.entries()) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + " at " + width,
      ).toBeTruthy();
      expect(
        await page
          .locator("body")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ).toBe("rgb(15, 20, 25)");
      await expect(page.locator(".header")).toBeVisible();
      await expect(page.locator(".footer")).toHaveCount(1);
      if (width === (test.info().project.name === "desktop" ? 1440 : 390)) {
        // Edge can leave decode() pending for offscreen lazy images. Make the
        // visible page's images eager for this full-page artifact and verify them.
        const images = page.locator("img:visible");
        await images.evaluateAll((elements) => {
          for (const element of elements) (element as HTMLImageElement).loading = "eager";
        });
        for (const image of await images.all()) {
          await image.scrollIntoViewIfNeeded();
          await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
          await image.evaluate(el => Promise.race([
            (el as HTMLImageElement).decode(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Image decode timed out")), 5000)),
          ]));
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({
          path: test.info().outputPath(`route-${index}.png`),
          fullPage: true,
        });
      }
    }
  }
  expect(errors).toEqual([]);
});
