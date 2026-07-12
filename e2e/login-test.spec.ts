import { test, expect } from "@playwright/test";

const TEST_EMAIL = "suami@gmail.com";
const TEST_PASSWORD = "Test123456";

test("Add a transaction and verify dashboard updates", async ({ page }) => {
  // Sign in
  await page.goto("http://localhost:3001/login");
  await page.fill("input[type='email']", TEST_EMAIL);
  await page.fill("input[type='password']", TEST_PASSWORD);
  await page.click("button[type='submit']");
  await page.waitForURL("**/", { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Click FAB to add expense
  await page.click("a[href='/add']");
  await page.waitForURL("**/add", { timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/add-expense.png", fullPage: true });

  // Type amount: 25.50
  await page.click("button:has-text('2')");
  await page.click("button:has-text('5')");
  await page.click("button:has-text('5')");
  await page.click("button:has-text('0')");

  // Fill merchant
  await page.fill("input[placeholder='Where did you spend?']", "McDonalds");

  // Select category - Eating Out
  await page.click("button:has-text('🍽️')");

  // Select payment method if available
  const pmButton = page.locator("button:has-text('Cash')");
  if (await pmButton.isVisible()) {
    await pmButton.click();
  }

  await page.screenshot({ path: "/tmp/add-filled.png", fullPage: true });

  // Save
  await page.click("button:has-text('Save Expense')");
  await page.waitForTimeout(3000);

  // Should be back on dashboard
  await page.screenshot({ path: "/tmp/dashboard-with-transaction.png", fullPage: true });
  console.log("URL:", page.url());
  console.log("Content:", (await page.textContent("body"))?.slice(0, 300));
});
