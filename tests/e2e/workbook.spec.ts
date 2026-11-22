import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { fixture } from "../fixtures";

test("review, selective edit, download, retry: no workbook network requests", async ({ page }, testInfo) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) requests.push(`${request.method()} ${request.url()}`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const revoke = URL.revokeObjectURL;
    (window as unknown as { revokedDownloads: number }).revokedDownloads = 0;
    URL.revokeObjectURL = (url) => {
      (window as unknown as { revokedDownloads: number }).revokedDownloads++;
      revoke(url);
    };
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("choose-file.png"), fullPage: true });
  await page.getByLabel("Choose Excel file").setInputFiles({
    name: "budget.final.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from(fixture()),
  });
  await expect(page.getByRole("heading", { name: "Choose the locks to remove" })).toBeFocused();
  await expect(page.getByText("Budget", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("review-locks.png"), fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("checkbox", { name: "Workbook structure / windows" }).uncheck();
  await page.getByRole("button", { name: "Create editable copy" }).click();
  await expect(page.getByRole("heading", { name: "Your editable copy is ready" })).toBeFocused();
  const saved = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download copy" }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe("budget.final-excelled.xlsx");
  const output = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(strFromU8(output["xl/worksheets/sheet1.xml"])).not.toContain("sheetProtection");
  expect(strFromU8(output["xl/workbook.xml"])).toContain("workbookProtection");
  expect(Array.from(output["xl/media/image1.png"])).toEqual([0x89, 0x50, 0x4e, 0x47, 0, 0xff, 0xfe, 0x80]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Process another file" }).click();
  await expect(page.getByLabel("Choose Excel file")).toBeFocused();
  expect(await page.evaluate(() => (window as unknown as { revokedDownloads: number }).revokedDownloads)).toBe(1);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("drop validation, long names and disabled empty selection", async ({ page }) => {
  await page.goto("/");
  const files: number[][] = [Array.from(fixture()), Array.from(fixture())];
  const transfer = await page.evaluateHandle((buffers: number[][]) => {
    const data = new DataTransfer();
    buffers.forEach((bytes, index) => data.items.add(new File([new Uint8Array(bytes)], `${index}.xlsx`)));
    return data;
  }, files);
  await page.locator(".dropzone").dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.locator(".notice-error")).toContainText("Choose one workbook at a time");
  const longName = `${"予算.final.".repeat(12)}xlsx`;
  await page.getByLabel("Choose Excel file").setInputFiles({
    name: longName, mimeType: "application/octet-stream", buffer: Buffer.from(fixture()),
  });
  await expect(page.getByRole("heading", { name: "Choose the locks to remove" })).toBeVisible();
  for (const box of await page.getByRole("checkbox").all()) await box.uncheck();
  await expect(page.getByRole("button", { name: "Create editable copy" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("checkbox", { name: "Workbook structure / windows" }).check();
  await expect(page.getByRole("button", { name: "Create editable copy" })).toBeEnabled();
  await transfer.dispose();
});

test("timed-out workers are terminated with an actionable error", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor() {
        super(URL.createObjectURL(new Blob(["self.onmessage = () => {};"], { type: "application/javascript" })));
      }
    };
  });
  await page.goto("/");
  await page.clock.install();
  await page.getByLabel("Choose Excel file").setInputFiles({
    name: "book.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from(fixture()),
  });
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await page.clock.runFor(30_001);
  await expect(page.locator(".notice-error")).toContainText("took too long");
  await expect(page.getByRole("heading", { name: "Let’s try another way" })).toBeFocused();
  await expect(page.getByLabel("Choose Excel file")).toBeVisible();
});

test("invalid, encrypted and already-unprotected files have honest recoverable outcomes", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Choose Excel file");
  await input.setInputFiles({ name: "bad.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("not a workbook") });
  await expect(page.getByRole("region", { name: "Let’s try another way" }).getByRole("alert")).toContainText("not a readable Excel package");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await input.setInputFiles({ name: "encrypted.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]) });
  await expect(page.getByRole("region", { name: "Let’s try another way" }).getByRole("alert")).toContainText("cannot recover opening passwords");
  await input.setInputFiles({ name: "clear.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from(fixture({ sheetLock: "", workbookLock: "" })) });
  await expect(page.getByRole("heading", { name: "No editing locks found" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create editable copy" })).toHaveCount(0);
  await page.getByRole("button", { name: "Choose another file" }).click();
  await input.setInputFiles({ name: "clear.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from(fixture()) });
  await expect(page.getByRole("heading", { name: "Choose the locks to remove" })).toBeVisible();
});

test("keyboard access, help disclosure and mobile layout", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to workbook tool" })).toBeFocused();
  await page.getByLabel("Choose Excel file").focus();
  await expect(page.getByLabel("Choose Excel file")).toBeFocused();
  await page.getByText("Does my workbook leave this device?").click();
  await expect(page.getByText("The website itself still loads from a web server.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("cancel terminates pending work and returns focus without a stale result", async ({ page }) => {
  // Run a real, deliberately idle worker, so cancellation is deterministic.
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor() {
        super(URL.createObjectURL(new Blob(["self.onmessage = () => {};"], { type: "application/javascript" })));
      }
      terminate() {
        (window as unknown as { cancelledWorker: boolean }).cancelledWorker = true;
        super.terminate();
      }
    };
  });
  await page.goto("/");
  await page.getByLabel("Choose Excel file").setInputFiles({
    name: "book.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from(fixture()),
  });
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  // Cancellation is tested while the UI is in its busy state, before a worker result.
  await cancel.click();
  await expect(page.getByLabel("Choose Excel file")).toBeFocused();
  await expect(page.getByRole("status")).toContainText("Processing cancelled");
  await expect(page.getByRole("heading", { name: "Start with your workbook" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { cancelledWorker: boolean }).cancelledWorker)).toBe(true);
});

test("no-JavaScript users get a local-processing explanation", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3100/");
  await expect(page.locator("noscript")).toBeVisible();
  // Playwright's text matcher intentionally excludes <noscript> content.
  expect(await page.locator("noscript").evaluate((node) => node.textContent))
    .toContain("Excelled needs JavaScript to process files locally");
  await context.close();
});
