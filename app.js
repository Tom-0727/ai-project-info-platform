const dataUrl = "./data/projects.json";

const heroMetrics = document.querySelector("#hero-metrics");
const dailyFeed = document.querySelector("#daily-feed");
const resultsHint = document.querySelector("#results-hint");
const detailEmpty = document.querySelector("#detail-empty");
const detailView = document.querySelector("#detail-view");
const detailPanel = document.querySelector(".panel-side");
const searchInput = document.querySelector("#search-input");
const evidenceFilter = document.querySelector("#evidence-filter");
const formFilter = document.querySelector("#form-filter");
const sortFilter = document.querySelector("#sort-filter");

const metricTemplate = document.querySelector("#metric-template");
const dayTemplate = document.querySelector("#day-template");
const feedItemTemplate = document.querySelector("#feed-item-template");
const detailTemplate = document.querySelector("#detail-template");

const formatCount = (value) => String(value).padStart(2, "0");
const evidenceLevelLabel = {
  strong: "商业化清楚",
  medium: "商业化部分清楚",
  weak: "商业化待补证",
};
const riskLabel = {
  low: "低营销风险",
  medium: "中营销风险",
  high: "高营销风险",
};
const sourceLabel = {
  0: "首要来源",
  1: "补充来源",
};

const normalizeDate = (value) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));

const domainFromUrl = (value) => new URL(value).hostname.replace(/^www\./, "");

const renderSourceLinks = (container, sources) => {
  sources.forEach((source, index) => {
    const link = document.createElement("a");
    link.href = source;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.className = "source-chip";
    link.textContent = `${sourceLabel[index] ?? `来源 ${index + 1}`} · ${domainFromUrl(source)}`;
    container.appendChild(link);
  });
};

const shortList = (value, count = 2) => {
  if (!value) {
    return "未标注";
  }

  return value.split("、").filter(Boolean).slice(0, count).join("、");
};

const firstClause = (value) => {
  if (!value) {
    return "未标注";
  }

  return value.split(/[，。；;]/)[0].trim();
};

const buildFeedIntro = (project) => {
  const audience = shortList(project.targetCustomers, 2);
  const pain = firstClause(project.painPoint);
  return `${project.productForm}，面向${audience}，解决${pain}。`;
};

const getLatestNote = (project) => project.dailyNotes[0];

const renderFeedMeta = (container, project) => {
  [
    `变现：${firstClause(project.monetization)}`,
    `证据：${evidenceLevelLabel[project.evidenceQuality.level]}`,
    `客群：${shortList(project.targetCustomers, 2)}`,
  ].forEach((text) => {
    const item = document.createElement("span");
    item.className = "feed-pill";
    item.textContent = text;
    container.appendChild(item);
  });
};

const renderMetrics = (projects) => {
  heroMetrics.innerHTML = "";
  const dailyEntries = projects.flatMap((project) => project.dailyNotes);
  const newestDay = [...new Set(dailyEntries.map((entry) => entry.date))].sort().at(-1);
  const newestCount = newestDay ? dailyEntries.filter((entry) => entry.date === newestDay).length : 0;
  const metrics = [
    { value: formatCount(projects.length), label: "已整理项目" },
    { value: formatCount(newestCount), label: "当日动态" },
    { value: formatCount(projects.filter((project) => project.status === "active").length), label: "活跃样本" },
    {
      value: formatCount(projects.filter((project) => project.evidenceQuality.level === "strong").length),
      label: "商业化清楚",
    },
  ];

  metrics.forEach((metric) => {
    const node = metricTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".metric-value").textContent = metric.value;
    node.querySelector(".metric-label").textContent = metric.label;
    heroMetrics.appendChild(node);
  });
};

const renderDailyFeed = (projects, selectedProjectId, onSelectProject) => {
  dailyFeed.innerHTML = "";
  const entries = projects.flatMap((project) =>
    project.dailyNotes.map((note) => ({
      ...note,
      discoveredSeq: project.discoveredSeq,
      canonicalName: project.canonicalName,
      productForm: project.productForm,
      targetCustomers: project.targetCustomers,
      monetization: project.monetization,
      evidenceQuality: project.evidenceQuality,
      sources: project.sources,
      slug: project.slug,
      projectId: project.id,
      feedIntro: project.feedIntro ?? buildFeedIntro(project),
    }))
  );

  const grouped = entries.reduce((accumulator, entry) => {
    accumulator[entry.date] ??= [];
    accumulator[entry.date].push(entry);
    return accumulator;
  }, {});

  Object.entries(grouped)
    .sort((left, right) => right[0].localeCompare(left[0]))
    .forEach(([date, items]) => {
      items.sort((left, right) => right.discoveredSeq - left.discoveredSeq);
      const node = dayTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector(".day-date").textContent = date;
      node.querySelector(".day-title").textContent = normalizeDate(date);
      node.querySelector(".day-count").textContent = `${items.length} 条`;
      const itemContainer = node.querySelector(".day-items");

      items.forEach((item) => {
        const itemNode = feedItemTemplate.content.firstElementChild.cloneNode(true);
        itemNode.dataset.projectId = item.projectId;
        itemNode.setAttribute("aria-pressed", String(item.projectId === selectedProjectId));
        itemNode.setAttribute("aria-label", `${item.canonicalName}，${item.feedIntro}`);
        itemNode.querySelector(".feed-type").textContent = item.kind;
        itemNode.querySelector(".feed-name").textContent = item.canonicalName;
        itemNode.querySelector(".feed-tag").textContent = item.productForm;
        itemNode.querySelector(".feed-summary").textContent = item.feedIntro;
        const meta = itemNode.querySelector(".feed-meta");
        renderFeedMeta(meta, item);
        itemNode.addEventListener("click", () => onSelectProject(item.projectId));
        itemContainer.appendChild(itemNode);
      });

      dailyFeed.appendChild(node);
    });

  if (dailyFeed.childElementCount === 0) {
    dailyFeed.innerHTML = "<p>当前筛选条件下没有匹配的动态。</p>";
  }
};

const renderDetailView = (project) => {
  if (!project) {
    detailEmpty.hidden = false;
    detailView.hidden = true;
    detailView.innerHTML = "";
    return;
  }

  detailEmpty.hidden = true;
  detailView.hidden = false;
  detailView.innerHTML = "";
  const node = detailTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".project-form").textContent = project.productForm;
  node.querySelector(".project-name").textContent = project.canonicalName;
  node.querySelector(".project-status").textContent = project.status === "active" ? "已收录" : "观察中";
  node.querySelector(".project-status").classList.add(`status-${project.evidenceQuality.level}`);
  node.querySelector(".detail-intro").textContent = buildFeedIntro(project);

  const latestNote = getLatestNote(project);
  const noteBlock = node.querySelector(".detail-note");
  noteBlock.innerHTML = "";
  const noteTitle = document.createElement("p");
  noteTitle.className = "detail-note-label";
  noteTitle.textContent = "最新动态";
  const noteText = document.createElement("p");
  noteText.className = "detail-note-text";
  noteText.textContent = latestNote ? latestNote.update : "暂无动态。";
  noteBlock.append(noteTitle, noteText);

  const detailList = node.querySelector(".project-detail-list");
  [
    ["目标客群", project.targetCustomers],
    ["核心痛点", project.painPoint],
    ["变现模式", project.monetization],
    ["商业化清晰度", `${evidenceLevelLabel[project.evidenceQuality.level]} / ${riskLabel[project.evidenceQuality.marketingRisk]}`],
    ["证据信号", project.evidenceQuality.signals.join(" / ")],
    ["判断说明", project.evidenceQuality.note],
    ["技术与合规门槛", project.barriers],
    ["真实对标", project.benchmarks.join(" / ")],
  ].forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    detailList.append(dt, dd);
  });

  renderSourceLinks(node.querySelector(".source-links"), project.sources);
  detailView.appendChild(node);
  detailView.scrollTop = 0;
};

const focusDetailPanel = () => {
  if (window.matchMedia("(max-width: 1080px)").matches) {
    detailPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

const state = {
  query: "",
  evidence: "all",
  form: "all",
  sort: "discovered",
  selectedProjectId: null,
};

const normalizeText = (value) => value.toLowerCase().trim();
const evidenceWeight = { strong: 3, medium: 2, weak: 1 };

const populateFormFilter = (projects) => {
  [...new Set(projects.map((project) => project.productForm))]
    .sort((left, right) => left.localeCompare(right))
    .forEach((form) => {
      const option = document.createElement("option");
      option.value = form;
      option.textContent = form;
      formFilter.appendChild(option);
    });
};

const projectMatches = (project) => {
  const haystack = normalizeText(
    [
      project.canonicalName,
      ...(project.aliases ?? []),
      ...(project.benchmarks ?? []),
      project.productForm,
      project.targetCustomers,
    ].join(" ")
  );

  const matchesQuery = !state.query || haystack.includes(normalizeText(state.query));
  const matchesEvidence = state.evidence === "all" || project.evidenceQuality.level === state.evidence;
  const matchesForm = state.form === "all" || project.productForm === state.form;
  return matchesQuery && matchesEvidence && matchesForm;
};

const renderResultsHint = (visibleProjects, allProjects) => {
  resultsHint.textContent = `当前命中 ${visibleProjects.length} / ${allProjects.length} 个项目，点击左侧卡片在右侧查看完整详情。`;
};

const sortProjects = (projects) => {
  const copy = [...projects];

  if (state.sort === "discovered") {
    copy.sort((left, right) => right.discoveredSeq - left.discoveredSeq);
    return copy;
  }

  if (state.sort === "evidence") {
    copy.sort((left, right) => {
      const evidenceDelta = evidenceWeight[right.evidenceQuality.level] - evidenceWeight[left.evidenceQuality.level];
      return evidenceDelta || right.discoveredSeq - left.discoveredSeq;
    });
    return copy;
  }

  if (state.sort === "name") {
    copy.sort((left, right) => left.canonicalName.localeCompare(right.canonicalName, "zh-CN"));
    return copy;
  }

  copy.sort((left, right) => right.discoveredSeq - left.discoveredSeq);
  return copy;
};

const renderApp = (projects) => {
  const visibleProjects = sortProjects(projects.filter(projectMatches));
  const selectedProject =
    visibleProjects.find((project) => project.id === state.selectedProjectId) ?? visibleProjects[0] ?? null;
  state.selectedProjectId = selectedProject?.id ?? null;
  renderMetrics(visibleProjects);
  renderDailyFeed(visibleProjects, state.selectedProjectId, (projectId) => {
    state.selectedProjectId = projectId;
    renderApp(projects);
    focusDetailPanel();
  });
  renderDetailView(selectedProject);
  renderResultsHint(visibleProjects, projects);
};

const bootstrap = async () => {
  const response = await fetch(dataUrl);
  const { projects } = await response.json();
  populateFormFilter(projects);

  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderApp(projects);
  });

  evidenceFilter.addEventListener("change", (event) => {
    state.evidence = event.target.value;
    renderApp(projects);
  });

  formFilter.addEventListener("change", (event) => {
    state.form = event.target.value;
    renderApp(projects);
  });

  sortFilter.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderApp(projects);
  });

  renderApp(projects);
};

bootstrap().catch((error) => {
  dailyFeed.innerHTML = `<p>数据加载失败：${error.message}</p>`;
});
