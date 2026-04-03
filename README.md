# AI Project Info Platform

Static web frontend for daily AI project scouting.

## Goal

Track China-market AI software projects with explicit monetization paths, publish daily additions, and avoid duplicates before publishing to GitHub Pages.
The UI now uses a summary-first layout: Daily Feed cards show concise intros, and the right-hand detail panel expands the selected project.
Projects are displayed by discovery order descending by default, so the newest scoped item stays at the top.

## Structure

- `index.html`: static entry page for GitHub Pages.
- `styles.css`: visual system and responsive layout.
- `app.js`: renders daily feed and the selected project detail from JSON data.
  Includes client-side search, filters, click-through detail selection, and newest-first ordering.
- `data/projects.json`: source of truth for tracked projects.
  Includes `discoveredSeq`, which is the stable ordering key for newest-first display.
- `scripts/add-project.mjs`: add a new project with its first daily note.
- `scripts/add-daily-note.mjs`: append a daily update to an existing project.
- `scripts/update-project.mjs`: update an existing project’s evidence fields, sources, monetization text, and optionally append a new daily note in one pass.
- `scripts/validate-projects.mjs`: duplicate guard for ids, normalized names, slugs, source URLs, and repeated daily notes.

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
     --summary "为什么今天纳入" \
     --update "本次新增说明"
   ```

2. Append a daily note to an existing project:

   ```bash
   node scripts/add-daily-note.mjs \
     --id "proj.project-slug" \
     --kind "Update" \
     --summary "今天的新判断" \
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
     --summary "今天的新判断" \
     --update "这次补证补到了什么"
   ```

4. Run `node scripts/validate-projects.mjs`.
5. Push the repo and publish with GitHub Pages.

The add-project script auto-assigns the next `discoveredSeq`, so newer projects remain ahead of older ones in the UI even if they share the same `firstSeen` date.
The update-project script is useful for medium-to-strong upgrades because it updates `lastUpdated` on the targeted project only, avoiding manual JSON edits across repeated fields.

## GitHub Pages

This repository is static by default. Publishing the repository root is enough for GitHub Pages.
