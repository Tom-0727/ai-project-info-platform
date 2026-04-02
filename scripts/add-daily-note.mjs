import { parseArgs } from "node:util";

import { hasDailyNote, loadProjects, saveProjects, todayInShanghai } from "./lib/projects.mjs";

const { values } = parseArgs({
  options: {
    id: { type: "string" },
    date: { type: "string", default: todayInShanghai() },
    kind: { type: "string", default: "Update" },
    summary: { type: "string" },
    update: { type: "string" },
  },
  allowPositionals: false,
});

const required = ["id", "summary", "update"];
const missing = required.filter((field) => !values[field]);
if (missing.length > 0) {
  console.error(`Missing required options: ${missing.join(", ")}`);
  process.exit(1);
}

const main = async () => {
  const data = await loadProjects();
  const project = data.projects.find((item) => item.id === values.id);

  if (!project) {
    console.error(`Project not found: ${values.id}`);
    process.exit(1);
  }

  const note = {
    date: values.date,
    kind: values.kind,
    summary: values.summary,
    update: values.update,
  };

  if (hasDailyNote(project, note)) {
    console.error(`Daily note already exists for ${values.id}.`);
    process.exit(1);
  }

  project.dailyNotes.push(note);
  project.dailyNotes.sort((left, right) => right.date.localeCompare(left.date));
  project.lastUpdated = values.date;
  data.projects.sort((left, right) => right.lastUpdated.localeCompare(left.lastUpdated));
  await saveProjects(data);
  console.log(`Added ${values.kind} note to ${project.canonicalName} (${project.id}).`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
