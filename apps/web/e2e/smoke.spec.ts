import { test, expect } from "@playwright/test";

test("sign up then see the resource list", async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;

  await page.goto("/login");
  await page.getByPlaceholder("email").fill(email);
  await page.getByPlaceholder(/hasło/).fill("password1234");
  await page.getByRole("button", { name: "Załóż konto" }).click();

  await expect(page).toHaveURL(/\/resources/);
  await expect(page.getByRole("heading", { name: "Zasoby" })).toBeVisible();
  await expect(page.getByText("Sala konferencyjna A")).toBeVisible();
});
