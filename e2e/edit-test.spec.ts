import { test, expect } from "@playwright/test";

const TEST_EMAIL = "suami@gmail.com";
const TEST_PASSWORD = "Test123456";

test("Change payment method and save", async ({ page }) => {
  const failedRequests: string[] = [];
  const allLogs: string[] = [];

  page.on("response", async (response) => {
    if (response.status() >= 400) {
      let body = "";
      try { body = await response.text(); } catch {}
      failedRequests.push(`${response.status()} ${response.url()}\n${body.slice(0, 1000)}`);
    }
  });
  page.on("console", (msg) => allLogs.push(`[${msg.type()}] ${msg.text()}`));

  // Sign in
  await page.goto("http://localhost:3001/login");
  await page.fill("input[type='email']", TEST_EMAIL);
  await page.fill("input[type='password']", TEST_PASSWORD);
  await page.click("button[type='submit']");
  await page.waitForURL("**/", { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Click first transaction
  const txnLink = page.locator("a[href^='/transactions/']").first();
  await txnLink.click();
  await page.waitForTimeout(2000);

  // Log the current payment method
  const currentPm = await page.locator("text=Payment").locator("..").textContent();
  console.log("Before edit:", currentPm);

  // Click edit button
  const editBtn = page.locator("button").filter({ has: page.locator("svg.lucide-pencil") });
  await editBtn.click();
  await page.waitForTimeout(1000);

  // Log what payment methods are in the dropdown
  const selectOptions = await page.locator("select").nth(1).locator("option").allTextContents();
  console.log("Payment method options:", selectOptions);

  // Change payment method dropdown
  const pmSelect = page.locator("select").nth(1);
  const options = await pmSelect.locator("option").all();
  console.log("Dropdown option count:", options.length);
  for (const opt of options) {
    const val = await opt.getAttribute("value");
    const text = await opt.textContent();
    console.log(`  option: value="${val}" text="${text}"`);
  }

  // Select the first non-empty option
  if (options.length > 1) {
    const value = await options[1].getAttribute("value");
    console.log("Selecting value:", value);
    await pmSelect.selectOption(value!);
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: "/tmp/pm-edit.png", fullPage: true });

  // Check editData state before save
  const selectedValue = await pmSelect.inputValue();
  console.log("Selected payment method value:", selectedValue);

  // Click Save
  const saveBtn = page.locator("button:has-text('Save Changes')");
  await saveBtn.click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "/tmp/pm-after-save.png", fullPage: true });

  // Check the saved value
  const savedPm = await page.locator("text=Payment").locator("..").textContent();
  console.log("After save:", savedPm);

  console.log("=== FAILED REQUESTS ===");
  failedRequests.forEach((r) => console.log(r));
  console.log("=== CONSOLE ===");
  allLogs.forEach((l) => console.log(l));
});
