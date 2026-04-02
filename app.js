const dataUrl = "./data/projects.json";

const heroMetrics = document.querySelector("#hero-metrics");
const dailyFeed = document.querySelector("#daily-feed");
const projectGrid = document.querySelector("#project-grid");
const resultsHint = document.querySelector("#results-hint");
const searchInput = document.querySelector("#search-input");
const evidenceFilter = document.querySelector("#evidence-filter");
const formFilter = document.querySelector("#form-filter");
const sortFilter = document.querySelector("#sort-filter");

const metricTemplate = document.querySelector("#metric-template");
const dayTemplate = document.querySelector("#day-template");
const feedItemTemplate = document.querySelector("#feed-item-template");
const projectTemplate = document.querySelector("#project-template");

const formatCount = (value) => String(value).padStart(2, "0");
const evidenceLevelLabel = {
  strong: "强证据",
  medium: "中证据",
  weak: "弱证据",
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

const renderMetrics = (projects) => {
  heroMetrics.innerHTML = "";
  const dailyEntries = projects.flatMap((project) => project.dailyNotes);
  const newestDay = [...new Set(dailyEntries.map((entry) => entry.date))].sort().at(-1);
  const newestCount = newestDay ? dailyEntries.filter((entry) => entry.date === newestDay).length : 0;
  const metrics = [
    { value: formatCount(projects.length), label: "已整理项目" },
    { value: formatCount(newestCount), label: "当日动态" },
    { value: formatCount(projects.filter((project) => project.status === "active").length), label: "持续跟踪中" },
    {
      value: formatCount(projects.filter((project) => project.evidenceQuality.level === "strong").length),
      label: "强证据项目",
    },
  ];

  metrics.forEach((metric) => {
    const node = metricTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".metric-value").textContent = metric.value;
    node.querySelector(".metric-label").textContent = metric.label;
    heroMetrics.appendChild(node);
  });
};

const renderDailyFeed = (projects) => {
  dailyFeed.innerHTML = "";
  const entries = projects.flatMap((project) =>
    project.dailyNotes.map((note) => ({
      ...note,
      discoveredSeq: project.discoveredSeq,
      canonicalName: project.canonicalName,
      productForm: project.productForm,
      monetization: project.monetization,
      evidenceQuality: project.evidenceQuality,
      sources: project.sources,
      slug: project.slug,
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
        itemNode.querySelector(".feed-type").textContent = item.kind;
        itemNode.querySelector(".feed-name").textContent = item.canonicalName;
        itemNode.querySelector(".feed-tag").textContent = item.productForm;
        itemNode.querySelector(".feed-summary").textContent = item.summary;
        const meta = itemNode.querySelector(".feed-meta");
        [
          `变现模式：${item.monetization}`,
          `证据等级：${evidenceLevelLabel[item.evidenceQuality.level]}`,
          `营销风险：${riskLabel[item.evidenceQuality.marketingRisk]}`,
          `更新说明：${item.update}`,
          `唯一标识：${item.slug}`,
        ].forEach((text) => {
          const li = document.createElement("li");
          li.textContent = text;
          meta.appendChild(li);
        });
        renderSourceLinks(itemNode.querySelector(".source-links"), item.sources);
        itemContainer.appendChild(itemNode);
      });

      dailyFeed.appendChild(node);
    });

  if (dailyFeed.childElementCount === 0) {
    dailyFeed.innerHTML = "<p>当前筛选条件下没有匹配的动态。</p>";
  }
};

const renderProjectIndex = (projects) => {
  projectGrid.innerHTML = "";
  projects.forEach((project) => {
    const node = projectTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".project-form").textContent = project.productForm;
    node.querySelector(".project-name").textContent = project.canonicalName;
    node.querySelector(".project-status").textContent =
      project.status === "active" ? "持续跟踪" : "观察中";
    node.querySelector(".project-pain").textContent = `核心痛点：${project.painPoint}`;
    node.querySelector(".project-status").classList.add(`status-${project.evidenceQuality.level}`);

    const detailList = node.querySelector(".project-detail-list");
    [
      ["目标客群", project.targetCustomers],
      ["变现模式", project.monetization],
      ["证据强度", `${evidenceLevelLabel[project.evidenceQuality.level]} / ${riskLabel[project.evidenceQuality.marketingRisk]}`],
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
    projectGrid.appendChild(node);
  });

  if (projectGrid.childElementCount === 0) {
    projectGrid.innerHTML = "<p>当前筛选条件下没有匹配的项目。</p>";
  }
};

const state = {
  query: "",
  evidence: "all",
  form: "all",
  sort: "discovered",
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
  resultsHint.textContent = `当前命中 ${visibleProjects.length} / ${allProjects.length} 个项目`;
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
  renderMetrics(visibleProjects);
  renderDailyFeed(visibleProjects);
  renderProjectIndex(visibleProjects);
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
