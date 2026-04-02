import { parseArgs } from "node:util";

import {
  loadProjects,
  makeProjectId,
  saveProjects,
  splitList,
  todayInShanghai,
  validateProjectUniqueness,
} from "./lib/projects.mjs";

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    slug: { type: "string" },
    aliases: { type: "string", default: "" },
    form: { type: "string" },
    customers: { type: "string" },
    pain: { type: "string" },
    monetization: { type: "string" },
    barriers: { type: "string" },
    "evidence-level": { type: "string", default: "medium" },
    "marketing-risk": { type: "string", default: "medium" },
    "evidence-signals": { type: "string", default: "" },
    "evidence-note": { type: "string", default: "" },
    benchmarks: { type: "string" },
    sources: { type: "string" },
    summary: { type: "string" },
    update: { type: "string" },
    date: { type: "string", default: todayInShanghai() },
    kind: { type: "string", default: "New" },
    status: { type: "string", default: "active" },
  },
  allowPositionals: false,
});

const required = [
  "name",
  "slug",
  "form",
  "customers",
  "pain",
  "monetization",
  "barriers",
  "benchmarks",
  "sources",
  "summary",
  "update",
];

const missing = required.filter((field) => !values[field]);
if (missing.length > 0) {
  console.error(`Missing required options: ${missing.join(", ")}`);
  process.exit(1);
}

if (!["strong", "medium", "weak"].includes(values["evidence-level"])) {
  console.error(`Invalid --evidence-level: ${values["evidence-level"]}`);
  process.exit(1);
}

if (!["low", "medium", "high"].includes(values["marketing-risk"])) {
  console.error(`Invalid --marketing-risk: ${values["marketing-risk"]}`);
  process.exit(1);
}

const main = async () => {
  const data = await loadProjects();
  const candidate = {
    id: makeProjectId(values.slug),
    canonicalName: values.name,
    aliases: splitList(values.aliases),
    slug: values.slug,
    status: values.status,
    firstSeen: values.date,
    lastUpdated: values.date,
    productForm: values.form,
    targetCustomers: values.customers,
    painPoint: values.pain,
    monetization: values.monetization,
    barriers: values.barriers,
    evidenceQuality: {
      level: values["evidence-level"],
      marketingRisk: values["marketing-risk"],
      signals: splitList(values["evidence-signals"]),
      note: values["evidence-note"],
    },
    benchmarks: splitList(values.benchmarks),
    sources: splitList(values.sources),
    dailyNotes: [
      {
        date: values.date,
        kind: values.kind,
        summary: values.summary,
        update: values.update,
      },
    ],
  };

  const failures = validateProjectUniqueness(data.projects, candidate);
  if (failures.length > 0) {
    console.error("Failed to add project:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  data.projects.push(candidate);
  data.projects.sort((left, right) => right.lastUpdated.localeCompare(left.lastUpdated));
  await saveProjects(data);
  console.log(`Added project ${candidate.canonicalName} (${candidate.id}).`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
