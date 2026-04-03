import { parseArgs } from "node:util";

import {
  compareByDiscoveredSeqDesc,
  loadProjects,
  saveProjects,
  splitList,
  todayInShanghai,
} from "./lib/projects.mjs";

const { values } = parseArgs({
  options: {
    id: { type: "string" },
    slug: { type: "string" },
    date: { type: "string", default: todayInShanghai() },
    monetization: { type: "string" },
    barriers: { type: "string" },
    "evidence-level": { type: "string" },
    "marketing-risk": { type: "string" },
    "evidence-signals": { type: "string" },
    "evidence-note": { type: "string" },
    sources: { type: "string" },
    "source-mode": { type: "string", default: "replace" },
    summary: { type: "string" },
    update: { type: "string" },
    kind: { type: "string", default: "Update" },
  },
  allowPositionals: false,
});

if (!values.id && !values.slug) {
  console.error("Missing required selector: provide --id or --slug");
  process.exit(1);
}

if (values["evidence-level"] && !["strong", "medium", "weak"].includes(values["evidence-level"])) {
  console.error(`Invalid --evidence-level: ${values["evidence-level"]}`);
  process.exit(1);
}

if (values["marketing-risk"] && !["low", "medium", "high"].includes(values["marketing-risk"])) {
  console.error(`Invalid --marketing-risk: ${values["marketing-risk"]}`);
  process.exit(1);
}

if (!["replace", "append"].includes(values["source-mode"])) {
  console.error(`Invalid --source-mode: ${values["source-mode"]}`);
  process.exit(1);
}

if (Boolean(values.summary) !== Boolean(values.update)) {
  console.error("Both --summary and --update are required together when appending a daily note");
  process.exit(1);
}

const appendUnique = (list, items) => {
  const next = [...list];
  items.forEach((item) => {
    if (!next.includes(item)) {
      next.push(item);
    }
  });
  return next;
};

const main = async () => {
  const data = await loadProjects();
  const project = data.projects.find((candidate) =>
    values.id ? candidate.id === values.id : candidate.slug === values.slug
  );

  if (!project) {
    console.error(`Project not found for selector: ${values.id ?? values.slug}`);
    process.exit(1);
  }

  let changed = false;

  if (values.monetization) {
    project.monetization = values.monetization;
    changed = true;
  }

  if (values.barriers) {
    project.barriers = values.barriers;
    changed = true;
  }

  if (values["evidence-level"]) {
    project.evidenceQuality.level = values["evidence-level"];
    changed = true;
  }

  if (values["marketing-risk"]) {
    project.evidenceQuality.marketingRisk = values["marketing-risk"];
    changed = true;
  }

  if (values["evidence-signals"]) {
    project.evidenceQuality.signals = splitList(values["evidence-signals"]);
    changed = true;
  }

  if (values["evidence-note"]) {
    project.evidenceQuality.note = values["evidence-note"];
    changed = true;
  }

  if (values.sources) {
    const parsedSources = splitList(values.sources);
    project.sources =
      values["source-mode"] === "append" ? appendUnique(project.sources ?? [], parsedSources) : parsedSources;
    changed = true;
  }

  if (values.summary && values.update) {
    project.dailyNotes.unshift({
      date: values.date,
      kind: values.kind,
      summary: values.summary,
      update: values.update,
    });
    changed = true;
  }

  if (!changed) {
    console.error("No changes requested.");
    process.exit(1);
  }

  project.lastUpdated = values.date;
  data.projects.sort(compareByDiscoveredSeqDesc);
  await saveProjects(data);
  console.log(`Updated project ${project.canonicalName} (${project.id}).`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
