const { createApp, computed, ref, onMounted, onUnmounted, watch, nextTick } = Vue;

const dataUrl = "/api/projects";
const INITIAL_LIMIT = 36;

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

const readFlag = (key) => {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch (error) {
    return false;
  }
};

const writeFlag = (key, enabled) => {
  try {
    if (enabled) {
      window.localStorage.setItem(key, "1");
    } else {
      window.localStorage.removeItem(key);
    }
  } catch (error) {
    // Ignore storage failures.
  }
};

const shortList = (value, count = 2) =>
  (value || "未标注")
    .split("、")
    .filter(Boolean)
    .slice(0, count)
    .join("、") || "未标注";

const firstClause = (value) => (value || "未标注").split(/[，。；;]/)[0].trim() || "未标注";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "short",
      }).format(new Date(value))
    : "未标注";

const domainFromUrl = (value) => {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch (error) {
    return value;
  }
};

const hasEvidenceRefresh = (project) => Boolean(project.lastUpdated && project.firstSeen && project.lastUpdated > project.firstSeen);

const summarizeScenario = (project) => firstClause(project.painPoint);
const normalizeLookupKey = (value) => String(value || "").trim().toLowerCase();

const getEvidenceGapLabel = (project) => {
  if (!project || project.evidenceQuality.level === "strong") {
    return null;
  }

  const note = project.evidenceQuality.note || "";
  if (/(另一款产品|别的产品|错配|写成了|指向别的产品|正文实际对应)/.test(note)) return "官方链路错配";
  if (/(证书|SSL|hostname|Cloudflare|404|不可访问|无法稳定访问|不稳定官方面|根页.*404|不可稳定核验)/i.test(note)) return "官方面不可稳定核验";
  if (/(价格|定价|价格数字).*(不完整|不透明|较弱|不足|不稳定)/.test(note)) return "缺稳定价格面";
  if (/(企业|采购|报价|席位).*(弱|不透明|咨询)/.test(note)) return "缺公开套餐价";
  if (/(抓取|检索|获取|retriev)/i.test(note)) return "缺稳定可检索证据";
  return "缺更强商业化证据";
};

const buildCompactNote = (value, maxLength = 120) => {
  if (!value) {
    return { shortText: "暂无动态。", fullText: "暂无动态。", truncated: false };
  }

  const text = value.trim();
  if (text.length <= maxLength) {
    return { shortText: text, fullText: text, truncated: false };
  }

  return {
    shortText: `${text.slice(0, maxLength).trim()}…`,
    fullText: text,
    truncated: true,
  };
};

const buildPreviewText = (value, maxLength = 140) => {
  if (!value) {
    return { shortText: "未补充。", fullText: "未补充。", truncated: false };
  }

  const text = value.trim();
  if (text.length <= maxLength) {
    return { shortText: text, fullText: text, truncated: false };
  }

  return {
    shortText: `${text.slice(0, maxLength).trim()}…`,
    fullText: text,
    truncated: true,
  };
};

const buildEvidenceTimingLabel = (project) =>
  hasEvidenceRefresh(project) ? `最近补证 · ${project.lastUpdated}` : `首次挖掘 · ${project.firstSeen || "未标注"}`;

const buildCompareSnapshot = (currentProject, relatedProjects = []) => {
  if (!currentProject) {
    return null;
  }

  const compareProjects = [currentProject, ...relatedProjects.slice(0, 2)];
  if (compareProjects.length <= 1) {
    return null;
  }

  return {
    projects: compareProjects,
    rows: [
      {
        label: "产品",
        values: compareProjects.map((project) => ({ projectId: project.id, text: project.canonicalName })),
      },
      {
        label: "客群",
        values: compareProjects.map((project) => ({ projectId: project.id, text: shortList(project.targetCustomers, 2) })),
      },
      {
        label: "变现",
        values: compareProjects.map((project) => ({ projectId: project.id, text: firstClause(project.monetization) })),
      },
      {
        label: "商业化",
        values: compareProjects.map((project) => ({ projectId: project.id, text: evidenceLevelLabel[project.evidenceQuality.level] })),
      },
      {
        label: "证据时间",
        values: compareProjects.map((project) => ({ projectId: project.id, text: buildEvidenceTimingLabel(project) })),
      },
    ],
  };
};

const projectMatchesQuery = (project, query) => {
  if (!query) {
    return true;
  }

  const haystack = [
    project.canonicalName,
    ...(project.aliases || []),
    project.productForm,
    project.targetCustomers,
    project.painPoint,
    project.monetization,
    project.benchmarks?.join("、"),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
};

const sortProjects = (projects, sortMode) => {
  const copy = [...projects];

  if (sortMode === "refreshed") {
    copy.sort((left, right) => {
      const refreshDelta = Number(hasEvidenceRefresh(right)) - Number(hasEvidenceRefresh(left));
      if (refreshDelta !== 0) {
        return refreshDelta;
      }
      return String(right.lastUpdated || "").localeCompare(String(left.lastUpdated || ""));
    });
    return copy;
  }

  if (sortMode === "evidence") {
    const weight = { strong: 3, medium: 2, weak: 1 };
    copy.sort((left, right) => (weight[right.evidenceQuality.level] - weight[left.evidenceQuality.level]) || right.discoveredSeq - left.discoveredSeq);
    return copy;
  }

  if (sortMode === "name") {
    copy.sort((left, right) => left.canonicalName.localeCompare(right.canonicalName, "zh-CN"));
    return copy;
  }

  copy.sort((left, right) => right.discoveredSeq - left.discoveredSeq);
  return copy;
};

createApp({
  setup() {
    const projects = ref([]);
    const loading = ref(true);
    const error = ref("");
    const selectedProjectId = ref("");
    const feedLimit = ref(INITIAL_LIMIT);
    const listRef = ref(null);
    const detailViewRef = ref(null);
    const activeSection = ref("#browse-controls");
    const showScrollTop = ref(false);
    const copyViewLabel = ref("复制当前视图");
    const copyProjectLabel = ref("复制项目链接");
    const expandedFields = ref({ evidence: false, latestNote: false });
    let copyViewTimer = null;
    let copyProjectTimer = null;

    const filters = ref({
      view: "library",
      query: "",
      evidence: "all",
      mediumGap: "all",
      form: "all",
      scenario: "all",
      sort: "discovered",
      compareIds: [],
      usageDismissed: readFlag("ai-project-scout:usage-strip-dismissed"),
    });

    const projectLookup = computed(() => {
      const lookup = new Map();
      projects.value.forEach((project) => {
        [project.canonicalName, ...(project.aliases || [])].forEach((name) => {
          const key = normalizeLookupKey(name);
          if (key) {
            lookup.set(key, project);
          }
        });
      });
      return lookup;
    });

    const forms = computed(() =>
      [...new Set(projects.value.map((project) => project.productForm).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"))
    );
    const scenarios = computed(() =>
      [...new Set(projects.value.map((project) => summarizeScenario(project)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"))
    );

    const filteredProjects = computed(() => {
      const matched = projects.value.filter((project) => {
        const matchesEvidence = filters.value.evidence === "all" || project.evidenceQuality.level === filters.value.evidence;
        const matchesMediumGap =
          filters.value.mediumGap === "all" ||
          (project.evidenceQuality.level === "medium" && getEvidenceGapLabel(project) === filters.value.mediumGap);
        const matchesForm = filters.value.form === "all" || project.productForm === filters.value.form;
        const matchesScenario = filters.value.scenario === "all" || summarizeScenario(project) === filters.value.scenario;
        const matchesCompare = !filters.value.compareIds.length || filters.value.compareIds.includes(project.id);
        return (
          matchesEvidence &&
          matchesMediumGap &&
          matchesForm &&
          matchesScenario &&
          matchesCompare &&
          projectMatchesQuery(project, filters.value.query)
        );
      });

      return sortProjects(matched, filters.value.sort);
    });

    const visibleProjects = computed(() => filteredProjects.value.slice(0, feedLimit.value));
    const visibleEntries = computed(() => {
      const entries = filteredProjects.value.flatMap((project) =>
        (project.dailyNotes || []).map((note) => ({
          ...note,
          projectId: project.id,
          canonicalName: project.canonicalName,
          productForm: project.productForm,
          project,
        }))
      );

      entries.sort((left, right) => {
        const dateDelta = String(right.date || "").localeCompare(String(left.date || ""));
        if (dateDelta !== 0) {
          return dateDelta;
        }
        return right.project.discoveredSeq - left.project.discoveredSeq;
      });

      return entries.slice(0, feedLimit.value);
    });

    const selectedProject = computed(
      () => filteredProjects.value.find((project) => project.id === selectedProjectId.value) || filteredProjects.value[0] || null
    );

    const evidencePreview = computed(() => buildPreviewText(selectedProject.value?.evidenceQuality?.note || "", 160));
    const latestNotePreview = computed(() => buildPreviewText(selectedProject.value?.dailyNotes?.[0]?.update || "", 160));

    const summary = computed(() => {
      const scoped = filteredProjects.value;
      return {
        total: scoped.length,
        all: projects.value.length,
        strong: scoped.filter((project) => project.evidenceQuality.level === "strong").length,
        medium: scoped.filter((project) => project.evidenceQuality.level === "medium").length,
        active: scoped.filter((project) => project.status === "active").length,
      };
    });

    const heroMetrics = computed(() => {
      const allEntries = projects.value.flatMap((project) => project.dailyNotes || []);
      const newestDay = [...new Set(allEntries.map((entry) => entry.date))].sort().at(-1);
      const newestCount = newestDay ? allEntries.filter((entry) => entry.date === newestDay).length : 0;
      return [
        { value: String(projects.value.length).padStart(2, "0"), label: "已整理项目" },
        { value: String(newestCount).padStart(2, "0"), label: "当日动态" },
        { value: String(projects.value.filter((project) => project.status === "active").length).padStart(2, "0"), label: "活跃样本" },
        { value: String(projects.value.filter((project) => project.evidenceQuality.level === "strong").length).padStart(2, "0"), label: "商业化清楚" },
      ];
    });

    const mediumGapCards = computed(() => {
      const counts = projects.value
        .filter((project) => project.evidenceQuality.level === "medium")
        .reduce((map, project) => {
          const gap = getEvidenceGapLabel(project);
          if (!gap) return map;
          map[gap] = (map[gap] || 0) + 1;
          return map;
        }, {});

      return Object.entries(counts)
        .sort((left, right) => right[1] - left[1])
        .map(([gap, count]) => ({
          key: gap,
          label: gap,
          value: `${count} 个`,
          active: filters.value.mediumGap === gap,
          onClick: () => {
            filters.value.evidence = "medium";
            filters.value.mediumGap = filters.value.mediumGap === gap ? "all" : gap;
          },
        }));
    });

    const overviewCards = computed(() => {
      const scoped = filteredProjects.value;
      const scenarioCounts = scoped.reduce((map, project) => {
        const key = summarizeScenario(project);
        map[key] = (map[key] || 0) + 1;
        return map;
      }, {});

      const topScenarios = Object.entries(scenarioCounts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 2);

      return [
        {
          key: "top-scenario-1",
          label: "当前最密集场景",
          value: topScenarios[0] ? `${topScenarios[0][0]} · ${topScenarios[0][1]}个` : "暂无",
          active: topScenarios[0] ? filters.value.scenario === topScenarios[0][0] : false,
          onClick: topScenarios[0]
            ? () => {
                filters.value.scenario = filters.value.scenario === topScenarios[0][0] ? "all" : topScenarios[0][0];
              }
            : null,
        },
        {
          key: "top-scenario-2",
          label: "第二密集场景",
          value: topScenarios[1] ? `${topScenarios[1][0]} · ${topScenarios[1][1]}个` : "暂无",
          active: topScenarios[1] ? filters.value.scenario === topScenarios[1][0] : false,
          onClick: topScenarios[1]
            ? () => {
                filters.value.scenario = filters.value.scenario === topScenarios[1][0] ? "all" : topScenarios[1][0];
              }
            : null,
        },
        {
          key: "strong",
          label: "商业化清楚",
          value: `${summary.value.strong} 个`,
          active: filters.value.evidence === "strong",
          onClick: () => {
            filters.value.evidence = filters.value.evidence === "strong" ? "all" : "strong";
          },
        },
        {
          key: "medium",
          label: "待补证",
          value: `${summary.value.medium} 个`,
          active: filters.value.evidence === "medium",
          onClick: () => {
            filters.value.evidence = filters.value.evidence === "medium" ? "all" : "medium";
          },
        },
      ];
    });

    const resultHint = computed(() => {
      if (filters.value.view === "library") {
        return `当前命中 ${filteredProjects.value.length} / ${projects.value.length} 个项目，已展示 ${visibleProjects.value.length} 个。左侧点项目，右侧看完整详情。`;
      }

      return `当前命中 ${filteredProjects.value.length} / ${projects.value.length} 个项目，已展示 ${visibleEntries.value.length} 条动态。左侧点项目，右侧看完整详情。`;
    });

    const emptyState = computed(() => {
      const title = filters.value.view === "library" ? "当前筛选下没有匹配的项目。" : "当前筛选下没有匹配的动态。";
      const actions = [
        {
          label: "清空筛选",
          secondary: false,
          onClick: () => {
            resetFilters();
          },
        },
      ];

      if (filters.value.compareIds.length) {
        actions.push({
          label: "退出对标视图",
          secondary: true,
          onClick: () => {
            filters.value.compareIds = [];
          },
        });
      }

      if (filters.value.mediumGap !== "all") {
        actions.push({
          label: "退出同类缺口",
          secondary: true,
          onClick: () => {
            filters.value.mediumGap = "all";
          },
        });
      }

      if (filters.value.view === "updates") {
        actions.push({
          label: "切到项目总表",
          secondary: true,
          onClick: () => {
            filters.value.view = "library";
          },
        });
      }

      const noteParts = [];
      if (filters.value.compareIds.length) noteParts.push("当前处在对标视图");
      if (filters.value.mediumGap !== "all") noteParts.push(`当前只看 ${filters.value.mediumGap}`);
      if (filters.value.view === "updates") noteParts.push("当前是动态流模式");
      if (noteParts.length === 0) noteParts.push("可以先清空筛选，重新缩小范围");

      return {
        title,
        note: noteParts.join("，") + "。",
        actions,
      };
    });

    const loadMoreLabel = computed(() => {
      if (filters.value.view === "library") {
        const remaining = Math.max(filteredProjects.value.length - visibleProjects.value.length, 0);
        return remaining > 0 ? `加载更多（剩余 ${remaining} 个项目）` : "加载更多";
      }

      const totalEntries = filteredProjects.value.reduce((count, project) => count + (project.dailyNotes?.length || 0), 0);
      const remaining = Math.max(totalEntries - visibleEntries.value.length, 0);
      return remaining > 0 ? `加载更多（剩余 ${remaining} 条动态）` : "加载更多";
    });

    const activeFilterChips = computed(() => {
      const chips = [];

      if (filters.value.query) {
        chips.push({
          key: "query",
          label: `关键词：${filters.value.query}`,
          clear: () => {
            filters.value.query = "";
          },
        });
      }

      if (filters.value.evidence !== "all") {
        chips.push({
          key: "evidence",
          label: `证据：${evidenceLevelLabel[filters.value.evidence]}`,
          clear: () => {
            filters.value.evidence = "all";
            filters.value.mediumGap = "all";
          },
        });
      }

      if (filters.value.mediumGap !== "all") {
        chips.push({
          key: "medium-gap",
          label: `待补证分组：${filters.value.mediumGap}`,
          clear: () => {
            filters.value.mediumGap = "all";
          },
        });
      }

      if (filters.value.form !== "all") {
        chips.push({
          key: "form",
          label: `形态：${filters.value.form}`,
          clear: () => {
            filters.value.form = "all";
          },
        });
      }

      if (filters.value.scenario !== "all") {
        chips.push({
          key: "scenario",
          label: `场景：${filters.value.scenario}`,
          clear: () => {
            filters.value.scenario = "all";
          },
        });
      }

      if (filters.value.sort !== "discovered") {
        const sortLabel =
          {
            refreshed: "最近补证优先",
            evidence: "证据强度优先",
            name: "名称 A-Z",
          }[filters.value.sort] || filters.value.sort;
        chips.push({
          key: "sort",
          label: `排序：${sortLabel}`,
          clear: () => {
            filters.value.sort = "discovered";
          },
        });
      }

      if (filters.value.compareIds.length) {
        const names = projects.value
          .filter((project) => filters.value.compareIds.includes(project.id))
          .map((project) => project.canonicalName);
        chips.push({
          key: "compare",
          label: `对标：${names.slice(0, 3).join(" / ")}${names.length > 3 ? " 等" : ""}`,
          clear: () => {
            filters.value.compareIds = [];
          },
        });
      }

      return chips;
    });

    const selectedIndex = computed(() => {
      const index = filteredProjects.value.findIndex((project) => project.id === selectedProjectId.value);
      return index >= 0 ? index : 0;
    });

    const selectedStatusChips = computed(() => {
      if (!selectedProject.value) {
        return [];
      }

      const project = selectedProject.value;
      const chips = [];
      chips.push(hasEvidenceRefresh(project) ? `最近补证 · ${project.lastUpdated}` : `首次挖掘 · ${project.firstSeen || "未标注"}`);
      chips.push(`证据 · ${evidenceLevelLabel[project.evidenceQuality.level]}`);
      chips.push(`场景 · ${summarizeScenario(project)}`);
      return chips;
    });

    const selectedGapLabel = computed(() => getEvidenceGapLabel(selectedProject.value));

    const sameGapQueue = computed(() => {
      if (!selectedProject.value || !selectedGapLabel.value) {
        return [];
      }

      return projects.value
        .filter((project) => project.evidenceQuality.level === "medium" && getEvidenceGapLabel(project) === selectedGapLabel.value)
        .sort((left, right) => right.discoveredSeq - left.discoveredSeq);
    });

    const sameGapIndex = computed(() => {
      if (!selectedProject.value || !sameGapQueue.value.length) {
        return -1;
      }

      return sameGapQueue.value.findIndex((project) => project.id === selectedProject.value.id);
    });

    const selectedContextChips = computed(() => {
      if (!selectedProject.value) {
        return [];
      }

      const chips = [];
      if (filters.value.compareIds.length) {
        const names = projects.value
          .filter((project) => filters.value.compareIds.includes(project.id))
          .map((project) => project.canonicalName);
        chips.push(`当前对标 · ${names.slice(0, 3).join(" / ")}${names.length > 3 ? " 等" : ""}`);
      }

      if (selectedGapLabel.value) {
        chips.push(`待补证 · ${selectedGapLabel.value}`);
      }

      if (sameGapQueue.value.length && sameGapIndex.value >= 0) {
        chips.push(`同类缺口 · ${sameGapIndex.value + 1}/${sameGapQueue.value.length}`);
      }

      return chips;
    });

    const sameFormRelated = computed(() => {
      if (!selectedProject.value) {
        return [];
      }

      return filteredProjects.value
        .filter((project) => project.id !== selectedProject.value.id && project.productForm === selectedProject.value.productForm)
        .slice(0, 3);
    });

    const sameFormStats = computed(() => {
      if (!selectedProject.value) {
        return { total: 0, strong: 0 };
      }

      const scoped = projects.value.filter(
        (project) => project.id !== selectedProject.value.id && project.productForm === selectedProject.value.productForm
      );
      return {
        total: scoped.length,
        strong: scoped.filter((project) => project.evidenceQuality.level === "strong").length,
      };
    });

    const sameScenarioRelated = computed(() => {
      if (!selectedProject.value) {
        return [];
      }

      const currentScenario = summarizeScenario(selectedProject.value);
      return filteredProjects.value
        .filter((project) => project.id !== selectedProject.value.id && summarizeScenario(project) === currentScenario)
        .slice(0, 3);
    });

    const sameScenarioStats = computed(() => {
      if (!selectedProject.value) {
        return { total: 0, strong: 0 };
      }

      const currentScenario = summarizeScenario(selectedProject.value);
      const scoped = projects.value.filter(
        (project) => project.id !== selectedProject.value.id && summarizeScenario(project) === currentScenario
      );
      return {
        total: scoped.length,
        strong: scoped.filter((project) => project.evidenceQuality.level === "strong").length,
      };
    });

    const selectedBenchmarkLinks = computed(() => {
      if (!selectedProject.value) {
        return [];
      }

      return (selectedProject.value.benchmarks || []).map((benchmark) => {
        const matchedProject = projectLookup.value.get(normalizeLookupKey(benchmark)) || null;
        return { label: benchmark, matchedProject };
      });
    });

    const matchedBenchmarkProjects = computed(() =>
      selectedBenchmarkLinks.value.map((item) => item.matchedProject).filter(Boolean)
    );

    const sameFormSnapshot = computed(() => buildCompareSnapshot(selectedProject.value, sameFormRelated.value));
    const benchmarkSnapshot = computed(() => buildCompareSnapshot(selectedProject.value, matchedBenchmarkProjects.value));

    const selectedScenarioStats = computed(() => {
      if (!selectedProject.value) {
        return null;
      }

      const scenario = summarizeScenario(selectedProject.value);
      const scoped = projects.value.filter((project) => summarizeScenario(project) === scenario);
      return {
        total: scoped.length,
        strong: scoped.filter((project) => project.evidenceQuality.level === "strong").length,
        medium: scoped.filter((project) => project.evidenceQuality.level === "medium").length,
      };
    });

    const ensureSelection = () => {
      if (!filteredProjects.value.length) {
        selectedProjectId.value = "";
        return;
      }

      if (!filteredProjects.value.some((project) => project.id === selectedProjectId.value)) {
        selectedProjectId.value = filteredProjects.value[0].id;
      }
    };

    const syncUrl = () => {
      const params = new URLSearchParams();
      if (filters.value.view !== "library") params.set("view", filters.value.view);
      if (filters.value.query) params.set("q", filters.value.query);
      if (filters.value.evidence !== "all") params.set("evidence", filters.value.evidence);
      if (filters.value.mediumGap !== "all") params.set("gap", filters.value.mediumGap);
      if (filters.value.form !== "all") params.set("form", filters.value.form);
      if (filters.value.scenario !== "all") params.set("scenario", filters.value.scenario);
      if (filters.value.sort !== "discovered") params.set("sort", filters.value.sort);
      if (filters.value.compareIds.length) params.set("compare", filters.value.compareIds.join(","));
      if (selectedProjectId.value) params.set("project", selectedProjectId.value);
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    };

    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      filters.value.view = params.get("view") || "library";
      filters.value.query = params.get("q") || "";
      filters.value.evidence = params.get("evidence") || "all";
      filters.value.mediumGap = params.get("gap") || "all";
      filters.value.form = params.get("form") || "all";
      filters.value.scenario = params.get("scenario") || "all";
      filters.value.sort = params.get("sort") || "discovered";
      filters.value.compareIds = (params.get("compare") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      selectedProjectId.value = params.get("project") || "";
    };

    const resetFilters = () => {
      filters.value.view = "library";
      filters.value.query = "";
      filters.value.evidence = "all";
      filters.value.mediumGap = "all";
      filters.value.form = "all";
      filters.value.scenario = "all";
      filters.value.sort = "discovered";
      filters.value.compareIds = [];
      feedLimit.value = INITIAL_LIMIT;
    };

    const dismissUsage = () => {
      filters.value.usageDismissed = true;
      writeFlag("ai-project-scout:usage-strip-dismissed", true);
    };

    const selectProject = async (projectId) => {
      selectedProjectId.value = projectId;
      syncUrl();
      await nextTick();
      const node = listRef.value?.querySelector(`[data-project-id="${projectId}"]`);
      node?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const moveSelection = (delta) => {
      if (!filteredProjects.value.length) {
        return;
      }
      const nextIndex = Math.max(0, Math.min(filteredProjects.value.length - 1, selectedIndex.value + delta));
      selectProject(filteredProjects.value[nextIndex].id);
    };

    const copyProjectLink = async () => {
      if (!selectedProjectId.value) return;
      syncUrl();
      await navigator.clipboard.writeText(window.location.href);
      copyProjectLabel.value = "已复制项目链接";
      window.clearTimeout(copyProjectTimer);
      copyProjectTimer = window.setTimeout(() => {
        copyProjectLabel.value = "复制项目链接";
      }, 1800);
    };

    const copyCurrentView = async () => {
      syncUrl();
      await navigator.clipboard.writeText(window.location.href);
      copyViewLabel.value = "已复制当前视图";
      window.clearTimeout(copyViewTimer);
      copyViewTimer = window.setTimeout(() => {
        copyViewLabel.value = "复制当前视图";
      }, 1800);
    };

    const focusCluster = (mode, onlyStrong = false) => {
      if (!selectedProject.value) {
        return;
      }

      filters.value.view = "library";
      filters.value.query = "";
      filters.value.compareIds = [];
      filters.value.evidence = onlyStrong ? "strong" : "all";
      filters.value.mediumGap = "all";
      feedLimit.value = INITIAL_LIMIT;

      if (mode === "form") {
        filters.value.form = selectedProject.value.productForm;
        filters.value.scenario = "all";
      } else if (mode === "scenario") {
        filters.value.scenario = summarizeScenario(selectedProject.value);
        filters.value.form = "all";
      }
    };

    const activateBenchmarkCompare = () => {
      if (!selectedProject.value) {
        return;
      }

      const matchedIds = selectedBenchmarkLinks.value
        .map((item) => item.matchedProject?.id)
        .filter(Boolean);

      filters.value.view = "library";
      filters.value.query = "";
      filters.value.compareIds = [selectedProject.value.id, ...matchedIds];
      filters.value.mediumGap = "all";
      feedLimit.value = INITIAL_LIMIT;
    };

    const focusSameGap = () => {
      if (!selectedProject.value || !selectedGapLabel.value) {
        return;
      }

      filters.value.view = "library";
      filters.value.query = "";
      filters.value.evidence = "medium";
      filters.value.mediumGap = selectedGapLabel.value;
      filters.value.form = "all";
      filters.value.scenario = "all";
      filters.value.sort = "discovered";
      filters.value.compareIds = [];
      feedLimit.value = INITIAL_LIMIT;
    };

    const moveSameGapSelection = (delta) => {
      if (!sameGapQueue.value.length || sameGapIndex.value < 0) {
        return;
      }

      const nextIndex = Math.max(0, Math.min(sameGapQueue.value.length - 1, sameGapIndex.value + delta));
      selectProject(sameGapQueue.value[nextIndex].id);
    };

    const syncScrollUi = () => {
      const sections = ["#browse-controls", "#project-list", "#project-detail"];
      let nextActive = sections[0];
      sections.forEach((selector) => {
        const node = document.querySelector(selector);
        if (!node) return;
        const rect = node.getBoundingClientRect();
        if (rect.top <= 140) {
          nextActive = selector;
        }
      });
      activeSection.value = nextActive;
      showScrollTop.value = window.scrollY > 640;
    };

    const groupedEntries = computed(() => {
      const grouped = [];
      let current = null;

      visibleEntries.value.forEach((entry) => {
        if (!current || current.date !== entry.date) {
          current = { date: entry.date, title: formatDate(entry.date), items: [] };
          grouped.push(current);
        }
        current.items.push(entry);
      });

      return grouped;
    });

    watch(
      () => [filters.value.view, filters.value.query, filters.value.evidence, filters.value.mediumGap, filters.value.form, filters.value.scenario, filters.value.sort, filters.value.compareIds.join(",")],
      () => {
        feedLimit.value = INITIAL_LIMIT;
        ensureSelection();
        syncUrl();
      }
    );

    watch(filteredProjects, () => {
      ensureSelection();
    });

    watch(selectedProjectId, async () => {
      expandedFields.value = { evidence: false, latestNote: false };
      copyProjectLabel.value = "复制项目链接";
      window.clearTimeout(copyProjectTimer);
      await nextTick();
      if (detailViewRef.value) {
        detailViewRef.value.scrollTop = 0;
      }
    });

    onMounted(async () => {
      window.addEventListener("scroll", syncScrollUi, { passive: true });
      syncScrollUi();
      syncFromUrl();
      try {
        const response = await fetch(dataUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        projects.value = payload.projects || [];
        ensureSelection();
        syncUrl();
      } catch (fetchError) {
        error.value = fetchError.message;
      } finally {
        loading.value = false;
      }
    });

    onUnmounted(() => {
      window.removeEventListener("scroll", syncScrollUi);
      window.clearTimeout(copyViewTimer);
      window.clearTimeout(copyProjectTimer);
    });

    return {
      loading,
      error,
      projects,
      filters,
      forms,
      scenarios,
      filteredProjects,
      visibleProjects,
      groupedEntries,
      selectedProject,
      selectedIndex,
      summary,
      heroMetrics,
      mediumGapCards,
      overviewCards,
      resultHint,
      loadMoreLabel,
      emptyState,
      activeFilterChips,
      selectedStatusChips,
      selectedContextChips,
      selectedGapLabel,
      evidencePreview,
      latestNotePreview,
      expandedFields,
      sameGapQueue,
      sameGapIndex,
      sameFormRelated,
      sameFormStats,
      sameScenarioRelated,
      sameScenarioStats,
      selectedBenchmarkLinks,
      matchedBenchmarkProjects,
      sameFormSnapshot,
      benchmarkSnapshot,
      selectedScenarioStats,
      listRef,
      detailViewRef,
      evidenceLevelLabel,
      riskLabel,
      getEvidenceGapLabel,
      shortList,
      firstClause,
      formatDate,
      hasEvidenceRefresh,
      domainFromUrl,
      buildCompactNote,
      buildPreviewText,
      dismissUsage,
      selectProject,
      moveSelection,
      resetFilters,
      copyProjectLink,
      copyProjectLabel,
      copyViewLabel,
      copyCurrentView,
      focusCluster,
      activateBenchmarkCompare,
      focusSameGap,
      moveSameGapSelection,
      activeSection,
      showScrollTop,
      loadMore: () => {
        feedLimit.value += INITIAL_LIMIT;
      },
      scrollToTop: () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    };
  },
  template: `
    <div class="page-shell">
      <header class="hero">
        <div class="hero-copy">
          <p class="eyebrow">AI Project Scout</p>
          <h1>每天只看真正有变现路径的新 AI Project</h1>
          <p class="hero-text">聚焦中国市场，记录项目名称、产品形态、目标客群、痛点、变现模式、技术与合规门槛，并对每日新增做去重整理。</p>
        </div>
        <div class="hero-metrics">
          <article v-for="metric in heroMetrics" :key="metric.label" class="metric-card">
            <span class="metric-value">{{ metric.value }}</span>
            <span class="metric-label">{{ metric.label }}</span>
          </article>
        </div>
      </header>

      <nav class="page-nav" aria-label="页面导航">
        <a class="page-nav-link" :data-active="activeSection === '#browse-controls' || null" href="#browse-controls">浏览总览</a>
        <a class="page-nav-link" :data-active="activeSection === '#project-list' || null" href="#project-list">项目列表</a>
        <a class="page-nav-link" :data-active="activeSection === '#project-detail' || null" href="#project-detail">项目详情</a>
      </nav>

      <div v-if="!filters.usageDismissed" class="usage-strip" aria-label="使用方式">
        <div class="usage-steps">
          <span class="usage-step">1. 先选项目总表或动态流</span>
          <span class="usage-step">2. 再用筛选缩小范围</span>
          <span class="usage-step">3. 最后在右侧看完整详情</span>
        </div>
        <button class="usage-dismiss" type="button" @click="dismissUsage">知道了</button>
      </div>

      <main class="layout">
        <section class="panel panel-main">
          <div id="browse-controls" class="panel-main-top">
            <div class="panel-heading">
              <div>
                <p class="panel-label">{{ filters.view === 'library' ? '项目浏览' : '动态浏览' }}</p>
                <h2>{{ filters.view === 'library' ? '项目总表' : '每日新增与更新' }}</h2>
              </div>
              <p class="panel-hint">{{ filters.view === 'library' ? '适合大样本库浏览，每个项目只显示一次。' : '适合复查最近新增与补证。' }}</p>
            </div>

            <div class="control-group">
              <p class="control-group-label">浏览模式</p>
              <div class="view-switch" role="tablist" aria-label="浏览模式">
                <button class="view-switch-button" type="button" :data-active="filters.view === 'library' || null" @click="filters.view = 'library'">项目总表</button>
                <button class="view-switch-button" type="button" :data-active="filters.view === 'updates' || null" @click="filters.view = 'updates'">动态流</button>
              </div>
            </div>

            <div class="control-group">
              <p class="control-group-label">筛选条件</p>
              <div class="filters">
                <label class="filter-field filter-field-search">
                  <span>搜索项目</span>
                  <input v-model.trim="filters.query" type="search" placeholder="输入项目名、别名、客群或对标" />
                </label>
                <label class="filter-field">
                  <span>证据等级</span>
                  <select v-model="filters.evidence">
                    <option value="all">全部</option>
                    <option value="strong">强证据</option>
                    <option value="medium">中证据</option>
                    <option value="weak">弱证据</option>
                  </select>
                </label>
                <label class="filter-field">
                  <span>产品形态</span>
                  <select v-model="filters.form">
                    <option value="all">全部</option>
                    <option v-for="form in forms" :key="form" :value="form">{{ form }}</option>
                  </select>
                </label>
                <label class="filter-field">
                  <span>工作流场景</span>
                  <select v-model="filters.scenario">
                    <option value="all">全部</option>
                    <option v-for="scenario in scenarios" :key="scenario" :value="scenario">{{ scenario }}</option>
                  </select>
                </label>
                <label class="filter-field">
                  <span>排序方式</span>
                  <select v-model="filters.sort">
                    <option value="discovered">最新挖掘优先</option>
                    <option value="refreshed">最近补证优先</option>
                    <option value="evidence">证据强度优先</option>
                    <option value="name">名称 A-Z</option>
                  </select>
                </label>
              </div>
              <div class="filters-actions">
                <button class="filters-reset" type="button" @click="resetFilters">清空筛选</button>
              </div>
            </div>

            <div class="control-group">
              <p class="control-group-label">结构概览</p>
              <p class="results-hint">{{ resultHint }}</p>
              <div class="filters-actions filters-actions-compact">
                <button class="filters-reset filters-secondary" type="button" @click="copyCurrentView">{{ copyViewLabel }}</button>
              </div>
              <div v-if="activeFilterChips.length" class="active-filters">
                <button
                  v-for="chip in activeFilterChips"
                  :key="chip.key"
                  type="button"
                  class="active-filter-chip"
                  @click="chip.clear"
                >
                  <span>{{ chip.label }}</span>
                  <strong>清除</strong>
                </button>
              </div>
              <details class="overview-disclosure">
                <summary class="overview-disclosure-summary">查看样本结构概览</summary>
                <div class="summary-strip">
                  <article class="summary-card">
                    <span class="summary-label">当前结果</span>
                    <strong class="summary-value">{{ summary.total }} / {{ summary.all }}</strong>
                  </article>
                  <component
                    :is="card.onClick ? 'button' : 'article'"
                    v-for="card in overviewCards"
                    :key="card.key"
                    class="summary-card"
                    :class="{ 'summary-card-active': card.active }"
                    :aria-pressed="card.onClick ? String(card.active) : null"
                    :type="card.onClick ? 'button' : null"
                    @click="card.onClick && card.onClick()"
                  >
                    <span class="summary-label">{{ card.label }}</span>
                    <strong class="summary-value">{{ card.value }}</strong>
                  </component>
                  <component
                    :is="'button'"
                    v-for="card in mediumGapCards"
                    :key="'gap-' + card.key"
                    class="summary-card"
                    :class="{ 'summary-card-active': card.active }"
                    :aria-pressed="String(card.active)"
                    type="button"
                    @click="card.onClick()"
                  >
                    <span class="summary-label">{{ card.label }}</span>
                    <strong class="summary-value">{{ card.value }}</strong>
                  </component>
                </div>
              </details>
            </div>
          </div>

          <div id="project-list" ref="listRef" class="daily-feed">
            <div v-if="loading" class="feed-empty-state">
              <p class="feed-empty-title">正在加载项目数据。</p>
            </div>

            <div v-else-if="error" class="feed-empty-state">
              <p class="feed-empty-title">数据加载失败。</p>
              <p class="feed-empty-note">{{ error }}</p>
            </div>

            <template v-else-if="filters.view === 'library' && visibleProjects.length">
              <button
                v-for="project in visibleProjects"
                :key="project.id"
                class="feed-item feed-card feed-card-compact"
                type="button"
                :data-project-id="project.id"
                :aria-pressed="String(selectedProject && project.id === selectedProject.id)"
                @click="selectProject(project.id)"
              >
                <div class="feed-item-top">
                  <div>
                    <p class="feed-type">{{ hasEvidenceRefresh(project) ? '最近补证' : '项目总表' }}</p>
                    <h4 class="feed-name">{{ project.canonicalName }}</h4>
                  </div>
                  <span class="feed-tag">{{ project.productForm }}</span>
                </div>
                <p class="feed-summary">面向{{ shortList(project.targetCustomers, 1) }}，解决{{ firstClause(project.painPoint) }}。</p>
                <div class="feed-meta feed-meta-compact">
                  <span class="feed-pill">证据：{{ evidenceLevelLabel[project.evidenceQuality.level] }}</span>
                  <span class="feed-pill">场景：{{ firstClause(project.painPoint) }}</span>
                  <span class="feed-pill">{{ hasEvidenceRefresh(project) ? '最近补证' : '首次挖掘' }}</span>
                </div>
              </button>
            </template>

            <template v-else-if="filters.view === 'updates' && groupedEntries.length">
              <article v-for="group in groupedEntries" :key="group.date" class="day-card">
                <div class="day-header">
                  <div>
                    <p class="day-date">{{ group.date }}</p>
                    <h3 class="day-title">{{ group.title }}</h3>
                  </div>
                  <span class="day-count">{{ group.items.length }} 条</span>
                </div>
                <div class="day-items">
                  <button
                    v-for="entry in group.items"
                    :key="entry.projectId + entry.date + entry.kind"
                    class="feed-item feed-card"
                    type="button"
                    :data-project-id="entry.projectId"
                    @click="selectProject(entry.projectId)"
                  >
                    <div class="feed-item-top">
                      <div>
                        <p class="feed-type">{{ entry.kind }}</p>
                        <h4 class="feed-name">{{ entry.canonicalName }}</h4>
                      </div>
                      <span class="feed-tag">{{ entry.productForm }}</span>
                    </div>
                    <p class="feed-summary">{{ entry.summary }}</p>
                  </button>
                </div>
              </article>
            </template>

            <div v-else class="feed-empty-state">
              <p class="feed-empty-title">{{ emptyState.title }}</p>
              <p class="feed-empty-note">{{ emptyState.note }}</p>
              <div class="feed-empty-actions">
                <button
                  v-for="action in emptyState.actions"
                  :key="action.label"
                  class="feed-empty-action"
                  :class="{ 'feed-empty-action-secondary': action.secondary }"
                  type="button"
                  @click="action.onClick"
                >
                  {{ action.label }}
                </button>
              </div>
            </div>
          </div>

          <div class="feed-actions" v-if="!loading && !error">
            <button
              v-if="(filters.view === 'library' && visibleProjects.length < filteredProjects.length) || (filters.view === 'updates' && groupedEntries.length)"
              class="filters-reset filters-secondary"
              type="button"
              @click="loadMore"
            >
              {{ loadMoreLabel }}
            </button>
          </div>
        </section>

        <aside id="project-detail" class="panel panel-side panel-sticky">
          <div class="panel-heading">
            <div>
              <p class="panel-label">项目详情</p>
              <h2>项目详情</h2>
            </div>
            <p class="panel-hint">先在左侧选项目，再在这里看完整信息。</p>
          </div>

          <div v-if="!selectedProject" class="detail-empty">
            <p class="feed-empty-title">当前筛选结果里还没有可展示的项目。</p>
            <p class="feed-empty-note">{{ emptyState.note }}</p>
            <div class="feed-empty-actions">
              <button
                v-for="action in emptyState.actions"
                :key="'detail-' + action.label"
                class="feed-empty-action"
                :class="{ 'feed-empty-action-secondary': action.secondary }"
                type="button"
                @click="action.onClick"
              >
                {{ action.label }}
              </button>
            </div>
          </div>

          <div v-else ref="detailViewRef" class="detail-view">
            <article class="detail-card">
              <div class="detail-header">
                <div class="project-top">
                  <div>
                    <p class="project-form">{{ selectedProject.productForm }}</p>
                    <h3 class="project-name">{{ selectedProject.canonicalName }}</h3>
                  </div>
                  <span class="project-status">{{ evidenceLevelLabel[selectedProject.evidenceQuality.level] }}</span>
                </div>
                <div class="detail-header-nav">
                  <button class="detail-nav-chip" type="button" :disabled="selectedIndex === 0" @click="moveSelection(-1)">上一个结果</button>
                  <span class="detail-nav-chip detail-nav-chip-static">当前结果 {{ filteredProjects.length ? selectedIndex + 1 : 0 }} / {{ filteredProjects.length }}</span>
                  <button class="detail-nav-chip" type="button" :disabled="selectedIndex >= filteredProjects.length - 1" @click="moveSelection(1)">下一个结果</button>
                  <button class="detail-nav-chip" type="button" @click="copyProjectLink">{{ copyProjectLabel }}</button>
                </div>
                <div class="detail-header-status">
                  <span v-for="chip in selectedStatusChips" :key="chip" class="feed-pill">{{ chip }}</span>
                  <span v-for="chip in selectedContextChips" :key="'context-' + chip" class="feed-pill">{{ chip }}</span>
                </div>
              </div>

              <p class="detail-intro">面向{{ shortList(selectedProject.targetCustomers, 2) }}，解决{{ firstClause(selectedProject.painPoint) }}。</p>

              <div class="project-detail-sections">
                <section class="detail-section">
                  <h4 class="detail-section-title">核心画像</h4>
                  <dl class="project-detail-list">
                    <div class="detail-row">
                      <dt>目标客群</dt>
                      <dd>{{ selectedProject.targetCustomers }}</dd>
                    </div>
                    <div class="detail-row">
                      <dt>核心痛点</dt>
                      <dd>{{ selectedProject.painPoint }}</dd>
                    </div>
                    <div class="detail-row">
                      <dt>变现模式</dt>
                      <dd>{{ selectedProject.monetization }}</dd>
                    </div>
                    <div class="detail-row">
                      <dt>技术与合规门槛</dt>
                      <dd>{{ selectedProject.barriers }}</dd>
                    </div>
                  </dl>
                </section>

                <section class="detail-section">
                  <h4 class="detail-section-title">证据与状态</h4>
                  <dl class="project-detail-list">
                    <div class="detail-row">
                      <dt>证据等级</dt>
                      <dd>{{ evidenceLevelLabel[selectedProject.evidenceQuality.level] }}</dd>
                    </div>
                    <div class="detail-row">
                      <dt>营销风险</dt>
                      <dd>{{ riskLabel[selectedProject.marketingRisk] }}</dd>
                    </div>
                    <div v-if="getEvidenceGapLabel(selectedProject)" class="detail-row">
                      <dt>待补证点</dt>
                      <dd>{{ getEvidenceGapLabel(selectedProject) }}</dd>
                    </div>
                    <div v-if="selectedScenarioStats" class="detail-row">
                      <dt>场景样本概览</dt>
                      <dd>{{ selectedScenarioStats.total }} 个样本，其中商业化清楚 {{ selectedScenarioStats.strong }} 个，待补证 {{ selectedScenarioStats.medium }} 个。</dd>
                    </div>
                    <div class="detail-row">
                      <dt>判断说明</dt>
                      <dd>
                        {{ expandedFields.evidence ? evidencePreview.fullText : evidencePreview.shortText }}
                        <button
                          v-if="evidencePreview.truncated"
                          class="detail-inline-toggle"
                          type="button"
                          @click="expandedFields.evidence = !expandedFields.evidence"
                        >
                          {{ expandedFields.evidence ? '收起全文' : '展开全文' }}
                        </button>
                      </dd>
                    </div>
                    <div class="detail-row">
                      <dt>证据信号</dt>
                      <dd>{{ (selectedProject.evidenceQuality.signals || []).join('、') }}</dd>
                    </div>
                    <div v-if="selectedProject.dailyNotes && selectedProject.dailyNotes.length" class="detail-row">
                      <dt>最新动态</dt>
                      <dd>
                        {{ expandedFields.latestNote ? latestNotePreview.fullText : latestNotePreview.shortText }}
                        <button
                          v-if="latestNotePreview.truncated"
                          class="detail-inline-toggle"
                          type="button"
                          @click="expandedFields.latestNote = !expandedFields.latestNote"
                        >
                          {{ expandedFields.latestNote ? '收起全文' : '展开全文' }}
                        </button>
                      </dd>
                    </div>
                  </dl>
                  <div v-if="selectedGapLabel" class="detail-subsection">
                    <p class="detail-subsection-label">同类缺口队列</p>
                    <div class="detail-shortcut-actions">
                      <button class="detail-shortcut-chip" type="button" @click="focusSameGap">只看同类缺口</button>
                      <button
                        class="detail-nav-chip"
                        type="button"
                        :disabled="sameGapIndex <= 0"
                        @click="moveSameGapSelection(-1)"
                      >
                        上一个同类缺口
                      </button>
                      <span class="detail-nav-chip detail-nav-chip-static">
                        {{ selectedGapLabel }} · {{ sameGapQueue.length ? sameGapIndex + 1 : 0 }} / {{ sameGapQueue.length }}
                      </span>
                      <button
                        class="detail-nav-chip"
                        type="button"
                        :disabled="sameGapIndex < 0 || sameGapIndex >= sameGapQueue.length - 1"
                        @click="moveSameGapSelection(1)"
                      >
                        下一个同类缺口
                      </button>
                    </div>
                  </div>
                </section>

                <section class="detail-section">
                  <h4 class="detail-section-title">来源与对标</h4>
                  <p class="detail-subsection-label">来源 {{ selectedProject.sources.length }} 条 / 已记录对标 {{ selectedBenchmarkLinks.length }} 个</p>
                  <div v-if="selectedBenchmarkLinks.length" class="detail-shortcut-actions">
                    <button class="detail-shortcut-chip" type="button" @click="activateBenchmarkCompare">只看当前与对标</button>
                  </div>
                  <details v-if="selectedBenchmarkLinks.length" class="detail-disclosure">
                    <summary class="detail-disclosure-summary">
                      <span class="detail-subsection-label">已记录对标（{{ selectedBenchmarkLinks.length }}）</span>
                      <span class="detail-disclosure-hint">点击展开</span>
                    </summary>
                    <div class="detail-disclosure-body">
                      <div class="benchmark-links">
                        <template v-for="item in selectedBenchmarkLinks" :key="item.label">
                          <button
                            v-if="item.matchedProject"
                            class="benchmark-chip benchmark-chip-link"
                            type="button"
                            @click="selectProject(item.matchedProject.id)"
                          >
                            {{ item.label }}
                          </button>
                          <span v-else class="benchmark-chip">{{ item.label }}</span>
                        </template>
                      </div>
                    </div>
                  </details>
                  <details class="detail-disclosure">
                    <summary class="detail-disclosure-summary">
                      <span class="detail-subsection-label">来源链接（{{ selectedProject.sources.length }}）</span>
                      <span class="detail-disclosure-hint">点击展开</span>
                    </summary>
                    <div class="detail-disclosure-body">
                      <div class="source-links">
                        <a v-for="(source, index) in selectedProject.sources" :key="source" class="source-chip" :href="source" target="_blank" rel="noreferrer">
                          {{ index === 0 ? '首要来源' : '补充来源' }} · {{ domainFromUrl(source) }}
                        </a>
                      </div>
                    </div>
                  </details>
                </section>

                <section v-if="sameFormSnapshot || benchmarkSnapshot" class="detail-section">
                  <h4 class="detail-section-title">快照对比</h4>

                  <div v-if="benchmarkSnapshot" class="detail-subsection">
                    <p class="detail-subsection-label">对标快照</p>
                    <div class="compare-snapshot">
                      <div class="compare-table">
                        <div v-for="row in benchmarkSnapshot.rows" :key="'benchmark-' + row.label" class="compare-row">
                          <span class="compare-label">{{ row.label }}</span>
                          <button
                            v-for="value in row.values"
                            :key="'benchmark-' + row.label + '-' + value.projectId"
                            class="compare-cell"
                            :class="{ 'compare-cell-current': selectedProject && value.projectId === selectedProject.id }"
                            type="button"
                            @click="selectProject(value.projectId)"
                          >
                            {{ value.text }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="sameFormSnapshot" class="detail-subsection">
                    <p class="detail-subsection-label">同形态快照对比</p>
                    <div class="compare-snapshot">
                      <div class="compare-table">
                        <div v-for="row in sameFormSnapshot.rows" :key="'same-form-' + row.label" class="compare-row">
                          <span class="compare-label">{{ row.label }}</span>
                          <button
                            v-for="value in row.values"
                            :key="'same-form-' + row.label + '-' + value.projectId"
                            class="compare-cell"
                            :class="{ 'compare-cell-current': selectedProject && value.projectId === selectedProject.id }"
                            type="button"
                            @click="selectProject(value.projectId)"
                          >
                            {{ value.text }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section v-if="sameFormRelated.length || sameScenarioRelated.length" class="detail-section">
                  <h4 class="detail-section-title">快速对比</h4>
                  <div class="detail-shortcut-actions">
                    <button class="detail-shortcut-chip" type="button" @click="focusCluster('form')">只看同形态（{{ sameFormStats.total }}）</button>
                    <button class="detail-shortcut-chip" type="button" @click="focusCluster('form', true)">只看同形态清楚样本（{{ sameFormStats.strong }}）</button>
                    <button class="detail-shortcut-chip" type="button" @click="focusCluster('scenario')">只看同场景（{{ sameScenarioStats.total }}）</button>
                    <button class="detail-shortcut-chip" type="button" @click="focusCluster('scenario', true)">只看同场景清楚样本（{{ sameScenarioStats.strong }}）</button>
                  </div>

                  <details v-if="sameFormRelated.length" class="detail-disclosure">
                    <summary class="detail-disclosure-summary">
                      <span class="detail-subsection-label">同形态项目（{{ sameFormStats.total }}，清楚 {{ sameFormStats.strong }}）</span>
                      <span class="detail-disclosure-hint">点击展开</span>
                    </summary>
                    <div class="detail-disclosure-body">
                      <div class="related-projects">
                        <button
                          v-for="project in sameFormRelated"
                          :key="'form-' + project.id"
                          class="related-card"
                          type="button"
                          @click="selectProject(project.id)"
                        >
                          <strong>{{ project.canonicalName }}</strong>
                          <span>{{ project.productForm }}</span>
                          <span>面向{{ shortList(project.targetCustomers, 1) }}</span>
                        </button>
                      </div>
                    </div>
                  </details>

                  <details v-if="sameScenarioRelated.length" class="detail-disclosure">
                    <summary class="detail-disclosure-summary">
                      <span class="detail-subsection-label">同场景项目（{{ sameScenarioStats.total }}，清楚 {{ sameScenarioStats.strong }}）</span>
                      <span class="detail-disclosure-hint">点击展开</span>
                    </summary>
                    <div class="detail-disclosure-body">
                      <div class="related-projects">
                        <button
                          v-for="project in sameScenarioRelated"
                          :key="'scenario-' + project.id"
                          class="related-card"
                          type="button"
                          @click="selectProject(project.id)"
                        >
                          <strong>{{ project.canonicalName }}</strong>
                          <span>{{ firstClause(project.painPoint) }}</span>
                          <span>证据：{{ evidenceLevelLabel[project.evidenceQuality.level] }}</span>
                        </button>
                      </div>
                    </div>
                  </details>
                </section>
              </div>
            </article>
          </div>
        </aside>
      </main>

      <button v-if="showScrollTop" class="scroll-top-button" type="button" @click="scrollToTop">回到顶部</button>
    </div>
  `,
}).mount("#app");
