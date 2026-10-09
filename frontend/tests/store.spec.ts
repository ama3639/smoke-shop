import { test, expect } from "@playwright/test";

test("RTL, local font, catalog and normalized search", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "هر قطعه",
  );
  await expect(page.locator(".product-card")).toHaveCount(7);
  await page.getByRole("textbox", { name: "جست‌وجوی کالا" }).fill("كيف");
  await expect(page.locator(".product-card")).toHaveCount(3);
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

test("category and compatibility filters show relevant products", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "قطعات و اتصالات", exact: true })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("button", { name: "همه کالاها", exact: true }).click();
  await page.getByLabel("مدل وسیله یا اتصال").selectOption("sample-9mm");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-card")).toContainText("واشر اتصال");
});

test("catalog-only product cannot be purchased and missing product returns 404", async ({
  page,
}) => {
  await page.goto("/products/travel-case");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "کیف نگهداری ابزار",
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
