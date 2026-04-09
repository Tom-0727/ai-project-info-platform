import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const defaults = {
  baseUrl: "https://ai-projects-scout.tom-blogs.top",
  projectPath: "/?project=proj.shanjian-ai-video-creation",
  coveragePath: "/?sourceType=%E4%BB%B7%E6%A0%BC%E9%A1%B5",
  comparePath: "/?project=proj.shanjian-ai-video-creation&compare=proj.kaipai,proj.shuode-ai",
  domainPath: "/?project=proj.shanjian-ai-video-creation&sourceDomain=shanjian.tv",
  mediumGapPath: "/?project=proj.shanjian-ai-video-creation&gap=%E5%AE%98%E6%96%B9%E9%93%BE%E8%B7%AF%E9%94%99%E9%85%8D",
  limitPath: "/?limit=72",
};

const usage = () => {
  console.log(`Usage:
  node scripts/smoke-web.mjs
  node scripts/smoke-web.mjs --base-url https://ai-projects-scout.tom-blogs.top
  node scripts/smoke-web.mjs https://ai-projects-scout.tom-blogs.top

Options:
  --base-url URL          Override the site base URL.
  --project-path PATH     Override the direct project URL path.
  --coverage-path PATH    Override the source-type governance URL path.
  --compare-path PATH     Override the compare URL path.
  --domain-path PATH      Override the source-domain URL path.
  --medium-gap-path PATH  Override the medium-gap URL path.
  --limit-path PATH       Override the feed-depth URL path.
  --help                  Show this help message.

Compatibility:
  Positional arguments still work in the old order:
  baseUrl, projectPath, coveragePath, comparePath, domainPath, mediumGapPath, limitPath`);
};

const readRequiredValue = (args, index, optionName) => {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`${optionName} requires a value`);
  }
  return value;
};

const rawArgs = process.argv.slice(2);
const positional = [];
const options = { ...defaults };

for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];
  switch (arg) {
    case "--base-url":
      options.baseUrl = readRequiredValue(rawArgs, i, "--base-url");
      i += 1;
      break;
    case "--project-path":
      options.projectPath = readRequiredValue(rawArgs, i, "--project-path");
      i += 1;
      break;
    case "--coverage-path":
      options.coveragePath = readRequiredValue(rawArgs, i, "--coverage-path");
      i += 1;
      break;
    case "--compare-path":
      options.comparePath = readRequiredValue(rawArgs, i, "--compare-path");
      i += 1;
      break;
    case "--domain-path":
      options.domainPath = readRequiredValue(rawArgs, i, "--domain-path");
      i += 1;
      break;
    case "--medium-gap-path":
      options.mediumGapPath = readRequiredValue(rawArgs, i, "--medium-gap-path");
      i += 1;
      break;
    case "--limit-path":
      options.limitPath = readRequiredValue(rawArgs, i, "--limit-path");
      i += 1;
      break;
    case "--help":
      usage();
      process.exit(0);
      break;
    default:
      if (arg.startsWith("--")) {
        throw new Error(`unknown option: ${arg}`);
      }
      positional.push(arg);
  }
}

if (positional[0]) options.baseUrl = positional[0];
if (positional[1]) options.projectPath = positional[1];
if (positional[2]) options.coveragePath = positional[2];
if (positional[3]) options.comparePath = positional[3];
if (positional[4]) options.domainPath = positional[4];
if (positional[5]) options.mediumGapPath = positional[5];
if (positional[6]) options.limitPath = positional[6];

const { baseUrl, projectPath, coveragePath, comparePath, domainPath, mediumGapPath, limitPath } = options;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
const successfulResponses = new Set();
let healthRevision = "";

page.on("pageerror", (error) => {
  pageErrors.push(error.message || String(error));
});

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});

page.on("requestfailed", (request) => {
  failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`);
});

page.on("response", (response) => {
  if (response.ok()) {
    successfulResponses.add(response.url());
  }
});

const assertKeyAssetsLoaded = () => {
  const appBundleLoaded = Array.from(successfulResponses).some((url) => url.includes("/static/app-vue.js"));
  const projectsApiLoaded = Array.from(successfulResponses).some((url) => url.includes("/api/projects"));
  assert(appBundleLoaded, "missing successful response for /static/app-vue.js");
  assert(projectsApiLoaded, "missing successful response for /api/projects");
};

const assertNoCriticalRequestFailures = () => {
  const critical = failedRequests.find(
    (entry) =>
      entry.includes("/static/app-vue.js") ||
      entry.includes("/api/projects") ||
      entry.includes("/api/health")
  );
  assert(!critical, `critical request failed: ${critical}`);
};

const assertNoConsoleErrors = (label) => {
  assert(consoleErrors.length === 0, `${label} console error: ${consoleErrors[0]}`);
};

const syncHealthRevision = async () => {
  const response = await page.request.get(new URL("/api/health", baseUrl).toString());
  assert(response.ok(), `health request failed: HTTP ${response.status()}`);
  const payload = await response.json();
  healthRevision = payload.revision || "";
  assert(healthRevision, "health payload missing revision");
};

const assertRuntimeBadgeMatchesHealth = async (label) => {
  if (!healthRevision) {
    await syncHealthRevision();
  }
  const badge = page.locator(".runtime-badge");
  await badge.waitFor({ state: "visible", timeout: 15000 });
  const text = (await badge.textContent()) || "";
  assert(text.includes(healthRevision), `${label} runtime badge mismatch: expected revision ${healthRevision}, got ${text}`);
};

const captureFailureArtifacts = async () => {
  const artifactDir = path.resolve("artifacts");
  const screenshotPath = path.join(artifactDir, "smoke-failure.png");
  await fs.mkdir(artifactDir, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
};

try {
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("text=项目总表", { timeout: 15000 });
    await page.waitForSelector("text=项目详情", { timeout: 15000 });
    const homepageUrl = new URL(page.url());
    assert(!homepageUrl.searchParams.has("project"), `homepage unexpectedly carried project param: ${page.url()}`);
    await assertRuntimeBadgeMatchesHealth("homepage");
    assertKeyAssetsLoaded();
    assertNoCriticalRequestFailures();
    assertNoConsoleErrors("homepage");
    assert(pageErrors.length === 0, `homepage pageerror: ${pageErrors[0]}`);

    await page.locator('[data-project-id="proj.shanjian-ai-video-creation"]').first().click();
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get("project") === "proj.shanjian-ai-video-creation",
      { timeout: 15000 }
    );
    assertNoCriticalRequestFailures();
    assertNoConsoleErrors("homepage-click");
    assert(pageErrors.length === 0, `homepage-click pageerror: ${pageErrors[0]}`);

    await page.goto(new URL(projectPath, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("text=闪剪AI", { timeout: 15000 });
    await page.waitForSelector("text=项目详情", { timeout: 15000 });
    assertNoCriticalRequestFailures();
    assertNoConsoleErrors("project");
    assert(pageErrors.length === 0, `project pageerror: ${pageErrors[0]}`);

    await page.goto(new URL(coveragePath, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("text=证据覆盖：价格页", { timeout: 15000 });
    await page.waitForSelector("text=项目总表", { timeout: 15000 });
    assertNoCriticalRequestFailures();
    assertNoConsoleErrors("coverage");
    assert(pageErrors.length === 0, `coverage pageerror: ${pageErrors[0]}`);

    await page.goto(new URL(comparePath, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("text=当前对标", { timeout: 15000 });
    await page.waitForSelector("text=开拍", { timeout: 15000 });
    await page.waitForSelector("text=说得AI", { timeout: 15000 });
    assertNoCriticalRequestFailures();
    assertNoConsoleErrors("compare");
    assert(pageErrors.length === 0, `compare pageerror: ${pageErrors[0]}`);

    await page.goto(new URL(domainPath, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("text=来源域名 · shanjian.tv", { timeout: 15000 });
    await page.waitForSelector("text=闪剪AI", { timeout: 15000 });
    assertNoCriticalRequestFailures();
    assertNoConsoleErrors("domain");
    assert(pageErrors.length === 0, `domain pageerror: ${pageErrors[0]}`);

    await page.goto(new URL(mediumGapPath, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("text=待补证分组：官方链路错配", { timeout: 15000 });
    await page.waitForSelector("text=闪剪AI", { timeout: 15000 });
    assertNoCriticalRequestFailures();
    assertNoConsoleErrors("medium-gap");
    assert(pageErrors.length === 0, `medium-gap pageerror: ${pageErrors[0]}`);

    await page.goto(new URL(limitPath, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("text=加载更多（剩余", { timeout: 15000 });
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get("limit") === "72",
      { timeout: 15000 }
    );
    assertNoCriticalRequestFailures();
    assertNoConsoleErrors("limit");
    assert(pageErrors.length === 0, `limit pageerror: ${pageErrors[0]}`);
  } catch (error) {
    const screenshotPath = await captureFailureArtifacts();
    console.error(`SMOKE_CURRENT_URL ${page.url()}`);
    if (pageErrors.length) console.error(`SMOKE_PAGEERROR ${pageErrors[0]}`);
    if (consoleErrors.length) console.error(`SMOKE_CONSOLE_ERROR ${consoleErrors[0]}`);
    if (failedRequests.length) console.error(`SMOKE_REQUEST_FAILED ${failedRequests[0]}`);
    console.error(`SMOKE_SCREENSHOT ${screenshotPath}`);
    throw error;
  }

  console.log(`SMOKE_OK ${baseUrl}`);
} finally {
  await browser.close();
}
