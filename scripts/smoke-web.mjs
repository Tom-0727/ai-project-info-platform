import { chromium } from "playwright";

const baseUrl = process.argv[2] || "https://ai-projects-scout.tom-blogs.top";
const projectPath = process.argv[3] || "/?project=proj.shanjian-ai-video-creation";
const coveragePath = process.argv[4] || "/?sourceType=%E4%BB%B7%E6%A0%BC%E9%A1%B5";
const comparePath =
  process.argv[5] ||
  "/?project=proj.shanjian-ai-video-creation&compare=proj.kaipai,proj.shuode-ai";
const domainPath =
  process.argv[6] || "/?project=proj.shanjian-ai-video-creation&sourceDomain=shanjian.tv";

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

  await page.goto(new URL(coveragePath, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("text=证据覆盖：价格页", { timeout: 15000 });
  await page.waitForSelector("text=项目总表", { timeout: 15000 });
  assert(pageErrors.length === 0, `coverage pageerror: ${pageErrors[0]}`);

  await page.goto(new URL(comparePath, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("text=当前对标", { timeout: 15000 });
  await page.waitForSelector("text=开拍", { timeout: 15000 });
  await page.waitForSelector("text=说得AI", { timeout: 15000 });
  assert(pageErrors.length === 0, `compare pageerror: ${pageErrors[0]}`);

  await page.goto(new URL(domainPath, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("text=来源域名 · shanjian.tv", { timeout: 15000 });
  await page.waitForSelector("text=闪剪AI", { timeout: 15000 });
  assert(pageErrors.length === 0, `domain pageerror: ${pageErrors[0]}`);

  console.log(`SMOKE_OK ${baseUrl}`);
} finally {
  await browser.close();
}
