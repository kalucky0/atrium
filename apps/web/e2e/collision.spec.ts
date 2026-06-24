import { test, expect } from "@playwright/test";

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;

test("booking the same slot twice shows a conflict", async ({ page }) => {
  const start = new Date(2031, 0, 1, 0, 0);
  start.setMinutes(start.getMinutes() + (Date.now() % 200_000));
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const startStr = toLocalInput(start);
  const endStr = toLocalInput(end);

  const email = `e2e_${Date.now()}@example.com`;
  await page.goto("/login");
  await page.getByPlaceholder("email").fill(email);
  await page.getByPlaceholder(/hasło/).fill("password1234");
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page).toHaveURL(/\/resources/);

  await page.getByRole("link", { name: "Sala konferencyjna A" }).click();
  await expect(page.getByRole("heading", { name: "Rezerwacja na dowolny zakres" })).toBeVisible();

  const fillSlot = async () => {
    await page.getByLabel("początek").fill(startStr);
    await page.getByLabel("koniec").fill(endStr);
  };

  const firstResponse = page.waitForResponse((r) => r.url().includes("reservations.create"));
  await fillSlot();
  await page.getByRole("button", { name: "Zarezerwuj", exact: true }).click();
  await firstResponse;

  await fillSlot();
  await page.getByRole("button", { name: "Zarezerwuj", exact: true }).click();
  await expect(page.getByText("Termin jest już zajęty")).toBeVisible();
});
