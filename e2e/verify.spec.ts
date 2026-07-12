import { test, expect } from "@playwright/test";

test("Login page loads with email/password form", async ({ page }) => {
  await page.goto("http://localhost:3001/login");
  await expect(page.locator("text=Spenda")).toBeVisible();
  await expect(page.locator("input[type='email']")).toBeVisible();
  await expect(page.locator("input[type='password']")).toBeVisible();
  await expect(page.locator("text=Sign in with Google")).toBeVisible();
  await expect(page.locator("button[type='submit']")).toBeVisible();
});
