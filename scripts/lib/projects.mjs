import { readFile, writeFile } from "node:fs/promises";

export const dataFileUrl = new URL("../../data/projects.json", import.meta.url);

export const normalizeName = (value) => value.toLowerCase().replace(/\s+/g, "").trim();

export const todayInShanghai = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
};

export const splitList = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const loadProjects = async () => {
  const raw = await readFile(dataFileUrl, "utf8");
  return JSON.parse(raw);
};

export const saveProjects = async (data) => {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(dataFileUrl, serialized, "utf8");
};

export const makeProjectId = (slug) => `proj.${slug}`;

export const hasDailyNote = (project, candidate) =>
  project.dailyNotes.some(
    (note) =>
      note.date === candidate.date &&
      note.kind === candidate.kind &&
      note.summary === candidate.summary &&
      note.update === candidate.update
  );

export const validateProjectUniqueness = (projects, candidate) => {
  const normalizedName = normalizeName(candidate.canonicalName);
  const failures = [];

  for (const project of projects) {
    if (project.id === candidate.id) {
      failures.push(`Duplicate id: ${candidate.id}`);
    }
    if (project.slug === candidate.slug) {
      failures.push(`Duplicate slug: ${candidate.slug}`);
    }
    if (normalizeName(project.canonicalName) === normalizedName) {
      failures.push(`Duplicate canonicalName: ${candidate.canonicalName}`);
    }
  }

  return failures;
};
