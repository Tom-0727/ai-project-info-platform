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
const resetFiltersButton = document.querySelector("#reset-filters");
const strongFilterButton = document.querySelector("#strong-filter");
const mediumFilterButton = document.querySelector("#medium-filter");
const refreshFilterButton = document.querySelector("#refresh-filter");
const copyViewLinkButton = document.querySelector("#copy-view-link");

const metricTemplate = document.querySelector("#metric-template");
const dayTemplate = document.querySelector("#day-template");
const feedItemTemplate = document.querySelector("#feed-item-template");
const detailTemplate = document.querySelector("#detail-template");
let copyFeedbackTimer = null;

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

const hasEvidenceRefresh = (project) => Boolean(project.lastUpdated && project.firstSeen && project.lastUpdated > project.firstSeen);

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

const getEvidenceGapLabel = (project) => {
  if (project.evidenceQuality.level === "strong") {
    return null;
  }

  const note = project.evidenceQuality.note ?? "";

  if (/(价格|定价|价格数字).*(不完整|不透明|较弱|不足|不稳定)/.test(note)) {
    return "缺稳定价格面";
  }

  if (/(企业|采购|报价|席位).*(弱|不透明|咨询)/.test(note)) {
    return "缺公开套餐价";
  }

  if (/(抓取|检索|获取|retriev)/i.test(note)) {
    return "缺稳定可检索证据";
  }

  return "缺更强商业化证据";
};

const buildFeedIntro = (project) => {
  const audience = shortList(project.targetCustomers, 2);
  const pain = firstClause(project.painPoint);
  return `${project.productForm}，面向${audience}，解决${pain}。`;
};

const getLatestNote = (project) => project.dailyNotes[0];

const renderFeedMeta = (container, project) => {
  const items = [
    `变现：${firstClause(project.monetization)}`,
    `证据：${evidenceLevelLabel[project.evidenceQuality.level]}`,
    `场景：${summarizeScenario(project)}`,
    `客群：${shortList(project.targetCustomers, 2)}`,
  ];
  const gapLabel = getEvidenceGapLabel(project);

  if (gapLabel) {
    items.push(`待补证：${gapLabel}`);
  }

  if (hasEvidenceRefresh(project)) {
    items.push("状态：最近补证");
  }

  items.forEach((text) => {
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

const applyFocusedFilter = ({ scenario = "all", form = "all" }) => {
  state.query = "";
  state.evidence = "all";
  state.scenario = scenario;
  state.form = form;
  renderApp(window.__projectsCache__);
};

const sortComparableProjects = (project) => (left, right) => {
  const formDelta = Number(right.productForm === project.productForm) - Number(left.productForm === project.productForm);
  if (formDelta !== 0) {
    return formDelta;
  }

  const evidenceDelta = evidenceWeight[right.evidenceQuality.level] - evidenceWeight[left.evidenceQuality.level];
  if (evidenceDelta !== 0) {
    return evidenceDelta;
  }

  return right.discoveredSeq - left.discoveredSeq;
};

const getRelatedProjects = (project, projects, mode) => {
  const scenario = summarizeScenario(project);

  return projects
    .filter((candidate) => {
      if (candidate.id === project.id) {
        return false;
      }

      if (mode === "same-form") {
        return candidate.productForm === project.productForm;
      }

      return (
        summarizeScenario(candidate) === scenario && candidate.productForm !== project.productForm
      );
    })
    .sort(sortComparableProjects(project))
    .slice(0, 4);
};

const renderRelatedProjects = (container, related, emptyText) => {
  if (related.length === 0) {
    const empty = document.createElement("p");
    empty.className = "related-empty";
    empty.textContent = emptyText;
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
      <span class="related-evidence">商业化：${evidenceLevelLabel[candidate.evidenceQuality.level]}</span>
      <span class="related-monetization">变现：${firstClause(candidate.monetization)}</span>
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

  if (hasEvidenceRefresh(project)) {
    const refreshFlag = document.createElement("span");
    refreshFlag.className = "project-refresh-flag";
    refreshFlag.textContent = "最近补证";
    node.querySelector(".project-top").appendChild(refreshFlag);
  }

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
    ["样本状态", hasEvidenceRefresh(project) ? `已收录 / 最近一次补证于 ${project.lastUpdated}` : "已收录"],
    ["商业化清晰度", `${evidenceLevelLabel[project.evidenceQuality.level]} / ${riskLabel[project.evidenceQuality.marketingRisk]}`],
    ...(getEvidenceGapLabel(project) ? [["待补证点", getEvidenceGapLabel(project)]] : []),
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

  const shortcutsSection = document.createElement("section");
  shortcutsSection.className = "detail-shortcuts";
  shortcutsSection.innerHTML = `<p class="detail-note-label">快速筛选</p>`;
  const shortcutActions = document.createElement("div");
  shortcutActions.className = "detail-shortcut-actions";

  [
    {
      label: "查看同场景项目",
      onClick: () => applyFocusedFilter({ scenario: summarizeScenario(project) }),
    },
    {
      label: "查看同形态项目",
      onClick: () => applyFocusedFilter({ form: project.productForm }),
    },
  ].forEach((shortcut) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "detail-shortcut-chip";
    button.textContent = shortcut.label;
    button.addEventListener("click", () => {
      shortcut.onClick();
      focusDetailPanel();
    });
    shortcutActions.appendChild(button);
  });
  shortcutsSection.appendChild(shortcutActions);
  node.appendChild(shortcutsSection);

  renderSourceLinks(node.querySelector(".source-links"), project.sources);

  const sameFormSection = document.createElement("section");
  sameFormSection.className = "related-section";
  sameFormSection.innerHTML = `
    <p class="detail-note-label">同形态项目</p>
    <div class="related-projects"></div>
  `;
  renderRelatedProjects(
    sameFormSection.querySelector(".related-projects"),
    getRelatedProjects(project, projects, "same-form"),
    "当前库里还没有更多同形态项目。"
  );
  node.appendChild(sameFormSection);

  const relatedSection = document.createElement("section");
  relatedSection.className = "related-section";
  relatedSection.innerHTML = `
    <p class="detail-note-label">同场景项目</p>
    <div class="related-projects"></div>
  `;
  renderRelatedProjects(
    relatedSection.querySelector(".related-projects"),
    getRelatedProjects(project, projects, "same-scenario"),
    "当前库里还没有更多同场景项目。"
  );
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
  refreshed: false,
  selectedProjectId: null,
};

const writeStateToUrl = () => {
  const params = new URLSearchParams();

  if (state.query) {
    params.set("q", state.query);
  }

  if (state.evidence !== "all") {
    params.set("evidence", state.evidence);
  }

  if (state.form !== "all") {
    params.set("form", state.form);
  }

  if (state.scenario !== "all") {
    params.set("scenario", state.scenario);
  }

  if (state.sort !== "discovered") {
    params.set("sort", state.sort);
  }

  if (state.refreshed) {
    params.set("refreshed", "1");
  }

  if (state.selectedProjectId) {
    params.set("project", state.selectedProjectId);
  }

  const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
};

const hydrateStateFromUrl = (projects) => {
  const params = new URLSearchParams(window.location.search);
  const scenarioOptions = new Set(["all", ...projects.map((project) => summarizeScenario(project))]);
  const formOptions = new Set(["all", ...projects.map((project) => project.productForm)]);
  const evidenceOptions = new Set(["all", "strong", "medium", "weak"]);
  const sortOptions = new Set(["discovered", "evidence", "name"]);
  const projectIds = new Set(projects.map((project) => project.id));

  state.query = params.get("q") ?? "";
  state.evidence = evidenceOptions.has(params.get("evidence")) ? params.get("evidence") : "all";
  state.form = formOptions.has(params.get("form")) ? params.get("form") : "all";
  state.scenario = scenarioOptions.has(params.get("scenario")) ? params.get("scenario") : "all";
  state.sort = sortOptions.has(params.get("sort")) ? params.get("sort") : "discovered";
  state.refreshed = params.get("refreshed") === "1";
  state.selectedProjectId = projectIds.has(params.get("project")) ? params.get("project") : null;
};

const fallbackCopyText = (value) => {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "absolute";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(input);
  return copied;
};

const flashCopyButton = (label) => {
  if (!copyViewLinkButton) {
    return;
  }

  copyViewLinkButton.textContent = label;
  window.clearTimeout(copyFeedbackTimer);
  copyFeedbackTimer = window.setTimeout(() => {
    copyViewLinkButton.textContent = "复制当前视图";
  }, 1800);
};

const copyCurrentViewLink = async () => {
  const value = window.location.href;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      flashCopyButton("已复制链接");
      return;
    }
  } catch (error) {
    // Fall through to the legacy copy path when clipboard access is unavailable.
  }

  const copied = fallbackCopyText(value);
  flashCopyButton(copied ? "已复制链接" : "复制失败");
};

const syncFilterControls = () => {
  searchInput.value = state.query;
  evidenceFilter.value = state.evidence;
  formFilter.value = state.form;
  scenarioFilter.value = state.scenario;
  sortFilter.value = state.sort;
  const strongCount = (window.__projectsCache__ ?? []).filter((project) => project.evidenceQuality.level === "strong").length;
  const mediumCount = (window.__projectsCache__ ?? []).filter((project) => project.evidenceQuality.level === "medium").length;
  const refreshedCount = (window.__projectsCache__ ?? []).filter((project) => hasEvidenceRefresh(project)).length;
  if (strongFilterButton) {
    strongFilterButton.textContent = `只看商业化清楚（${strongCount}）`;
  }
  if (mediumFilterButton) {
    mediumFilterButton.textContent = `只看待补证（${mediumCount}）`;
  }
  if (refreshFilterButton) {
    refreshFilterButton.textContent = `只看最近补证（${refreshedCount}）`;
  }

  const hasActiveFilter =
    state.query !== "" || state.evidence !== "all" || state.form !== "all" || state.scenario !== "all" || state.refreshed;
  resetFiltersButton.toggleAttribute("data-active", hasActiveFilter);
  strongFilterButton?.toggleAttribute("data-active", state.evidence === "strong");
  mediumFilterButton?.toggleAttribute("data-active", state.evidence === "medium");
  refreshFilterButton?.toggleAttribute("data-active", state.refreshed);
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
  const refreshedCount = projects.filter((project) => hasEvidenceRefresh(project)).length;
  const mediumNames = projects
    .filter((project) => project.evidenceQuality.level === "medium")
    .slice(0, 3)
    .map((project) => project.canonicalName);

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
    {
      label: "最近补证样本",
      scenario: null,
      refreshed: true,
      value: `${refreshedCount} 个`,
      note: "点击只看后来补强过证据的项目。",
    },
    {
      label: "待补证清单",
      scenario: null,
      evidence: "medium",
      value: `${mediumCount} 个`,
      note:
        mediumCount > 0
          ? `${mediumNames.join(" / ")}。点击只看这些边界样本。`
          : "当前结果里没有待补证样本。",
    },
  ];

  cards.forEach((card) => {
    const isInteractive = Boolean(card.scenario || card.refreshed || card.evidence);
    const element = document.createElement(isInteractive ? "button" : "article");
    element.className = "summary-card";
    if (isInteractive) {
      element.type = "button";
      const isActive = card.refreshed
        ? state.refreshed
        : card.evidence
          ? state.evidence === card.evidence
          : state.scenario === card.scenario;
      element.setAttribute("aria-pressed", String(isActive));
      if (isActive) {
        element.classList.add("summary-card-active");
      }
      element.addEventListener("click", () => {
        if (card.refreshed) {
          state.refreshed = !state.refreshed;
        } else if (card.evidence) {
          state.evidence = state.evidence === card.evidence ? "all" : card.evidence;
          evidenceFilter.value = state.evidence;
        } else {
          state.scenario = state.scenario === card.scenario ? "all" : card.scenario;
          scenarioFilter.value = state.scenario;
        }
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
  const counts = projects.reduce((accumulator, project) => {
    const scenario = summarizeScenario(project);
    accumulator.set(scenario, (accumulator.get(scenario) ?? 0) + 1);
    return accumulator;
  }, new Map());

  [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0], "zh-CN"))
    .forEach(([scenario, count]) => {
      const option = document.createElement("option");
      option.value = scenario;
      option.textContent = `${scenario} (${count})`;
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
  const matchesRefresh = !state.refreshed || hasEvidenceRefresh(project);
  return matchesQuery && matchesEvidence && matchesForm && matchesRefresh;
};

const projectMatches = (project) =>
  projectMatchesBase(project) &&
  (state.scenario === "all" || summarizeScenario(project) === state.scenario);

const renderResultsHint = (visibleProjects, allProjects) => {
  const filterNotes = [
    state.query ? `关键词：${state.query}` : null,
    state.evidence !== "all" ? `证据：${evidenceLevelLabel[state.evidence]}` : null,
    state.form !== "all" ? `形态：${state.form}` : null,
    state.scenario !== "all" ? `场景：${state.scenario}` : null,
    state.refreshed ? "状态：只看最近补证" : null,
    state.sort !== "discovered" ? `排序：${sortFilter.selectedOptions[0]?.textContent ?? state.sort}` : null,
  ].filter(Boolean);

  const suffix =
    filterNotes.length > 0 ? `当前筛选为 ${filterNotes.join(" / ")}。` : "当前为全量视图。";
  resultsHint.textContent = `当前命中 ${visibleProjects.length} / ${allProjects.length} 个项目。${suffix} 点击左侧卡片在右侧查看完整详情。`;
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
  syncFilterControls();
  writeStateToUrl();
};

const bootstrap = async () => {
  const response = await fetch(dataUrl);
  const { projects } = await response.json();
  window.__projectsCache__ = projects;
  populateFormFilter(projects);
  populateScenarioFilter(projects);
  hydrateStateFromUrl(projects);

  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderApp(projects);
  });

  evidenceFilter.addEventListener("change", (event) => {
    state.evidence = event.target.value;
    renderApp(projects);
  });

  strongFilterButton?.addEventListener("click", () => {
    state.evidence = state.evidence === "strong" ? "all" : "strong";
    renderApp(projects);
  });

  mediumFilterButton?.addEventListener("click", () => {
    state.evidence = state.evidence === "medium" ? "all" : "medium";
    renderApp(projects);
  });

  formFilter.addEventListener("change", (event) => {
    state.form = event.target.value;
    renderApp(projects);
  });

  refreshFilterButton?.addEventListener("click", () => {
    state.refreshed = !state.refreshed;
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

  resetFiltersButton.addEventListener("click", () => {
    state.query = "";
    state.evidence = "all";
    state.form = "all";
    state.scenario = "all";
    state.sort = "discovered";
    state.refreshed = false;
    renderApp(projects);
  });

  copyViewLinkButton?.addEventListener("click", () => {
    copyCurrentViewLink();
  });

  renderApp(projects);
};

bootstrap().catch((error) => {
  dailyFeed.innerHTML = `<p>数据加载失败：${error.message}</p>`;
});
