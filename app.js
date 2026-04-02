const dataUrl = "./data/projects.json";

const heroMetrics = document.querySelector("#hero-metrics");
const dailyFeed = document.querySelector("#daily-feed");
const resultsHint = document.querySelector("#results-hint");
const summaryStrip = document.querySelector("#summary-strip");
const detailEmpty = document.querySelector("#detail-empty");
const detailView = document.querySelector("#detail-view");
const detailPanel = document.querySelector(".panel-side");
const searchInput = document.querySelector("#search-input");
const evidenceFilter = document.querySelector("#evidence-filter");
const formFilter = document.querySelector("#form-filter");
const scenarioFilter = document.querySelector("#scenario-filter");
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

const normalizeLookupKey = (value) => normalizeText(value ?? "");

const buildProjectLookup = (projects) => {
  const lookup = new Map();
  projects.forEach((project) => {
    [project.canonicalName, ...(project.aliases ?? [])].forEach((name) => {
      const key = normalizeLookupKey(name);
      if (key) {
        lookup.set(key, project);
      }
    });
  });
  return lookup;
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
    `场景：${summarizeScenario(project)}`,
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

const renderBenchmarkLinks = (container, project, projects) => {
  const projectLookup = buildProjectLookup(projects);

  (project.benchmarks ?? []).forEach((benchmark) => {
    const match = projectLookup.get(normalizeLookupKey(benchmark));
    if (match && match.id !== project.id) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "benchmark-chip benchmark-chip-link";
      button.textContent = benchmark;
      button.addEventListener("click", () => {
        state.selectedProjectId = match.id;
        renderApp(window.__projectsCache__);
        focusDetailPanel();
      });
      container.appendChild(button);
      return;
    }

    const tag = document.createElement("span");
    tag.className = "benchmark-chip";
    tag.textContent = benchmark;
    container.appendChild(tag);
  });
};

const renderRelatedProjects = (container, project, projects) => {
  const related = projects
    .filter(
      (candidate) =>
        candidate.id !== project.id && summarizeScenario(candidate) === summarizeScenario(project)
    )
    .sort((left, right) => right.discoveredSeq - left.discoveredSeq)
    .slice(0, 4);

  if (related.length === 0) {
    const empty = document.createElement("p");
    empty.className = "related-empty";
    empty.textContent = "当前库里还没有更多同场景项目。";
    container.appendChild(empty);
    return;
  }

  related.forEach((candidate) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "related-card";
    button.innerHTML = `
      <span class="related-name">${candidate.canonicalName}</span>
      <span class="related-form">${candidate.productForm}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedProjectId = candidate.id;
      renderApp(window.__projectsCache__);
      focusDetailPanel();
    });
    container.appendChild(button);
  });
};

const renderDetailView = (project, projects) => {
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
    ["工作流场景", summarizeScenario(project)],
    ["商业化清晰度", `${evidenceLevelLabel[project.evidenceQuality.level]} / ${riskLabel[project.evidenceQuality.marketingRisk]}`],
    ["证据信号", project.evidenceQuality.signals.join(" / ")],
    ["判断说明", project.evidenceQuality.note],
    ["技术与合规门槛", project.barriers],
  ].forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    detailList.append(dt, dd);
  });

  const benchmarkTitle = document.createElement("dt");
  benchmarkTitle.textContent = "真实对标";
  const benchmarkValue = document.createElement("dd");
  benchmarkValue.className = "benchmark-links";
  renderBenchmarkLinks(benchmarkValue, project, projects);
  detailList.append(benchmarkTitle, benchmarkValue);

  renderSourceLinks(node.querySelector(".source-links"), project.sources);

  const relatedSection = document.createElement("section");
  relatedSection.className = "related-section";
  relatedSection.innerHTML = `
    <p class="detail-note-label">同场景项目</p>
    <div class="related-projects"></div>
  `;
  renderRelatedProjects(relatedSection.querySelector(".related-projects"), project, projects);
  node.appendChild(relatedSection);

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
  scenario: "all",
  selectedProjectId: null,
};

const normalizeText = (value) => value.toLowerCase().trim();
const evidenceWeight = { strong: 3, medium: 2, weak: 1 };

const summarizeScenario = (project) => {
  const productFormSignal = project.productForm;
  const productSignal = [project.productForm, project.painPoint].join(" ");

  if (/(笔记|知识|协作|白板|思维导图|反馈|问卷|原型|文档|工作台)/i.test(productFormSignal)) {
    return "办公与知识";
  }

  if (/(编程|开发|代码)/i.test(productSignal)) {
    return "开发提效";
  }

  if (/(字幕|配音|转写|语音|视频|音频|翻译|口播|会议纪要|同传)/i.test(productSignal)) {
    return "音视频处理";
  }

  if (/(logo|设计|海报|修图|写真|图片|商品图|商拍|视觉)/i.test(productSignal)) {
    return "视觉创作";
  }

  if (/(客服|工单|销售|listing|广告|营销|电商|跨境客服|获客)/i.test(productSignal)) {
    return "卖家增长";
  }

  if (/(写作|作文|论文|校对|改写|润色|求职|面试|招聘|学习|阅读|订阅|总结阅读|翻译阅读)/i.test(productSignal)) {
    return "写作与学习";
  }

  if (/(pdf|ocr|文档|知识|协作|白板|思维导图|反馈|问卷|原型|笔记|信息聚合|总结|工作台)/i.test(productSignal)) {
    return "办公与知识";
  }

  return "通用效率";
};

const renderStructureSummary = (projects) => {
  summaryStrip.innerHTML = "";

  if (projects.length === 0) {
    return;
  }

  const strongCount = projects.filter((project) => project.evidenceQuality.level === "strong").length;
  const mediumCount = projects.filter((project) => project.evidenceQuality.level === "medium").length;
  const weakCount = projects.filter((project) => project.evidenceQuality.level === "weak").length;

  const topScenarios = Object.entries(
    projects.reduce((accumulator, project) => {
      const bucket = summarizeScenario(project);
      accumulator[bucket] = (accumulator[bucket] ?? 0) + 1;
      return accumulator;
    }, {})
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2);

  const cards = [
    {
      label: "当前最密集场景",
      scenario: topScenarios[0]?.[0] ?? null,
      value: topScenarios[0] ? `${topScenarios[0][0]} · ${topScenarios[0][1]}个` : "暂无",
      note: "点击只看这个场景。",
    },
    {
      label: "第二密集场景",
      scenario: topScenarios[1]?.[0] ?? null,
      value: topScenarios[1] ? `${topScenarios[1][0]} · ${topScenarios[1][1]}个` : "暂无",
      note: "点击切到第二主场景。",
    },
    {
      label: "商业化清晰度结构",
      scenario: null,
      value: `${strongCount} 强 / ${mediumCount} 中 / ${weakCount} 待补证`,
      note: "直接看当前筛选结果里证据强弱分布。",
    },
  ];

  cards.forEach((card) => {
    const isInteractive = Boolean(card.scenario);
    const element = document.createElement(isInteractive ? "button" : "article");
    element.className = "summary-card";
    if (isInteractive) {
      element.type = "button";
      element.dataset.scenario = card.scenario;
      element.setAttribute("aria-pressed", String(state.scenario === card.scenario));
      if (state.scenario === card.scenario) {
        element.classList.add("summary-card-active");
      }
      element.addEventListener("click", () => {
        state.scenario = state.scenario === card.scenario ? "all" : card.scenario;
        scenarioFilter.value = state.scenario;
        renderApp(window.__projectsCache__);
      });
    }

    element.innerHTML = `
      <p class="summary-label">${card.label}</p>
      <h3 class="summary-value">${card.value}</h3>
      <p class="summary-note">${card.note}</p>
    `;
    summaryStrip.appendChild(element);
  });
};

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

const populateScenarioFilter = (projects) => {
  [...new Set(projects.map((project) => summarizeScenario(project)))]
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .forEach((scenario) => {
      const option = document.createElement("option");
      option.value = scenario;
      option.textContent = scenario;
      scenarioFilter.appendChild(option);
    });
};

const projectMatchesBase = (project) => {
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

const projectMatches = (project) =>
  projectMatchesBase(project) &&
  (state.scenario === "all" || summarizeScenario(project) === state.scenario);

const renderResultsHint = (visibleProjects, allProjects) => {
  const scenarioText = state.scenario === "all" ? "全部场景" : `当前场景：${state.scenario}`;
  resultsHint.textContent = `当前命中 ${visibleProjects.length} / ${allProjects.length} 个项目，${scenarioText}。点击左侧卡片在右侧查看完整详情。`;
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
  const baseProjects = sortProjects(projects.filter(projectMatchesBase));
  const visibleProjects = sortProjects(projects.filter(projectMatches));
  const selectedProject =
    visibleProjects.find((project) => project.id === state.selectedProjectId) ?? visibleProjects[0] ?? null;
  state.selectedProjectId = selectedProject?.id ?? null;
  renderMetrics(visibleProjects);
  renderStructureSummary(baseProjects);
  renderDailyFeed(visibleProjects, state.selectedProjectId, (projectId) => {
    state.selectedProjectId = projectId;
    renderApp(projects);
    focusDetailPanel();
  });
  renderDetailView(selectedProject, projects);
  renderResultsHint(visibleProjects, projects);
};

const bootstrap = async () => {
  const response = await fetch(dataUrl);
  const { projects } = await response.json();
  window.__projectsCache__ = projects;
  populateFormFilter(projects);
  populateScenarioFilter(projects);

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

  scenarioFilter.addEventListener("change", (event) => {
    state.scenario = event.target.value;
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
