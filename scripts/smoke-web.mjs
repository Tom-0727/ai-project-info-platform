import { chromium } from "playwright";

const baseUrl = process.argv[2] || "https://ai-projects-scout.tom-blogs.top";
const projectPath = process.argv[3] || "/?project=proj.shanjian-ai-video-creation";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];

page.on("pageerror", (error) => {
  pageErrors.push(error.message || String(error));
});

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("text=项目总表", { timeout: 15000 });
  await page.waitForSelector("text=项目详情", { timeout: 15000 });
  assert(pageErrors.length === 0, `homepage pageerror: ${pageErrors[0]}`);

  await page.goto(new URL(projectPath, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("text=闪剪AI", { timeout: 15000 });
  await page.waitForSelector("text=项目详情", { timeout: 15000 });
  assert(pageErrors.length === 0, `project pageerror: ${pageErrors[0]}`);

  console.log(`SMOKE_OK ${baseUrl}`);
} finally {
  await browser.close();
}
