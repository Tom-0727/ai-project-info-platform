import { loadProjects, normalizeName } from "./lib/projects.mjs";

const main = async () => {
  const { projects } = await loadProjects();

  const seenIds = new Map();
  const seenSlugs = new Map();
  const seenNames = new Map();
  const seenDiscoveredSeq = new Map();
  const seenSources = new Map();
  const failures = [];

  for (const project of projects) {
    const normalizedName = normalizeName(project.canonicalName);
    const { evidenceQuality } = project;

    [
      [seenIds, project.id, "id"],
      [seenSlugs, project.slug, "slug"],
      [seenNames, normalizedName, "canonicalName"],
      [seenDiscoveredSeq, String(project.discoveredSeq), "discoveredSeq"],
    ].forEach(([bucket, key, label]) => {
      if (bucket.has(key)) {
        failures.push(`Duplicate ${label}: ${key} -> ${bucket.get(key)} / ${project.id}`);
        return;
      }
      bucket.set(key, project.id);
    });

    for (const source of project.sources) {
      if (seenSources.has(source)) {
        failures.push(`Duplicate source URL: ${source} -> ${seenSources.get(source)} / ${project.id}`);
        continue;
      }
      seenSources.set(source, project.id);
    }

    const seenDailyNotes = new Set();
    for (const note of project.dailyNotes) {
      const key = [project.id, note.date, note.kind, note.summary, note.update].join("::");
      if (seenDailyNotes.has(key)) {
        failures.push(`Duplicate daily note in ${project.id}: ${note.date} / ${note.summary}`);
        continue;
      }
      seenDailyNotes.add(key);
    }

    if (!evidenceQuality) {
      failures.push(`Missing evidenceQuality for ${project.id}`);
      continue;
    }

    if (!Number.isInteger(project.discoveredSeq) || project.discoveredSeq <= 0) {
      failures.push(`Invalid discoveredSeq for ${project.id}: ${project.discoveredSeq}`);
    }

    if (!["strong", "medium", "weak"].includes(evidenceQuality.level)) {
      failures.push(`Invalid evidenceQuality.level for ${project.id}: ${evidenceQuality.level}`);
    }

    if (!["low", "medium", "high"].includes(evidenceQuality.marketingRisk)) {
      failures.push(
        `Invalid evidenceQuality.marketingRisk for ${project.id}: ${evidenceQuality.marketingRisk}`
      );
    }
  }

  if (failures.length > 0) {
    console.error("Validation failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Validated ${projects.length} projects with no duplicate ids, names, slugs, sources, or discoveredSeq values.`
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
