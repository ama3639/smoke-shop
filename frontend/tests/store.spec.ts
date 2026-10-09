import { test, expect } from "@playwright/test";

test("RTL, local font, catalog and normalized search", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("سیگار");
  await expect(page.locator(".product-card")).toHaveCount(6);
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
  await page.getByRole("button", { name: "اسلیم", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.getByRole("button", { name: "همه نوع‌ها", exact: true }).click();
  await page.getByRole("button", { name: "عمده / باکس", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(5);
  await page.getByRole("button", { name: "تکی / بسته", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(5);
  await page.getByLabel("فیلتر برند").selectOption("Winston");
  await expect(page.locator(".product-card")).toHaveCount(5);
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

test("scroll moves the packs and smoke and motion can be paused", async ({
  page,
}) => {
  await page.goto("/");
  const pack = page.locator(".scene-pack-main");
  const smoke = page.locator(".smoke-cloud-near");
  await expect
    .poll(() =>
      page
        .locator(".smoke-cloud-near img")
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBe(1024);
  await expect(page.locator(".scene-smoke")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(
    await page
      .locator(".scene-smoke")
      .evaluate((el) => getComputedStyle(el).pointerEvents),
  ).toBe("none");
  const initial = await pack.evaluate((el) => getComputedStyle(el).transform);
  const initialSmoke = await smoke.evaluate(
    (el) => getComputedStyle(el).transform,
  );
  await page.evaluate(() => scrollTo(0, Math.round(innerHeight * 0.65)));
  await expect
    .poll(() =>
      page
        .locator(".cigarette-hero")
        .evaluate((el) =>
          Number(getComputedStyle(el).getPropertyValue("--scene-progress")),
        ),
    )
    .toBeGreaterThan(0.1);
  const moved = await pack.evaluate((el) => getComputedStyle(el).transform);
  expect(moved).not.toBe(initial);
  expect(moved).toContain("matrix3d");
  expect(await smoke.evaluate((el) => getComputedStyle(el).transform)).not.toBe(
    initialSmoke,
  );
  await page.getByRole("button", { name: "توقف حرکت" }).click();
  await expect(page.locator(".cigarette-hero")).toHaveClass(/scene-static/);
  await expect
    .poll(() =>
      page
        .locator(".cigarette-hero")
        .evaluate((el) =>
          Number(getComputedStyle(el).getPropertyValue("--scene-progress")),
        ),
    )
    .toBe(0);
  await expect
    .poll(() => smoke.evaluate((el) => getComputedStyle(el).transform))
    .toBe(initialSmoke);
});

test("reduced motion preserves a static readable scene", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".cigarette-hero")).toHaveClass(/scene-static/);
  expect(
    await page
      .locator(".hero-sticky")
      .evaluate((el) => getComputedStyle(el).position),
  ).toBe("relative");
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
      .locator(".smoke-cloud-near")
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("none");
});
