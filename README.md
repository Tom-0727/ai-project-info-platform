# AI Project Info Platform

FastAPI-served web frontend for daily AI project scouting.

## Goal

Track China-market AI software projects with explicit monetization paths, publish daily additions, and avoid duplicates before publishing.
The UI uses a summary-first layout: the left panel defaults to a project library view for large-sample browsing, while the update feed remains available as a secondary mode.
Projects are displayed by discovery order descending by default, so the newest scoped item stays at the top.
The page is now served by FastAPI and loads project data from `/api/projects` instead of reading a local JSON file directly in static mode.

## Structure

- `server.py`: FastAPI app that serves the UI, static assets, and `/api/projects`.
- `index.html`: browser entry page.
- `styles.css`: visual system and responsive layout.
- `app-vue.js`: Vue-based client that renders the browse shell, filters, project list, and detail pane from `/api/projects`.
- `app.js`: previous vanilla client implementation kept temporarily as fallback/reference during migration.
- `data/projects.json`: source of truth for tracked projects.
  Includes `discoveredSeq`, which is the stable ordering key for newest-first display.
- `requirements.txt`: web runtime dependencies for FastAPI deployment.
- `package.json`: minimal Node dev setup for browser smoke testing.
- `scripts/add-project.mjs`: add a new project with its first daily note.
- `scripts/add-daily-note.mjs`: append a daily update to an existing project.
- `scripts/update-project.mjs`: update an existing project’s evidence fields, sources, monetization text, and optionally append a new daily note in one pass.
- `scripts/validate-projects.mjs`: duplicate guard for ids, normalized names, slugs, source URLs, and repeated daily notes.
- `scripts/smoke-web.mjs`: Playwright smoke test for homepage render, a known project deep link, and a few stateful governance URLs.

## Run locally

1. Start the web app:

   ```bash
   uv run --with fastapi --with uvicorn uvicorn server:app --reload --app-dir workspace/ai-project-info-platform
   ```

2. Open `http://127.0.0.1:8000`.

Useful endpoints:

- `/api/health`
- `/api/projects`
- `/static/app-vue.js`
- `/static/styles.css`

For a production-style local run that matches the deployed port:

```bash
HOST=127.0.0.1 PORT=8790 ./scripts/run-web.sh
```

## Browser smoke test

Install the browser test dependency once:

```bash
npm install
npx playwright install chromium
```

Then run the smoke check against the deployed site:

```bash
npm run smoke:web -- https://ai-projects-scout.tom-blogs.top
```

Or run the one-command verification bundle:

```bash
npm run verify:web -- https://ai-projects-scout.tom-blogs.top
```

The smoke test verifies that the homepage renders, that a known `?project=...` deep link does not fall into a blank Vue screen, that the key frontend bundle and `/api/projects` load successfully, that browser `console.error` stays clean, and that several stateful URLs still render normally:

- `?sourceType=价格页`
- `?project=...&compare=...`
- `?project=...&sourceDomain=...`
- `?project=...&gap=官方链路错配`

## Daily update workflow

1. Add a new project:

   ```bash
   node scripts/add-project.mjs \
     --name "项目名" \
     --slug "project-slug" \
     --aliases "别名A,别名B" \
     --form "产品形态" \
     --customers "目标客群" \
     --pain "核心痛点" \
     --monetization "变现模式" \
     --barriers "技术与合规门槛" \
     --evidence-level "strong" \
     --marketing-risk "low" \
     --evidence-signals "官方价格页,官方收入披露,第三方交叉验证" \
     --evidence-note "为什么这条线索可信" \
     --benchmarks "对标A,对标B" \
     --sources "https://source-a,https://source-b" \
     --summary "这是一个面向商家和创作者的AI视频工具，主要靠会员和额度权益变现。" \
     --update "本次新增说明"
   ```

2. Append a daily note to an existing project:

   ```bash
   node scripts/add-daily-note.mjs \
     --id "proj.project-slug" \
     --kind "Update" \
     --summary "这是一个面向学生和职场人群的AI写作工具，主要靠订阅和团队采购变现。" \
     --update "发生了什么变化"
   ```

3. Update an existing project when evidence gets stronger:

   ```bash
   node scripts/update-project.mjs \
     --slug "project-slug" \
     --evidence-level "strong" \
     --evidence-signals "官方价格页,官方App Store页,App Store订阅价格" \
     --evidence-note "为什么这次可以升到 strong" \
     --monetization "更具体的变现模式" \
     --sources "https://source-a,https://source-b" \
     --source-mode "replace"
   ```

   If needed, the same command can also append a fresh daily note:

   ```bash
   node scripts/update-project.mjs \
     --id "proj.project-slug" \
     --evidence-level "strong" \
     --summary "这是一个面向知识工作者的AI信息整理工具，主要靠订阅和增值功能变现。" \
     --update "这次补证补到了什么"
   ```

4. Run `node scripts/validate-projects.mjs`.
5. Push the repo and publish with GitHub Pages.

The add-project script auto-assigns the next `discoveredSeq`, so newer projects remain ahead of older ones in the UI even if they share the same `firstSeen` date.
The update-project script is useful for medium-to-strong upgrades because it updates `lastUpdated` on the targeted project only, avoiding manual JSON edits across repeated fields.
List-style CLI fields such as `--aliases`, `--evidence-signals`, `--benchmarks`, and `--sources` now accept either commas or `|`, so older one-line shell habits still parse correctly.
The validator now rejects meta-style daily note summaries such as `纳入正式名单，原因是……`; public summaries should describe what the product is, who it helps, and how it makes money in plain language.

## Deployment direction

The app is no longer limited to GitHub Pages-style static hosting.
Use the FastAPI service as the primary deployment shape when the project list and interaction complexity outgrow static delivery.

## Server deployment

The current server deployment shape is:

- Caddy on ports `80/443`
- FastAPI app on `127.0.0.1:8790`
- reverse proxy from `ai-projects-scout.tom-blogs.top` to the local FastAPI app

Recommended process entry:

```bash
HOST=127.0.0.1 PORT=8790 ./scripts/run-web.sh
```

If you want to install the app as a long-running systemd service, use this unit file as the reference:

```ini
[Unit]
Description=AI Project Scout Web
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/agents/ai-project-scout/workspace/ai-project-info-platform
Environment=HOST=127.0.0.1
Environment=PORT=8790
ExecStart=/home/ubuntu/agents/ai-project-scout/workspace/ai-project-info-platform/scripts/run-web.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
