import { test, expect } from "@playwright/test";

const TEST_EMAIL = "suami@gmail.com";
const TEST_PASSWORD = "Test123456";

test("5-step add expense wizard", async ({ page }) => {
  // Sign in
  await page.goto("http://localhost:3001/login");
  await page.fill("input[type='email']", TEST_EMAIL);
  await page.fill("input[type='password']", TEST_PASSWORD);
  await page.click("button[type='submit']");
  await page.waitForURL("**/", { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Click FAB
  await page.click("a[href='/add']");
  await page.waitForURL("**/add", { timeout: 5000 });
  await page.waitForTimeout(1000);

  // Step 1: Amount - type 15.50
  await page.screenshot({ path: "/tmp/wizard-step1.png", fullPage: true });
  await page.click("button:has-text('1')");
  await page.click("button:has-text('5')");
  await page.click("button:has-text('5')");
  await page.click("button:has-text('0')");

  // Click Next
  await page.click("button:has-text('Next')");
  await page.waitForTimeout(500);

  // Step 2: Date & Time
  await page.screenshot({ path: "/tmp/wizard-step2.png", fullPage: true });
  await page.click("button:has-text('Next')");
  await page.waitForTimeout(500);

  // Step 3: Payment Method
  await page.screenshot({ path: "/tmp/wizard-step3.png", fullPage: true });
  // Select Cash if available
  const cashBtn = page.locator("button:has-text('Cash')");
  if (await cashBtn.isVisible()) {
    await cashBtn.click();
  }
  await page.click("button:has-text('Next')");
  await page.waitForTimeout(500);

  // Step 4: Category
  await page.screenshot({ path: "/tmp/wizard-step4.png", fullPage: true });
  // Select Eating Out
  const eatingBtn = page.locator("button:has-text('Eating Out')");
  if (await eatingBtn.isVisible()) {
    await eatingBtn.click();
  }
  await page.click("button:has-text('Next')");
  await page.waitForTimeout(500);

  // Step 5: Merchant + Ownership
  await page.screenshot({ path: "/tmp/wizard-step5.png", fullPage: true });
  await page.fill("input[placeholder='Merchant name']", "Nasi Lemak Kampung");
  await page.click("button:has-text('Save')");
  await page.waitForTimeout(3000);

  // Should be on dashboard
  await page.screenshot({ path: "/tmp/wizard-final.png", fullPage: true });
  console.log("URL:", page.url());
  console.log("Content:", (await page.textContent("body"))?.slice(0, 300));
});
